import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { LoaderDots, RouteDoodle } from '@/components/motion';
import { ParkMap } from '@/components/ParkMap';
import { TripPicker } from '@/components/TripPicker';
import { Heading, PillButton } from '@/components/ui';
import { KRAKOW_CENTER, Park, parkById, parks } from '@/data/parks';
import { useOnline } from '@/hooks/useOnline';
import { useUserLocation } from '@/hooks/useUserLocation';
import { useI18n } from '@/i18n';
import { buildTrip, diffAutoPicks, TripPlan, tripLegs, tripMinutes } from '@/lib/corridor';
import { isInKrakowBounds } from '@/lib/mapStyle';
import { fetchRouteGeometry, LngLatCoord } from '@/lib/routing';
import { TransportMode, useAppStore } from '@/store';
import { TripPoint, useTripDraft } from '@/store/tripDraft';
import { categories, fonts, ground, radii, spacing } from '@/theme/tokens';

/**
 * Custom-trip preview (design 3c) as its own pushed screen, so the Android
 * back gesture / button and the iOS swipe all just work — it used to be a
 * `phase` inside the route tab, which no system back affordance could reach.
 *
 * Nothing is saved until "Save & start"; leaving by any route (button, gesture,
 * hardware back) simply pops back to the setup screen with the draft intact.
 * The draft store is the single source of truth, so the setup screen and this
 * screen never disagree.
 */

/** Stand-in while the optimising screen is still up. */
const EMPTY_PLAN: TripPlan = { stops: [], autoIds: [], totalKm: 0, directKm: 0, extraKm: 0 };

/** How long the optimising screen stays up before the plan is built. */
const OPTIMISE_MS = 900;

