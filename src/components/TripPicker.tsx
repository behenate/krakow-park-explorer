import React, { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { ParkMap } from '@/components/ParkMap';
import { Chip, PillButton } from '@/components/ui';
import { detourKm, GeoPoint } from '@/lib/corridor';
import { Park, parks } from '@/data/parks';
import { localeTag, useI18n } from '@/i18n';
import { useAppStore } from '@/store';
import { useTripDraft } from '@/store/tripDraft';
import { categories, fonts, ground, radii, spacing } from '@/theme/tokens';

/**
 * Hand-picker for custom trips (design 3d/3e): full-screen Map/List picker.
 * Checked = already in the trip (tap to remove); everything else shows its
 * live detour cost. Hand-picks are locked — auto-fill never drops them.
 * Switching Map/List never loses picks (both read the same draft store).
 */

interface Props {
  visible: boolean;
  onClose: () => void;
  start: GeoPoint;
  end: GeoPoint;
  /** Current planned stops, in order (locked + auto). */
  stops: Park[];
  autoIds: Set<string>;
  stampedIds: Set<string>;
  totalKm: number;
}

type Segment = 'map' | 'list';
type Filter = 'near' | 'all' | 'unstamped';

const NEAR_KM = 3;

export function TripPicker({ visible, onClose, start, end, stops, autoIds, stampedIds, totalKm }: Props) {
  const { t, lang } = useI18n();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [segment, setSegment] = useState<Segment>('map');
  const [filter, setFilter] = useState<Filter>('near');
  const [callout, setCallout] = useState<Park | null>(null);

  const visits = useAppStore((s) => s.visits);
  const lockedIds = useTripDraft((s) => s.lockedIds);
  const toggleLocked = useTripDraft((s) => s.toggleLocked);
  const excludeAuto = useTripDraft((s) => s.excludeAuto);
  const clearLocked = useTripDraft((s) => s.clearLocked);

  const inTripIds = useMemo(() => new Set(stops.map((p) => p.id)), [stops]);

  /** Candidates with live insertion cost, cheapest first. */
  const candidates = useMemo(
    () =>
      parks
        .filter((p) => !inTripIds.has(p.id))
        .map((p) => ({ park: p, detour: detourKm(p, start, stops, end) }))
        .sort((a, b) => a.detour - b.detour),
    [inTripIds, start.lat, start.lng, end.lat, end.lng, stops],
  );

  const filtered = candidates.filter(({ park, detour }) => {
    if (filter === 'near') return detour <= NEAR_KM;
    if (filter === 'unstamped') return !stampedIds.has(park.id);
    return true;
  });

  const removeFromTrip = (parkId: string) => {
    if (lockedIds.includes(parkId)) toggleLocked(parkId);
    else excludeAuto(parkId);
    setCallout(null);
  };

  const addToTrip = (parkId: string) => {
    toggleLocked(parkId);
    setCallout(null);
  };

  const tally = t('pickedTally', {
    picked: lockedIds.length,
    auto: [...autoIds].length,
    km: totalKm.toFixed(1),
  });

  const stampedDate = (parkId: string) => {
    const v = visits[parkId];
    const date = v
      ? new Date(v.stampedAt).toLocaleDateString(localeTag(lang), {
          day: 'numeric',
          month: 'short',
        })
      : '';
    return `${t('stampedOn').toLowerCase()} ${date}`.trim();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.wrap, { paddingTop: insets.top + 6 }]}>
        {/* Header: back + title + Map/List segment */}
        <View style={styles.headerRow}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('back')} onPress={onClose} style={styles.backBtn}>
            <Icon name="back" size={18} color={ground.text} />
          </Pressable>
          <Text style={styles.title} numberOfLines={1}>
            {t('addParksToTrip')}
          </Text>
          <View style={styles.segment}>
            {(['map', 'list'] as Segment[]).map((s) => (
              <Pressable
                key={s}
                accessibilityRole="button"
                accessibilityState={{ selected: segment === s }}
                onPress={() => setSegment(s)}
                style={[styles.segOpt, segment === s && styles.segOptActive]}
              >
                <Text style={[styles.segText, segment === s && styles.segTextActive]}>
                  {s === 'map' ? t('mapView') : t('listView')}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {segment === 'map' ? (
          <View style={{ flex: 1 }}>
            <ParkMap
              width={width}
              height={height}
              parks={[]}
              stampedIds={stampedIds}
              routeStops={stops.map((park, i) => ({ park, index: i + 1 }))}
              anchors={{ start, end }}
              // Adding/removing picks must not reset the camera
              fitOnce
              candidates={filtered.map((c) => c.park)}
              onSelectCandidate={setCallout}
              onSelect={(p) => {
                // tapping an in-trip numbered stop removes it
                if (inTripIds.has(p.id)) removeFromTrip(p.id);
              }}
            />
            {callout ? (
              <View style={[styles.callout, { bottom: 12 }]}>
                <Text style={styles.calloutText} numberOfLines={1}>
                  {callout.name} · {t('detourAdd', { km: detourKm(callout, start, stops, end).toFixed(1) })}
                </Text>
                <Pressable accessibilityRole="button" onPress={() => addToTrip(callout.id)}>
                  <Text style={styles.calloutAdd}>{t('add')}</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            <View style={styles.filterRow}>
              <Chip label={t('nearRoute')} active={filter === 'near'} onPress={() => setFilter('near')} />
              <Chip label={t('allParksFilter')} active={filter === 'all'} onPress={() => setFilter('all')} />
              <Chip label={t('unstamped')} active={filter === 'unstamped'} onPress={() => setFilter('unstamped')} />
            </View>
            <ScrollView contentContainerStyle={{ padding: spacing.md, paddingTop: 4, gap: 8, paddingBottom: 20 }}>
              {/* In-trip rows first (design 3e) */}
              {stops.map((p, i) => (
                <View key={p.id} style={[styles.row, { backgroundColor: '#e9efdc' }]}>
                  <View style={[styles.catDot, { backgroundColor: categories[p.category].ink }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{p.name}</Text>
                    <Text style={styles.rowSub}>{t('inTripStop', { n: i + 1 })}</Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${t('removeStop')}: ${p.name}`}
                    onPress={() => removeFromTrip(p.id)}
                    style={styles.checkCircle}
                  >
                    <Icon name="check" size={13} color={ground.white} />
                  </Pressable>
                </View>
              ))}
              {filtered.map(({ park, detour }) => {
                const stamped = stampedIds.has(park.id);
                return (
                  <View key={park.id} style={[styles.row, stamped && { opacity: 0.55 }]}>
                    <View style={[styles.catDot, { backgroundColor: categories[park.category].ink }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle}>{park.name}</Text>
                      <Text style={styles.rowSub}>
                        {stamped ? stampedDate(park.id) : t('detourAdd', { km: detour.toFixed(1) })}
                      </Text>
                    </View>
                    <PillButton
                      label={stamped ? t('addAnyway') : t('add')}
                      variant={stamped ? 'ghost' : 'outline'}
                      onPress={() => addToTrip(park.id)}
                      style={styles.addBtn}
                      textStyle={{ fontSize: 13.5 }}
                    />
                  </View>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Shared footer (design: identical in map & list) */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + 10 }]}>
          <View style={styles.footerRow}>
            <Text style={styles.tally}>{tally}</Text>
            <Pressable accessibilityRole="button" onPress={clearLocked}>
              <Text style={styles.clearPicks}>{t('clearPicks')}</Text>
            </Pressable>
          </View>
          <PillButton label={t('doneBackToPreview')} onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: ground.bg },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: spacing.md,
    paddingBottom: 8,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: ground.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { flex: 1, fontFamily: fonts.heading, fontSize: 20, color: ground.text },
  segment: {
    flexDirection: 'row',
    backgroundColor: ground.surfaceLight,
    borderRadius: radii.pill,
    padding: 3,
  },
  segOpt: { paddingVertical: 7, paddingHorizontal: 14, borderRadius: radii.pill },
  segOptActive: { backgroundColor: ground.accent },
  segText: { fontFamily: fonts.bodySemi, fontSize: 13.5, color: ground.text },
  segTextActive: { color: ground.white },
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: spacing.md, paddingBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: ground.surfaceLight,
    borderRadius: radii.lg,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  catDot: { width: 11, height: 11, borderRadius: 6 },
  rowTitle: { fontFamily: fonts.bodySemi, fontSize: 15.5, color: ground.text },
  rowSub: { fontFamily: fonts.body, fontSize: 13, color: ground.textMuted, marginTop: 1 },
  checkCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: ground.accent2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtn: { paddingVertical: 7, paddingHorizontal: 14, minHeight: 34 },
  callout: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: ground.dark,
    borderRadius: radii.md,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  calloutText: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 13.5, color: ground.white },
  calloutAdd: { fontFamily: fonts.bodyBold, fontSize: 14.5, color: '#e8b98a' },
  footer: {
    backgroundColor: ground.surfaceLight,
    paddingHorizontal: spacing.md,
    paddingTop: 10,
    gap: 8,
    shadowColor: '#2e2b25',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tally: { fontFamily: fonts.bodySemi, fontSize: 13.5, color: ground.text },
  clearPicks: { fontFamily: fonts.bodyBold, fontSize: 13.5, color: ground.accent },
});
