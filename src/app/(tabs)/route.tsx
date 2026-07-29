import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated as RNAnimated,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { ConfettiRain, LoaderDots, PopIn, RouteDoodle } from '@/components/motion';
import { ParkMap } from '@/components/ParkMap';
import { SnapBottomSheet } from '@/components/SnapBottomSheet';
import { StampView } from '@/components/StampView';
import { TripPicker } from '@/components/TripPicker';
import { TripPointPicker } from '@/components/TripPointPicker';
import { Body, Card, Dialog, Heading, PillButton, SectionLabel } from '@/components/ui';
import { distanceKm, KRAKOW_CENTER, Park, parkById, parks } from '@/data/parks';
import { useOnline } from '@/hooks/useOnline';
import { useUserLocation } from '@/hooks/useUserLocation';
import { useI18n } from '@/i18n';
import { TransportMode, useAppStore } from '@/store';
import { TripPoint, useTripDraft } from '@/store/tripDraft';
import { buildTrip, diffAutoPicks, TripPlan, tripLegs, tripMinutes } from '@/lib/corridor';
import {
  requestNotifPermission,
  startBackgroundFollowing,
  stopBackgroundFollowing,
} from '@/lib/followingLocation';
import { fetchRouteGeometry, LngLatCoord } from '@/lib/routing';
import { relegLegs } from '@/lib/tsp';
import { categories, fonts, ground, radii, spacing } from '@/theme/tokens';

const ARRIVAL_RADIUS_KM = 0.18;

type Phase = 'setup' | 'computing' | 'preview' | 'result' | 'complete';

/**
 * Completion fan — the real stamps just collected, laid out like cards on a
 * table. One row per possible count so a single stamp still reads as the hero
 * and three stay legible; within a row the last slot draws on top, so the
 * freshest stamp lands in front.
 */
const STAMP_FAN: { dx: number; rotation: number; size: number; delay: number }[][] = [
  [{ dx: 0, rotation: -5, size: 150, delay: 0 }],
  [
    { dx: -44, rotation: -11, size: 128, delay: 0 },
    { dx: 44, rotation: 8, size: 128, delay: 110 },
  ],
  [
    { dx: -84, rotation: -13, size: 112, delay: 0 },
    { dx: 84, rotation: 11, size: 112, delay: 110 },
    { dx: 0, rotation: -3, size: 136, delay: 220 },
  ],
];

/** Stand-in while no live plan is needed (quick trips build theirs on demand). */
const EMPTY_PLAN: TripPlan = { stops: [], autoIds: [], totalKm: 0, directKm: 0, extraKm: 0 };