export default function TripPreviewScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const userLoc = useUserLocation();
  const online = useOnline();
  const params = useLocalSearchParams<{ mode?: string }>();
  const mode = (params.mode ?? 'walk') as TransportMode;

  const visits = useAppStore((s) => s.visits);
  const setActiveRoute = useAppStore((s) => s.setActiveRoute);

  /**
   * The plan build (greedy insertion + 2-opt) is heavy, so it is deferred
   * behind the optimising screen: the loader paints first, then the memo runs.
   */
  const [computing, setComputing] = useState(true);
  const [previewGeometry, setPreviewGeometry] = useState<LngLatCoord[] | null>(null);
  const [tripPickerVisible, setTripPickerVisible] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setComputing(false), OPTIMISE_MS);
    return () => clearTimeout(id);
  }, []);

  const stampedIds = useMemo(() => new Set(Object.keys(visits)), [visits]);
  const remaining = useMemo(() => parks.filter((p) => !stampedIds.has(p.id)), [stampedIds]);

  const draft = useTripDraft();
  // A GPS fix outside the map's hard bounds is treated like no fix at all.
  const origin = userLoc && isInKrakowBounds(userLoc.lat, userLoc.lng) ? userLoc : KRAKOW_CENTER;
  const tripStart: TripPoint = draft.start ?? {
    lat: origin.lat,
    lng: origin.lng,
    label: t('currentLocation'),
    kind: 'current',
  };
  /** Unset end behaves like a loop back to the start. */
  const tripEndEff: TripPoint = (draft.roundTrip ? tripStart : draft.end) ?? tripStart;
  const isLoop = draft.roundTrip || !draft.end;

  // Never more auto-picks than there are parks left to stamp; a custom trip
  // may legitimately have 0 ("only the parks I chose myself").
  const autoCount = Math.min(Math.max(draft.autoCount.custom, 0), Math.max(0, remaining.length));

  const lockedParks = useMemo(
    () => draft.lockedIds.map((id) => parkById(id)).filter((p): p is Park => !!p),
    [draft.lockedIds],
  );

  const plan = useMemo(
    () =>
      computing
        ? EMPTY_PLAN
        : buildTrip(tripStart, tripEndEff, lockedParks, autoCount, remaining, new Set(draft.excludedIds)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      computing,
      tripStart.lat,
      tripStart.lng,
      tripEndEff.lat,
      tripEndEff.lng,
      lockedParks,
      autoCount,
      draft.excludedIds,
      remaining,
    ],
  );
  const planAutoIds = useMemo(() => new Set(plan.autoIds), [plan.autoIds]);

  // Street-following geometry for the un-saved preview. On failure or offline
  // the map keeps its dashed straight-line fallback.
  const planStopsKey = plan.stops.map((p) => p.id).join(',');
  useEffect(() => {
    let cancelled = false;
    setPreviewGeometry(null);
    if (!online || plan.stops.length === 0) return;
    const points = [
      { lat: tripStart.lat, lng: tripStart.lng },
      ...plan.stops.map((p) => ({ lat: p.lat, lng: p.lng })),
      { lat: tripEndEff.lat, lng: tripEndEff.lng },
    ];
    fetchRouteGeometry(points, mode).then((coords) => {
      if (!cancelled) setPreviewGeometry(coords);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planStopsKey, mode, online, tripStart.lat, tripStart.lng, tripEndEff.lat, tripEndEff.lng]);

  // Swap diffing (design 3c): when an edit changes the auto-pick set, show
  // "swapped in — replaces X" rows. The baseline was cleared before the push,
  // and an empty previous set pairs into zero rows — so the first computed plan
  // establishes the baseline without spurious entries.
  useEffect(() => {
    if (computing) return;
    const prev = draft.prevAutoIds;
    if (prev.join(',') === plan.autoIds.join(',')) return;
    const stopIds = new Set(plan.stops.map((p) => p.id));
    const stillValid = draft.swaps.filter((s) => stopIds.has(s.inId) && !stopIds.has(s.outId));
    const fresh = diffAutoPicks(prev, plan.autoIds, draft.prevTotalKm, plan.totalKm).filter(
      (s) => !stillValid.some((x) => x.inId === s.inId),
    );
    draft.setSwaps([...stillValid, ...fresh], plan.autoIds, plan.totalKm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [computing, plan.autoIds.join(','), plan.totalKm]);

  /** × on an auto-pick: drop it without a replacement (stepper −1). */
  const removeAutoPick = (parkId: string) => {
    draft.excludeAuto(parkId);
    draft.setAutoCount('custom', autoCount - 1);
  };

  /** Undo a swap: the old park comes back locked; one auto slot is used up. */
  const undoSwap = (swap: (typeof draft.swaps)[number]) => {
    draft.undoSwap(swap);
    draft.setAutoCount('custom', autoCount - 1);
  };

  const saveTrip = () => {
    const { legs } = tripLegs(tripStart, plan.stops, tripEndEff, mode);
    setActiveRoute({
      mode,
      kind: 'custom',
      legs: legs.map((l) => ({
        parkId: l.park.id,
        distanceKm: l.distanceKm,
        durationMin: l.durationMin,
        done: false,
      })),
      dayIndex: 0,
      dayCount: 1,
      following: false,
      trackingEnabled: false,
      startPoint: { lat: tripStart.lat, lng: tripStart.lng, label: tripStart.label },
      endPoint: { lat: tripEndEff.lat, lng: tripEndEff.lng, label: tripEndEff.label },
      roundTrip: isLoop,
    });
    // The route tab picks the new activeRoute up and shows its result view.
    router.back();
  };

  if (computing) {
    return (
      <View style={styles.center}>
        <Animated.View entering={FadeIn}>
          <RouteDoodle />
        </Animated.View>
        <Heading style={{ fontSize: 24 }}>{t('optimising')}</Heading>
        <LoaderDots />
      </View>
    );
  }

  const mapH = Math.round(height * 0.34);
  const totalMin = tripMinutes(plan.totalKm, plan.stops.length, mode);
  const hours = Math.max(1, Math.round(totalMin / 60));
  // Faded, tappable candidates near the corridor
  const previewCandidates = remaining
    .filter((p) => !plan.stops.some((s) => s.id === p.id))
    .slice(0, 60);

  return (
    <View style={{ flex: 1, backgroundColor: ground.bg }}>
      <View>
        <ParkMap
          width={width}
          height={mapH}
          parks={[]}
          stampedIds={stampedIds}
          routeStops={plan.stops.map((park, i) => ({ park, index: i + 1 }))}
          routeGeometry={previewGeometry}
          anchors={{ start: tripStart, end: tripEndEff }}
          candidates={previewCandidates}
          onSelectCandidate={(p) => draft.toggleLocked(p.id)}
          directLine={isLoop ? undefined : [tripStart, tripEndEff]}
          userLocation={userLoc}
          // Editing stops must not move the map under the user's finger
          fitOnce
        />
        <View style={[styles.previewTag, { top: insets.top + 8 }]}>
          <Text style={styles.previewTagText}>{t('previewNotSaved')}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('back')}
          onPress={() => router.back()}
          style={[styles.previewBack, { top: insets.top + 8 }]}
        >
          <Icon name="back" size={18} color={ground.text} />
        </Pressable>
      </View>

      <View style={styles.previewHeader}>
        <Heading style={{ fontSize: 21, flex: 1 }} numberOfLines={1}>
          {plan.stops.length} {t('parks')} · {plan.totalKm.toFixed(1)} km · ~{hours} h
        </Heading>
        {!isLoop && plan.stops.length > 0 ? (
          <View style={styles.vsDirectTag}>
            <Text style={styles.vsDirectText}>{t('vsDirect', { km: plan.extraKm.toFixed(1) })}</Text>
          </View>
        ) : null}
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.md, gap: 8, paddingBottom: 16 }}>
        {plan.stops.map((p, i) => {
          const swap = draft.swaps.find((s) => s.inId === p.id);
          if (swap) {
            const replaced = parkById(swap.outId);
            const pal = categories[p.category];
            return (
              <View
                key={p.id}
                style={[styles.previewRow, styles.swapRow, { borderColor: pal.ink, backgroundColor: pal.tint }]}
              >
                <Text style={[styles.legIndex, { color: pal.deep }]}>{i + 1}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.previewRowTitle, { color: pal.deep }]}>
                    {t('swappedIn', { park: p.name })}
                  </Text>
                  <Text style={[styles.previewRowSub, { color: pal.deep }]}>
                    {t('replacesPark', {
                      park: replaced?.name ?? swap.outId,
                      km: `${swap.deltaKm >= 0 ? '+' : ''}${swap.deltaKm.toFixed(1)}`,
                    })}
                  </Text>
                </View>
                <Pressable accessibilityRole="button" hitSlop={8} onPress={() => undoSwap(swap)}>
                  <Text style={[styles.changeLink, { color: pal.deep }]}>{t('undo')}</Text>
                </Pressable>
              </View>
            );
          }
          const isAuto = planAutoIds.has(p.id);
          return (
            <View key={p.id} style={styles.previewRow}>
              <Text style={styles.legIndex}>{i + 1}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.previewRowTitle}>{p.name}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${t('removeStop')}: ${p.name}`}
                hitSlop={8}
                onPress={() => (isAuto ? removeAutoPick(p.id) : draft.toggleLocked(p.id))}
                style={{ minWidth: 34, minHeight: 34, alignItems: 'center', justifyContent: 'center' }}
              >
                <Icon name="x" size={15} color={ground.textMuted} />
              </Pressable>
            </View>
          );
        })}
        <View style={styles.addHintRow}>
          <Icon name="plus" size={14} color={ground.textMuted} />
          <Text style={styles.addHintText}>{t('tapFadedPins')}</Text>
        </View>
      </ScrollView>

      <View style={[styles.previewFooter, { paddingBottom: insets.bottom + 10 }]}>
        <PillButton
          label={t('adjust')}
          variant="outline"
          style={{ flex: 1 }}
          onPress={() => setTripPickerVisible(true)}
        />
        <PillButton label={t('saveAndStart')} style={{ flex: 1.6 }} onPress={saveTrip} />
      </View>

      <TripPicker
        visible={tripPickerVisible}
        onClose={() => setTripPickerVisible(false)}
        start={tripStart}
        end={tripEndEff}
        stops={plan.stops}
        autoIds={planAutoIds}
        stampedIds={stampedIds}
        totalKm={plan.totalKm}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    padding: spacing.lg,
    backgroundColor: ground.bg,
  },
  previewTag: {
    position: 'absolute',
    left: spacing.md,
    backgroundColor: ground.dark,
    borderRadius: radii.pill,
    paddingVertical: 7,
    paddingHorizontal: 13,
  },
  previewTagText: { color: ground.white, fontFamily: fonts.bodySemi, fontSize: 13 },
  previewBack: {
    position: 'absolute',
    right: spacing.md,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: ground.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  vsDirectTag: {
    backgroundColor: categories.forest.tint,
    borderRadius: radii.pill,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  vsDirectText: { fontFamily: fonts.bodySemi, fontSize: 12.5, color: categories.forest.deep },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: ground.surfaceLight,
    borderRadius: radii.md,
    paddingVertical: 10,
    paddingHorizontal: 14,
    minHeight: 52,
  },
  swapRow: { borderWidth: 2, borderStyle: 'dashed' },
  legIndex: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: ground.textMuted,
    width: 18,
    textAlign: 'center',
  },
  previewRowTitle: { fontFamily: fonts.bodySemi, fontSize: 14.5, color: ground.text },
  previewRowSub: { fontFamily: fonts.body, fontSize: 12.5, color: ground.textMuted, marginTop: 1 },
  changeLink: { fontFamily: fonts.bodyBold, color: ground.accent, fontSize: 15.5 },
  addHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
    paddingTop: 2,
  },
  addHintText: { fontFamily: fonts.bodySemi, fontSize: 13, color: ground.textMuted },
  previewFooter: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingTop: 8,
  },
});