function navigateNative(park: Park, mode: TransportMode) {
  const flag = mode === 'walk' ? 'w' : mode === 'bike' ? 'b' : 'r';
  const url =
    Platform.OS === 'ios'
      ? `maps:0,0?q=${encodeURIComponent(park.name)}@${park.lat},${park.lng}&dirflg=${flag}`
      : `google.navigation:q=${park.lat},${park.lng}&mode=${mode === 'walk' ? 'w' : mode === 'bike' ? 'b' : 'r'}`;
  Linking.openURL(url).catch(() =>
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${park.lat},${park.lng}`),
  );
}

export default function RouteScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const userLoc = useUserLocation();
  const online = useOnline();

  const visits = useAppStore((s) => s.visits);
  const activeRoute = useAppStore((s) => s.activeRoute);
  const setActiveRoute = useAppStore((s) => s.setActiveRoute);
  const setFollowing = useAppStore((s) => s.setFollowing);
  const completeLeg = useAppStore((s) => s.completeLeg);
  const stampPark = useAppStore((s) => s.stamp);

  const [phase, setPhase] = useState<Phase>(activeRoute ? 'result' : 'setup');
  const [scope, setScope] = useState<'quick' | 'custom'>('quick');
  const [mode, setMode] = useState<TransportMode>('walk');
  const [primerVisible, setPrimerVisible] = useState(false);
  const [notifPrimerVisible, setNotifPrimerVisible] = useState(false);
  const [stopVisible, setStopVisible] = useState(false);
  const [arrivalPark, setArrivalPark] = useState<Park | null>(null);
  const [offlineNote, setOfflineNote] = useState(false);
  const [routeGeometry, setRouteGeometry] = useState<LngLatCoord[] | null>(null);
  const [previewGeometry, setPreviewGeometry] = useState<LngLatCoord[] | null>(null);
  /** Which point the TripPointPicker is editing. */
  const [pointPicking, setPointPicking] = useState<'start' | 'end' | null>(null);
  const [tripPickerVisible, setTripPickerVisible] = useState(false);
  /** Sheet position (0 = expanded … range = collapsed); the map follows it. */
  const sheetY = useRef(new RNAnimated.Value(0)).current;
  const watcher = useRef<Location.LocationSubscription | null>(null);

  const stampedIds = useMemo(() => new Set(Object.keys(visits)), [visits]);
  /**
   * Newest stamps first — the completion fan falls back to these for the
   * whole-challenge "all done" state, which has no active route to read.
   */
  const recentStampIds = useMemo(
    () =>
      Object.values(visits)
        .sort((a, b) => new Date(b.stampedAt).getTime() - new Date(a.stampedAt).getTime())
        .slice(0, 3)
        .map((v) => v.parkId),
    [visits],
  );
  const remaining = useMemo(() => parks.filter((p) => !stampedIds.has(p.id)), [stampedIds]);
  const origin = userLoc ?? KRAKOW_CENTER;
  const startPoint = origin;

  // ---- custom trip draft (design 3a–3e) ----
  const draft = useTripDraft();
  const tripStart: TripPoint = draft.start ?? {
    lat: origin.lat,
    lng: origin.lng,
    label: t('currentLocation'),
    kind: 'current',
  };
  const tripEnd: TripPoint | null = draft.roundTrip ? tripStart : draft.end;
  /** Unset end behaves like a loop back to the start. */
  const tripEndEff: TripPoint = tripEnd ?? tripStart;
  const isLoop = draft.roundTrip || !draft.end;

  /**
   * Stepper bounds: never more parks than are left to stamp. A quick trip is
   * nothing but auto-picks so it needs at least one; a custom trip auto-fills
   * around hand-picks, where 0 is a legitimate "just my picks" trip.
   * `remaining` is empty on a finished challenge, hence the Math.max — the
   * bounds must never invert.
   */
  const minAutoCount = scope === 'custom' ? 0 : 1;
  const maxAutoCount = Math.max(minAutoCount, remaining.length);
  const autoCount = Math.min(Math.max(draft.autoCount[scope], minAutoCount), maxAutoCount);

  const lockedParks = useMemo(
    () => draft.lockedIds.map((id) => parkById(id)).filter((p): p is Park => !!p),
    [draft.lockedIds],
  );

  /**
   * Live corridor plan — haversine-based, cheap enough to recompute inline.
   * Custom trips only: their setup screen shows a live km/detour summary and
   * the preview is built from it. Quick trips build their own plan when the
   * user hits Generate, so computing here would just make every stepper tap
   * re-run buildTrip for a result nothing reads.
   */
  const plan = useMemo(
    () =>
      scope === 'custom'
        ? buildTrip(
            tripStart,
            tripEndEff,
            lockedParks,
            autoCount,
            remaining,
            new Set(draft.excludedIds),
          )
        : EMPTY_PLAN,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      scope,
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


  // Street-following route geometry (Valhalla). Refetches when the leg
  // order/mode/start changes; results are cached in lib/routing. On failure
  // or offline the map keeps the dashed straight-line fallback.
  const legIdsKey = activeRoute ? activeRoute.mode + '|' + activeRoute.legs.map((l) => l.parkId).join(',') : '';
  useEffect(() => {
    let cancelled = false;
    setRouteGeometry(null);
    if (!activeRoute || activeRoute.legs.length === 0 || !online) return;
    const points = [
      activeRoute.startPoint ?? startPoint,
      ...activeRoute.legs
        .map((l) => parkById(l.parkId))
        .filter((p): p is Park => !!p)
        .map((p) => ({ lat: p.lat, lng: p.lng })),
      ...(activeRoute.endPoint ? [activeRoute.endPoint] : []),
    ];
    fetchRouteGeometry(points, activeRoute.mode).then((coords) => {
      if (!cancelled) setRouteGeometry(coords);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [legIdsKey, online, startPoint.lat, startPoint.lng]);

  // Street-following geometry for the un-saved preview (design 3c).
  const planStopsKey = plan.stops.map((p) => p.id).join(',');
  useEffect(() => {
    let cancelled = false;
    setPreviewGeometry(null);
    if (phase !== 'preview' || !online || plan.stops.length === 0) return;
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
  }, [phase, planStopsKey, mode, online, tripStart.lat, tripStart.lng, tripEndEff.lat, tripEndEff.lng]);

  // Swap diffing (design 3c): when an edit changes the auto-pick set, show
  // "swapped in — replaces X" rows. Baseline is set when preview opens.
  useEffect(() => {
    if (phase !== 'preview') return;
    const prev = draft.prevAutoIds;
    if (prev.join(',') === plan.autoIds.join(',')) return;
    const stopIds = new Set(plan.stops.map((p) => p.id));
    const stillValid = draft.swaps.filter((s) => stopIds.has(s.inId) && !stopIds.has(s.outId));
    const fresh = diffAutoPicks(prev, plan.autoIds, draft.prevTotalKm, plan.totalKm).filter(
      (s) => !stillValid.some((x) => x.inId === s.inId),
    );
    draft.setSwaps([...stillValid, ...fresh], plan.autoIds, plan.totalKm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, plan.autoIds.join(','), plan.totalKm]);

  const nearbyCount = useMemo(
    () => remaining.filter((p) => distanceKm(origin.lat, origin.lng, p.lat, p.lng) <= 2).length,
    [remaining, origin],
  );

  // ---- generation: Quick trip = one self-contained outing (design 1m) ----
  const generateQuick = () => {
    setOfflineNote(!online && (mode === 'walk' || mode === 'bike'));
    setPhase('computing');
    setTimeout(() => {
      const quickPlan = buildTrip(
        tripStart,
        tripEndEff,
        [],
        autoCount,
        remaining,
        new Set(draft.excludedIds),
      );
      const { legs } = tripLegs(tripStart, quickPlan.stops, tripEndEff, mode);
      setActiveRoute({
        mode,
        kind: 'quick',
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
      setPhase(quickPlan.stops.length === 0 ? 'complete' : 'result');
    }, 900);
  };

  const generate = () => {
    if (scope === 'custom') {
      openPreview();
      return;
    }
    generateQuick();
  };

  // ---- custom trip flow (design 3a–3c) ----
  const openPreview = () => {
    draft.setSwaps([], plan.autoIds, plan.totalKm); // baseline for swap diffs
    setPhase('preview');
  };

  /** × on an auto-pick: drop it without a replacement (stepper −1). */
  const removeAutoPick = (parkId: string) => {
    draft.excludeAuto(parkId);
    draft.setAutoCount(scope, autoCount - 1);
  };

  /** Undo a swap: the old park comes back locked; one auto slot is used up. */
  const undoSwap = (swap: (typeof draft.swaps)[number]) => {
    draft.undoSwap(swap);
    draft.setAutoCount(scope, autoCount - 1);
  };

  const saveTrip = () => {
    const { legs } = tripLegs(tripStart, plan.stops, tripEndEff, mode);
    setOfflineNote(!online && (mode === 'walk' || mode === 'bike'));
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
    setPhase('result');
  };

  const reoptimise = () => {
    if (!activeRoute) return;
    // Re-order the same stops between the trip anchors; legacy routes
    // without anchors are treated as a loop from the start point.
    const stopParks = activeRoute.legs
      .map((l) => parkById(l.parkId))
      .filter((p): p is Park => !!p);
    const doneById = Object.fromEntries(activeRoute.legs.map((l) => [l.parkId, l.done]));
    const startP = activeRoute.startPoint ?? startPoint;
    const endP = activeRoute.endPoint ?? { lat: startP.lat, lng: startP.lng, label: '' };
    const replanned = buildTrip(startP, endP, stopParks, 0, [], new Set());
    const { legs } = tripLegs(startP, replanned.stops, endP, activeRoute.mode);
    setActiveRoute({
      ...activeRoute,
      legs: legs.map((l) => ({
        parkId: l.park.id,
        distanceKm: l.distanceKm,
        durationMin: l.durationMin,
        done: !!doneById[l.park.id],
      })),
    });
  };

  const handlePointPicked = (point: TripPoint) => {
    if (pointPicking === 'start') draft.setStart(point);
    else if (pointPicking === 'end') draft.setEnd(point);
    setPointPicking(null);
  };

  // ---- leg reorder / remove (recompute distances sequentially from start) ----
  const rebuildLegs = (orderedIds: string[], doneById: Record<string, boolean>, m: TransportMode) => {
    const orderedParks = orderedIds.map((id) => parkById(id)).filter((p): p is Park => !!p);
    return relegLegs(startPoint, orderedParks, m).map((l) => ({
      parkId: l.park.id,
      distanceKm: l.distanceKm,
      durationMin: l.durationMin,
      done: !!doneById[l.park.id],
    }));
  };

  const moveLeg = (index: number, dir: -1 | 1) => {
    if (!activeRoute) return;
    const legs = [...activeRoute.legs];
    const j = index + dir;
    if (j < 0 || j >= legs.length) return;
    if (legs[index].done || legs[j].done) return;
    [legs[index], legs[j]] = [legs[j], legs[index]];
    const doneById = Object.fromEntries(legs.map((l) => [l.parkId, l.done]));
    setActiveRoute({
      ...activeRoute,
      legs: rebuildLegs(legs.map((l) => l.parkId), doneById, activeRoute.mode),
    });
  };

  const removeLeg = (index: number) => {
    if (!activeRoute || activeRoute.legs.length <= 1) return;
    if (activeRoute.legs[index].done) return;
    const legs = activeRoute.legs.filter((_, i) => i !== index);
    const doneById = Object.fromEntries(legs.map((l) => [l.parkId, l.done]));
    setActiveRoute({
      ...activeRoute,
      legs: rebuildLegs(legs.map((l) => l.parkId), doneById, activeRoute.mode),
    });
  };

  // ---- following mode: arrival detection (foreground watcher; spec 4.2) ----
  const nextLeg = activeRoute?.legs.find((l) => !l.done);
  const nextPark = nextLeg ? parkById(nextLeg.parkId) : undefined;

  useEffect(() => {
    if (!activeRoute?.following || !activeRoute.trackingEnabled || !nextPark) {
      watcher.current?.remove();
      watcher.current = null;
      return;
    }
    let cancelled = false;
    (async () => {
      watcher.current?.remove();
      watcher.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: 40 },
        (pos) => {
          if (cancelled) return;
          const d = distanceKm(pos.coords.latitude, pos.coords.longitude, nextPark.lat, nextPark.lng);
          if (d <= ARRIVAL_RADIUS_KM) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setArrivalPark(nextPark);
          }
        },
      );
    })();
    return () => {
      cancelled = true;
      watcher.current?.remove();
      watcher.current = null;
    };
  }, [activeRoute?.following, activeRoute?.trackingEnabled, nextPark?.id]);

  // Tap on an arrival notification opens the in-app arrival dialog.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const parkId = response.notification.request.content.data?.parkId;
      const park = typeof parkId === 'string' ? parkById(parkId) : undefined;
      if (park) setArrivalPark(park);
    });
    return () => sub.remove();
  }, []);

  const startFollowing = () => setPrimerVisible(true);

  const enableTracking = async () => {
    setPrimerVisible(false);
    const { status } = await Location.requestForegroundPermissionsAsync();
    const granted = status === Location.PermissionStatus.GRANTED;
    if (activeRoute) setActiveRoute({ ...activeRoute, following: true, trackingEnabled: granted });
    // Background updates are an enhancement — foreground watcher covers in-app detection.
    if (granted) startBackgroundFollowing().catch(() => {});
    setNotifPrimerVisible(true);
  };

  const skipTracking = () => {
    setPrimerVisible(false);
    if (activeRoute) setActiveRoute({ ...activeRoute, following: true, trackingEnabled: false });
  };

  const stopFollowing = () => {
    setStopVisible(false);
    setFollowing(false);
    watcher.current?.remove();
    watcher.current = null;
    stopBackgroundFollowing();
  };

  const handleArrivalStamp = () => {
    if (!arrivalPark) return;
    const parkId = arrivalPark.id;
    completeLeg(parkId);
    stampPark(parkId);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setArrivalPark(null);
    // Full-screen stamp celebration (shared with park detail); it hands off
    // to the milestone screen itself. Route completion swaps in when this
    // tab regains focus afterwards.
    router.push({ pathname: '/stamp-success', params: { parkId } });
  };

  const routeFinished =
    !!activeRoute && activeRoute.legs.length > 0 && activeRoute.legs.every((l) => l.done);

  // Every leg done (arrival stamps or manual check-ins) — stop following right
  // away; there is nothing left to watch for.
  useEffect(() => {
    if (phase === 'result' && routeFinished) {
      setFollowing(false);
      stopBackgroundFollowing();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, routeFinished]);

  /**
   * The completion celebration must land *after* the per-park one, never
   * underneath it: stamping the last park marks the leg done and pushes
   * /stamp-success from the same handler, and flipping the phase in a plain
   * effect flashed "Route complete!" under the push. Any render-time gate is
   * unreliable here — the tab still reads as focused in that render, and once
   * covered it may not render at all until it is uncovered. So the flip only
   * ever happens on a focus transition: the stamp screen (and any milestone /
   * park detail) plays out first, and coming back to this tab celebrates the
   * route. Mount counts as a focus transition, which also covers relaunching
   * the app with an already-finished route.
   */
  const completionPending = phase === 'result' && routeFinished;
  const completionPendingRef = useRef(completionPending);
  useEffect(() => {
    completionPendingRef.current = completionPending;
  }, [completionPending]);
  useFocusEffect(
    useCallback(() => {
      if (completionPendingRef.current) setPhase('complete');
    }, []),
  );

  const manualArrived = (parkId: string) => {
    const park = parkById(parkId);
    if (park) setArrivalPark(park);
  };

  // ---------- render ----------

  if (phase === 'computing') {
    // Spec: self-drawing dashed route (@keyframes dashh) + bouncing dots (bnc)
    return (
      <View style={[styles.center, { backgroundColor: ground.bg }]}>
        <Animated.View entering={FadeIn}>
          <RouteDoodle />
        </Animated.View>
        <Heading style={{ fontSize: 24 }}>{t('optimising')}</Heading>
        <LoaderDots />
      </View>
    );
  }

  if (phase === 'complete' || (remaining.length === 0 && phase === 'setup')) {
    const doneLegs = activeRoute?.legs.filter((l) => l.done) ?? [];
    const dayKm = doneLegs.reduce((a, l) => a + l.distanceKm, 0);
    // The stamps this route actually earned, in visiting order (freshest last,
    // so it fans in on top); at most the three the fan has room for.
    const fanIds = (
      doneLegs.length > 0 ? doneLegs.map((l) => l.parkId) : [...recentStampIds].reverse()
    ).slice(-3);
    const fan = STAMP_FAN[fanIds.length - 1] ?? [];
    return (
      <View style={[styles.center, { backgroundColor: categories.forest.tint }]}>
        {/* Spec: popin + confetti fall on the completion moment */}
        <ConfettiRain count={26} duration={3600} />
        <View style={styles.completeStage}>
          {fan.map((slot, i) => (
            <View key={fanIds[i]} style={styles.completeStampSlot}>
              <PopIn duration={1000} delay={slot.delay}>
                <View style={{ transform: [{ translateX: slot.dx }] }}>
                  <StampView parkId={fanIds[i]} size={slot.size} stamped rotation={slot.rotation} />
                </View>
              </PopIn>
            </View>
          ))}
        </View>
        <Heading style={{ fontSize: 34, textAlign: 'center' }}>
          {remaining.length === 0 ? t('allDone') : t('routeCompleteTitle')}
        </Heading>
        {doneLegs.length > 0 ? (
          <Body style={{ textAlign: 'center', color: categories.forest.deep, fontSize: 17 }}>
            {doneLegs.length} {t('parks')} · +{dayKm.toFixed(1)} km {t('legDistanceAdded')}
          </Body>
        ) : null}
        <PillButton
          label={t('done')}
          color={categories.forest.ink}
          style={{ alignSelf: 'stretch' }}
          onPress={() => {
            stopBackgroundFollowing();
            setActiveRoute(null);
            setPhase('setup');
          }}
        />
      </View>
    );
  }

  if (phase === 'preview') {
    // Editable preview (design 3c) — nothing is saved until "Save & start".
    const mapH = Math.round(height * 0.34);
    const totalMin = tripMinutes(plan.totalKm, plan.stops.length, mode);
    const hours = Math.max(1, Math.round(totalMin / 60));
    // Faded, tappable candidates near the corridor (cheapest detours first)
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
            onPress={() => setPhase('setup')}
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
                <View key={p.id} style={[styles.previewRow, styles.swapRow, { borderColor: pal.ink, backgroundColor: pal.tint }]}>
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

  if (phase === 'result' && activeRoute) {
    const legs = activeRoute.legs;
    const stops = legs
      .map((l, i) => ({ park: parkById(l.parkId)!, index: i + 1 }))
      .filter((s) => !!s.park);
    const totalKm = legs.reduce((a, l) => a + l.distanceKm, 0);
    const totalMin = legs.reduce((a, l) => a + l.durationMin, 0);
    const hours = totalMin / 60;
    const modeLabel = activeRoute.mode === 'walk' ? t('walking') : activeRoute.mode === 'bike' ? t('cycling') : t('transit');
    const firstOpen = legs.find((l) => !l.done);

    // The expanded sheet always leaves a map strip visible at the top.
    const mapStrip = insets.top + 220;
    // Collapsed shows exactly the handle + title line, nothing more.
    const sheetCollapsedH = 76;
    const sheetExpandedH = height - mapStrip;
    const sheetRange = sheetExpandedH - sheetCollapsedH;
    // The map view is taller than the screen and simply slides by half the
    // sheet travel — pixel-consistent, exactly reversible, follows the drag.
    const mapShift = sheetRange / 2;
    const mapTranslate = sheetY.interpolate({
      inputRange: [0, sheetRange],
      outputRange: [-mapShift, 0],
      extrapolate: 'clamp',
    });

    return (
      <View style={{ flex: 1, backgroundColor: ground.bg }}>
        <RNAnimated.View style={{ transform: [{ translateY: mapTranslate }] }}>
          <ParkMap
            width={width}
            height={height + mapShift}
            parks={stops.map((s) => s.park)}
            stampedIds={stampedIds}
            routeStops={stops}
            routeGeometry={routeGeometry}
            anchors={
              activeRoute.startPoint
                ? { start: activeRoute.startPoint, end: activeRoute.endPoint }
                : undefined
            }
            userLocation={userLoc}
            cameraPadding={{
              // Fit targets the strip visible while expanded (initial state),
              // expressed in the taller map view's own coordinates.
              top: insets.top + 56 + mapShift,
              bottom: sheetExpandedH + 24,
              left: 28,
              right: 28,
            }}
          />
        </RNAnimated.View>
        <View style={[styles.dayBadge, { top: insets.top + 8 }]}>
          <Text style={styles.dayBadgeText}>
            {t(activeRoute.kind === 'custom' ? 'customTrip' : 'quickTrip')} · {modeLabel.toLowerCase()}
          </Text>
        </View>

        <SnapBottomSheet
          collapsedHeight={sheetCollapsedH}
          expandedHeight={sheetExpandedH}
          initiallyExpanded
          sheetY={sheetY}
          header={
            <Heading style={{ fontSize: 24 }} numberOfLines={1}>
              {legs.length} {t('parks')} · {totalKm.toFixed(1)} km · ~{hours.toFixed(0)} h
            </Heading>
          }
        >
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 24, gap: 12 }}
          >
            {/* Collapsible content only — nothing here occupies the sheet's
                always-visible (title) band when collapsed. */}
            <View style={styles.sheetTopRow}>
              <View style={{ flex: 1 }}>
                {offlineNote ? (
                  <Body style={{ color: ground.textMuted, fontSize: 13.5 }}>{t('routeOfflineFallback')}</Body>
                ) : null}
                {activeRoute.mode === 'transit' ? (
                  <Body style={{ color: ground.textMuted, fontSize: 14 }}>{t('transitNote')}</Body>
                ) : null}
              </View>
              <Pressable accessibilityRole="button" onPress={reoptimise}>
                <Text style={styles.reoptimise}>{t('reOptimise')}</Text>
              </Pressable>
            </View>
          {legs.map((leg, i) => {
            const park = parkById(leg.parkId);
            if (!park) return null;
            const isNext = firstOpen?.parkId === leg.parkId;
            const canUp = !leg.done && i > 0 && !legs[i - 1].done;
            const canDown = !leg.done && i < legs.length - 1 && !legs[i + 1].done;
            const canRemove = !leg.done && legs.length > 1;
            return (
              <Animated.View key={leg.parkId} entering={FadeInDown.delay(i * 60)}>
                <View
                  style={[
                    styles.legRow,
                    isNext && { backgroundColor: categories.forest.tint },
                    leg.done && { opacity: 0.55 },
                  ]}
                >
                  <Text style={styles.legIndex}>{i + 1}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.legTitle}>{park.name}</Text>
                    <Text style={styles.legSub}>
                      {i === 0 ? '' : '+'}
                      {leg.distanceKm.toFixed(1)} km · {leg.durationMin} {activeRoute.mode === 'walk' ? t('minWalk') : t('min')}
                    </Text>
                  </View>
                  {isNext ? (
                    <PillButton
                      label={t('navigate')}
                      onPress={() => navigateNative(park, activeRoute.mode)}
                      style={{ paddingVertical: 10, minHeight: 42 }}
                      textStyle={{ fontSize: 15 }}
                    />
                  ) : leg.done ? (
                    <StampView parkId={park.id} size={36} stamped />
                  ) : null}
                  {!leg.done ? (
                    <View style={styles.legEdit}>
                      <View style={styles.legEditCol}>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`↑ ${park.name}`}
                          accessibilityHint={t('dragToReorder')}
                          disabled={!canUp}
                          onPress={() => moveLeg(i, -1)}
                          hitSlop={6}
                          style={[styles.legEditBtn, !canUp && { opacity: 0.3 }]}
                        >
                          <Text style={styles.legEditArrow}>↑</Text>
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`↓ ${park.name}`}
                          accessibilityHint={t('dragToReorder')}
                          disabled={!canDown}
                          onPress={() => moveLeg(i, 1)}
                          hitSlop={6}
                          style={[styles.legEditBtn, !canDown && { opacity: 0.3 }]}
                        >
                          <Text style={styles.legEditArrow}>↓</Text>
                        </Pressable>
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`${t('removeStop')}: ${park.name}`}
                        disabled={!canRemove}
                        onPress={() => removeLeg(i)}
                        hitSlop={6}
                        style={[styles.legRemoveBtn, !canRemove && { opacity: 0.3 }]}
                      >
                        <Icon name="x" size={15} color={ground.textMuted} />
                      </Pressable>
                    </View>
                  ) : null}
                </View>
                {isNext && activeRoute.following ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => manualArrived(leg.parkId)}
                    style={styles.arrivedLink}
                  >
                    <Text style={styles.arrivedLinkText}>{t('arrivedMarkDone')}</Text>
                  </Pressable>
                ) : null}
              </Animated.View>
            );
          })}
          </ScrollView>

          {/* Sheet content already ends at the tab bar (skirt-compensated) —
              no extra safe-area padding needed here. */}
          <View style={[styles.resultFooter, { paddingBottom: 8 }]}>
            {activeRoute.following ? (
              <PillButton label={t('endRoute')} variant="outline" style={{ flex: 1 }} onPress={() => setStopVisible(true)} />
            ) : (
              <>
                <PillButton label={t('startRoute')} style={{ flex: 2 }} onPress={startFollowing} />
                <PillButton
                  label={t('cancel')}
                  variant="ghost"
                  style={{ flex: 1 }}
                  onPress={() => {
                    stopBackgroundFollowing();
                    setActiveRoute(null);
                    setPhase('setup');
                  }}
                />
              </>
            )}
          </View>
        </SnapBottomSheet>

        {/* Location primer (contextual, before OS dialog — spec) */}
        <Dialog visible={primerVisible} onClose={() => setPrimerVisible(false)}>
          <Heading style={{ fontSize: 24, textAlign: 'center' }}>{t('followPrimerLocTitle')}</Heading>
          <Body style={{ textAlign: 'center', color: ground.textMuted }}>{t('followPrimerLocBody')}</Body>
          <PillButton label={t('followPrimerLocOk')} onPress={enableTracking} />
          <PillButton label={t('followPrimerLocSkip')} variant="ghost" onPress={skipTracking} />
        </Dialog>

        {/* Notifications primer */}
        <Dialog visible={notifPrimerVisible} onClose={() => setNotifPrimerVisible(false)}>
          <Heading style={{ fontSize: 24, textAlign: 'center' }}>{t('followPrimerNotifTitle')}</Heading>
          <Body style={{ textAlign: 'center', color: ground.textMuted }}>{t('followPrimerNotifBody')}</Body>
          <PillButton
            label={t('followPrimerNotifOk')}
            onPress={() => {
              setNotifPrimerVisible(false);
              requestNotifPermission();
            }}
          />
          <PillButton label={t('maybeLater')} variant="ghost" onPress={() => setNotifPrimerVisible(false)} />
        </Dialog>

        {/* Stop-following confirmation */}
        <Dialog visible={stopVisible} onClose={() => setStopVisible(false)}>
          <Heading style={{ fontSize: 24, textAlign: 'center' }}>{t('stopFollowing')}</Heading>
          <Body style={{ textAlign: 'center', color: ground.textMuted }}>{t('stopFollowingBody')}</Body>
          <PillButton label={t('stop')} variant="outline" onPress={stopFollowing} />
          <PillButton label={t('keepFollowing')} onPress={() => setStopVisible(false)} />
        </Dialog>

        {/* Arrival popup — themed by park category (spec 4.2). Shows the
            mystery ("?") stamp; "Add the stamp" launches the full-screen
            stamp celebration. */}
        <Dialog visible={!!arrivalPark} onClose={() => setArrivalPark(null)}>
          {arrivalPark ? (
            <>
              {/* Spec: dialog stamp pops in (@keyframes popin, .9s) */}
              <PopIn duration={900} style={{ alignItems: 'center' }}>
                <StampView parkId={arrivalPark.id} size={120} stamped={false} />
              </PopIn>
              <View style={[styles.stopPill, { backgroundColor: categories[arrivalPark.category].tint }]}>
                <Text style={[styles.stopPillText, { color: categories[arrivalPark.category].deep }]}>
                  {t(arrivalPark.category)} ·{' '}
                  {t('stopOf', {
                    n: (activeRoute.legs.findIndex((l) => l.parkId === arrivalPark.id) ?? 0) + 1,
                    total: activeRoute.legs.length,
                  })}
                </Text>
              </View>
              <Heading style={{ fontSize: 27, textAlign: 'center' }}>
                {t('arrivedTitle', { park: arrivalPark.name })}
              </Heading>
              <Body style={{ textAlign: 'center', color: ground.textMuted }}>{t('arrivedSub')}</Body>
              <PillButton
                label={t('addTheStamp')}
                color={categories[arrivalPark.category].ink}
                onPress={handleArrivalStamp}
              />
              <PillButton label={t('notYetSearching')} variant="ghost" onPress={() => setArrivalPark(null)} />
              <Body style={{ textAlign: 'center', color: ground.textMuted, fontSize: 13.5 }}>
                {t('officialNote')}
              </Body>
            </>
          ) : null}
        </Dialog>
      </View>
    );
  }

  // ---------- setup ----------
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: ground.bg }}
      contentContainerStyle={{ paddingTop: insets.top + 16, padding: spacing.md, gap: spacing.md, flexGrow: 1 }}
    >
      <Heading>{t('routeTitle')}</Heading>

      <View style={styles.scopeRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: scope === 'quick' }}
          onPress={() => setScope('quick')}
          style={[styles.scopeCard, scope === 'quick' && styles.scopeCardActive]}
        >
          <Text style={styles.scopeTitle}>{t('quickTrip')}</Text>
          <Text style={styles.scopeSub}>{t('quickTripSub', { n: remaining.length })}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: scope === 'custom' }}
          onPress={() => setScope('custom')}
          style={[styles.scopeCard, scope === 'custom' && styles.scopeCardActive]}
        >
          <Text style={styles.scopeTitle}>{t('customTrip')}</Text>
          <Text style={styles.scopeSub}>{t('customTripSub')}</Text>
        </Pressable>
      </View>

      {/* Transit is hidden until timetable routing can be trusted (ZTP GTFS
          backend, okp-routing-backend-plan.md) — walk & bike only for now. */}
      <SectionLabel color={ground.text}>{t('transportMode')}</SectionLabel>
      <View style={styles.modeRow}>
        {(
          [
            ['walk', t('walking')],
            ['bike', t('cycling')],
          ] as [TransportMode, string][]
        ).map(([m, label]) => (
          <Pressable
            key={m}
            accessibilityRole="button"
            accessibilityState={{ selected: mode === m }}
            onPress={() => setMode(m)}
            style={[styles.modeItem, mode === m && styles.modeItemActive]}
          >
            <Text style={[styles.modeText, mode === m && styles.modeTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      <>
          {/* Start/end block with the dashed thread — shared by both modes (1m/3a/3b) */}
          <View style={styles.pointBlock}>
            <View style={styles.pointRow}>
              {!draft.roundTrip ? (
                // Dashed thread anchored to the first row: runs from just
                // below the start dot to just above the end flag, whatever
                // height the wrapped labels give the row. (RN doesn't support
                // dashed single-side borders, hence the dot segments.)
                <View style={styles.pointThread}>
                  {Array.from({ length: 7 }).map((_, i) => (
                    <View key={i} style={styles.pointThreadDash} />
                  ))}
                </View>
              ) : null}
              <View style={[styles.pointDot, { backgroundColor: ground.accent2 }]}>
                <Icon name="locate" size={14} color={ground.white} />
                {draft.roundTrip ? <View style={styles.loopHalo} /> : null}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingTitle}>
                  {draft.roundTrip ? t('startAndEnd') : t('tripStart')} · {tripStart.label}
                </Text>
                <Text style={styles.settingSub}>
                  {draft.roundTrip ? t('loopBackHere') : tripStart.kind === 'current' ? 'GPS' : ''}
                </Text>
              </View>
              <Pressable accessibilityRole="button" hitSlop={8} onPress={() => setPointPicking('start')}>
                <Text style={styles.changeLink}>{t('change')}</Text>
              </Pressable>
            </View>
            {!draft.roundTrip ? (
              <View style={styles.pointRow}>
                <View style={[styles.pointDot, { backgroundColor: ground.accent }]}>
                  <Icon name="flag" size={14} color={ground.white} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingTitle}>
                    {t('tripEnd')} · {draft.end ? draft.end.label : t('tripStart')}
                  </Text>
                  <Text style={styles.settingSub}>{draft.end ? '' : t('endHint')}</Text>
                </View>
                <Pressable accessibilityRole="button" hitSlop={8} onPress={() => setPointPicking('end')}>
                  <Text style={styles.changeLink}>{t('change')}</Text>
                </Pressable>
              </View>
            ) : null}
          </View>

          {/* Round trip toggle — folds the end row into the start row */}
          <View style={[styles.srow, draft.roundTrip && { backgroundColor: categories.forest.tint }]}>
            <Icon name="route" size={20} color={categories.forest.deep} />
            <View style={{ flex: 1 }}>
              <Text style={styles.settingTitle}>{t('roundTrip')}</Text>
              <Text style={styles.settingSub}>
                {draft.roundTrip
                  ? t(scope === 'quick' ? 'quickRoundTripOnSub' : 'roundTripOnSub')
                  : t('roundTripSub')}
              </Text>
            </View>
            <Switch
              value={draft.roundTrip}
              onValueChange={draft.setRoundTrip}
              trackColor={{ true: categories.forest.ink, false: ground.surface }}
              thumbColor={ground.white}
              accessibilityLabel={t('roundTrip')}
            />
          </View>

          {/* Parks along the way — auto-fill stepper */}
          <View style={styles.srow}>
            <Icon name="stamp" size={20} color={categories.forest.deep} />
            <View style={{ flex: 1 }}>
              <Text style={styles.settingTitle}>
                {t(scope === 'quick' ? 'parksOnTrip' : 'parksAlongWay')}
              </Text>
              <Text style={styles.settingSub}>
                {scope === 'quick'
                  ? t('parksOnTripSub')
                  : isLoop
                    ? t('parksAlongWayLoopSub')
                    : t('parksAlongWaySub')}
              </Text>
            </View>
            <View style={styles.stepper}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="-"
                accessibilityState={{ disabled: autoCount <= minAutoCount }}
                disabled={autoCount <= minAutoCount}
                onPress={() => draft.setAutoCount(scope, autoCount - 1)}
                style={[styles.stepBtn, autoCount <= minAutoCount && styles.stepBtnDisabled]}
              >
                <Text style={styles.stepText}>–</Text>
              </Pressable>
              <Text style={styles.stepCount}>{autoCount}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="+"
                accessibilityState={{ disabled: autoCount >= maxAutoCount }}
                disabled={autoCount >= maxAutoCount}
                onPress={() => draft.setAutoCount(scope, Math.min(autoCount + 1, maxAutoCount))}
                style={[styles.stepBtn, autoCount >= maxAutoCount && styles.stepBtnDisabled]}
              >
                <Text style={styles.stepText}>+</Text>
              </Pressable>
            </View>
          </View>

          {/* Hand-picker entry — custom trips only */}
          {scope === 'custom' ? (
            <View style={styles.srow}>
            <Icon name="pin" size={20} color={categories.forest.deep} />
            <View style={{ flex: 1 }}>
              <Text style={styles.settingTitle}>{t('pickMyself')}</Text>
              <Text style={styles.settingSub}>
                {draft.lockedIds.length > 0
                  ? t('selectedCount', { n: draft.lockedIds.length })
                  : t('pickMyselfSub')}
              </Text>
            </View>
            <PillButton
              label={t('choose')}
              variant="outline"
              onPress={() => setTripPickerVisible(true)}
              style={{ paddingVertical: 8, paddingHorizontal: 16, minHeight: 38 }}
              textStyle={{ fontSize: 14 }}
            />
            </View>
          ) : null}
      </>

      {/* Nudges: quick surfaces clustering (spec 4.2); custom previews the corridor */}
      {scope === 'quick' ? (
        nearbyCount >= 2 ? (
          <View style={[styles.nudgeBox, { flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
            <Icon name="pin" size={18} color={categories.forest.deep} />
            <Body style={{ flex: 1, color: categories.forest.deep, fontSize: 14.5 }}>
              {t('quickNudge', { n: nearbyCount })}
            </Body>
          </View>
        ) : null
      ) : isLoop ? (
        <View style={styles.nudgeBox}>
          <View style={{ alignItems: 'center' }}>
            <RouteDoodle width={200} height={100} />
          </View>
          <Body style={{ color: categories.forest.deep, textAlign: 'center', fontSize: 14.5 }}>
            {t('loopPreview', { n: plan.stops.length, km: plan.totalKm.toFixed(1) })}
          </Body>
        </View>
      ) : (
        <View style={[styles.nudgeBox, { flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
          <Icon name="pin" size={18} color={categories.forest.deep} />
          <Body style={{ flex: 1, color: categories.forest.deep, fontSize: 14.5 }}>
            {t('nudgeFit', { n: plan.autoIds.length, km: plan.extraKm.toFixed(1) })}
          </Body>
        </View>
      )}

      <View style={{ flex: 1 }} />
      <PillButton
        label={scope === 'custom' ? t('previewRoute') : t('generateRoute')}
        onPress={generate}
        // A custom trip with 0 auto-picks and no hand-picks has nothing to preview.
        disabled={scope === 'custom' && plan.stops.length === 0}
        style={{ marginBottom: insets.bottom + 6 }}
      />

      {/* Start/end point chooser (GPS · park · map tap) */}
      <TripPointPicker
        visible={pointPicking !== null}
        title={pointPicking === 'end' ? t('endPoint') : t('startPoint')}
        userLoc={userLoc}
        currentLocationLabel={t('currentLocation')}
        onPick={handlePointPicked}
        onClose={() => setPointPicking(null)}
      />

      {/* Hand-picker (3d/3e) */}
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24, padding: spacing.lg },
  completeStage: { width: 300, height: 170 },
  completeStampSlot: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayBadge: {
    position: 'absolute',
    left: spacing.md,
    backgroundColor: ground.dark,
    borderRadius: radii.pill,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  dayBadgeText: { color: ground.white, fontFamily: fonts.bodySemi, fontSize: 14 },
  sheetTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 8,
    minHeight: 24,
  },
  reoptimise: { fontFamily: fonts.bodyBold, color: ground.accent, fontSize: 15.5 },
  legRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: ground.surfaceLight,
    borderRadius: radii.lg,
    padding: spacing.md,
    minHeight: 72,
  },
  legIndex: { fontFamily: fonts.bodyBold, fontSize: 16, color: ground.textMuted, width: 18, textAlign: 'center' },
  legTitle: { fontFamily: fonts.bodySemi, fontSize: 16.5, color: ground.text },
  legSub: { fontFamily: fonts.body, fontSize: 14.5, color: ground.textMuted, marginTop: 2 },
  legEdit: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  legEditCol: { justifyContent: 'center' },
  legEditBtn: { minWidth: 34, minHeight: 32, alignItems: 'center', justifyContent: 'center' },
  legEditArrow: { fontFamily: fonts.bodyBold, fontSize: 16, color: ground.textMuted },
  legRemoveBtn: { minWidth: 34, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  arrivedLink: { alignSelf: 'center', paddingVertical: 8 },
  arrivedLinkText: { fontFamily: fonts.bodyBold, color: ground.accent2, fontSize: 15 },
  resultFooter: { flexDirection: 'row', gap: 10, paddingTop: 8 },
  stopPill: { alignSelf: 'center', borderRadius: radii.pill, paddingVertical: 6, paddingHorizontal: 14 },
  stopPillText: { fontFamily: fonts.bodySemi, fontSize: 14.5 },
  scopeRow: { flexDirection: 'row', gap: 12 },
  scopeCard: {
    flex: 1,
    backgroundColor: ground.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    minHeight: 120,
    justifyContent: 'center',
    gap: 6,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  scopeCardActive: { borderColor: ground.accent, backgroundColor: ground.surfaceLight },
  scopeTitle: { fontFamily: fonts.bodyBold, fontSize: 17.5, color: ground.text },
  scopeSub: { fontFamily: fonts.body, fontSize: 14.5, color: ground.textMuted },
  modeRow: {
    flexDirection: 'row',
    backgroundColor: ground.surfaceLight,
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  modeItem: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  modeItemActive: { backgroundColor: ground.accent, borderRadius: radii.pill },
  modeText: { fontFamily: fonts.body, fontSize: 16, color: ground.text },
  modeTextActive: { color: ground.white, fontFamily: fonts.bodySemi },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  settingTitle: { fontFamily: fonts.bodySemi, fontSize: 16.5, color: ground.text },
  settingSub: { fontFamily: fonts.body, fontSize: 14.5, color: ground.textMuted, marginTop: 2 },
  changeLink: { fontFamily: fonts.bodyBold, color: ground.accent, fontSize: 15.5 },
  stepper: {
    flexDirection: 'row',
    backgroundColor: ground.surface,
    borderRadius: radii.pill,
    alignItems: 'center',
  },
  stepBtn: { paddingVertical: 10, paddingHorizontal: 18, minWidth: 48, alignItems: 'center' },
  stepBtnDisabled: { opacity: 0.35 },
  stepText: { fontFamily: fonts.bodyBold, fontSize: 18, color: ground.text },
  stepCount: { fontFamily: fonts.bodyBold, fontSize: 16, color: ground.text, minWidth: 20, textAlign: 'center' },
  stepDivider: { width: 1, height: 22, backgroundColor: 'rgba(32,30,29,0.12)' },
  hintBox: { backgroundColor: categories.forest.tint, borderRadius: radii.lg, padding: spacing.md },
  // ---- custom trip setup (design 3a/3b) ----
  pointBlock: {
    backgroundColor: ground.surfaceLight,
    borderRadius: radii.lg,
    paddingVertical: 4,
    position: 'relative',
  },
  pointThread: {
    position: 'absolute',
    left: 28,
    // Just below the start dot (12 pad + 27 dot − 2 offset + 3 gap)…
    top: 40,
    // …to just above the next row's dot (12 pad − 2 offset − 1 gap below row).
    bottom: -9,
    width: 2,
    justifyContent: 'space-between',
  },
  pointThreadDash: { width: 2, height: 5, borderRadius: 1, backgroundColor: 'rgba(32,30,29,0.25)' },
  pointRow: {
    flexDirection: 'row',
    // Top-align so the dot stays on the first text line when labels wrap.
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  pointDot: {
    width: 27,
    height: 27,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    // Optically centers the 27px dot on the ~22px first text line.
    marginTop: -2,
  },
  loopHalo: {
    position: 'absolute',
    top: -5,
    left: -5,
    right: -5,
    bottom: -5,
    borderRadius: 20,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: ground.accent2,
  },
  srow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: ground.surfaceLight,
    borderRadius: radii.lg,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  nudgeBox: {
    backgroundColor: categories.forest.tint,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: 6,
  },
  // ---- preview (design 3c) ----
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
  previewRowTitle: { fontFamily: fonts.bodySemi, fontSize: 14.5, color: ground.text },
  previewRowSub: { fontFamily: fonts.body, fontSize: 12.5, color: ground.textMuted, marginTop: 1 },
  addHintRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4, paddingTop: 2 },
  addHintText: { fontFamily: fonts.bodySemi, fontSize: 13, color: ground.textMuted },
  previewFooter: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingTop: 8,
  },
});
