import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { MapBottomSheet, SHEET_OVERSHOOT } from '@/components/MapBottomSheet';
import { ParkMap } from '@/components/ParkMap';
import { StampView } from '@/components/StampView';
import { Body, Chip, Heading, PillButton, StampRing } from '@/components/ui';
import { DISTRIBUTION_POINTS } from '@/config';
import { distanceKm, KRAKOW_CENTER, Park, parks, TOTAL_PARKS } from '@/data/parks';
import { useOnline } from '@/hooks/useOnline';
import { useUserLocation } from '@/hooks/useUserLocation';
import { useI18n } from '@/i18n';
import { openNativeMaps } from '@/lib/nativeMaps';
import { useAppStore } from '@/store';
import { CategoryId, categories, fonts, ground, radii, spacing } from '@/theme/tokens';

type CategoryFilter = CategoryId | 'all' | 'unstamped';
type SortMode = 'nearest' | 'az' | 'category';

export default function ExploreScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const visits = useAppStore((s) => s.visits);
  const userLoc = useUserLocation();
  const online = useOnline();

  const [view, setView] = useState<'map' | 'list'>('map');
  const [filter, setFilter] = useState<CategoryFilter>('all');
  const [sort, setSort] = useState<SortMode>('nearest');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Park | null>(null);

  const stampedIds = useMemo(() => new Set(Object.keys(visits)), [visits]);
  const origin = userLoc ?? KRAKOW_CENTER;

  const filtered = useMemo(() => {
    let list = parks;
    if (filter === 'unstamped') list = list.filter((p) => !stampedIds.has(p.id));
    else if (filter !== 'all') list = list.filter((p) => p.category === filter);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q));
    }
    const withD = list.map((p) => ({ p, d: distanceKm(origin.lat, origin.lng, p.lat, p.lng) }));
    if (sort === 'nearest') withD.sort((a, b) => a.d - b.d);
    else if (sort === 'az') withD.sort((a, b) => a.p.name.localeCompare(b.p.name, 'pl'));
    else withD.sort((a, b) => a.p.category.localeCompare(b.p.category) || a.d - b.d);
    return withD;
  }, [filter, query, sort, stampedIds, origin]);

  const categoryLabel = (c: CategoryId) => t(c);

  const filterChips = (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipRow}
      style={{ flexGrow: 0 }}
    >
      <Chip label={`${t('all')} ${TOTAL_PARKS}`} active={filter === 'all'} onPress={() => setFilter('all')} />
      {(Object.keys(categories) as CategoryId[]).map((c) => (
        <Chip
          key={c}
          label={categoryLabel(c)}
          dotColor={categories[c].ink}
          active={filter === c}
          activeColor={categories[c].ink}
          onPress={() => setFilter(filter === c ? 'all' : c)}
        />
      ))}
      <Chip label={t('unstamped')} active={filter === 'unstamped'} onPress={() => setFilter(filter === 'unstamped' ? 'all' : 'unstamped')} />
    </ScrollView>
  );

  const viewToggle = (
    <View style={styles.toggle}>
      {(['map', 'list'] as const).map((v) => (
        <Pressable
          key={v}
          accessibilityRole="button"
          accessibilityState={{ selected: view === v }}
          onPress={() => setView(v)}
          style={[styles.toggleItem, view === v && styles.toggleItemActive]}
        >
          <Text style={[styles.toggleText, view === v && styles.toggleTextActive]}>
            {v === 'map' ? t('mapView') : t('listView')}
          </Text>
        </Pressable>
      ))}
    </View>
  );

  if (view === 'map') {
    return (
      <View style={{ flex: 1, backgroundColor: ground.bg }}>
        <ParkMap
          width={width}
          height={height}
          parks={filtered.map((f) => f.p)}
          stampedIds={stampedIds}
          selectedId={selected?.id}
          onSelect={(p) => setSelected(p)}
          userLocation={userLoc}
          distributionPoints={DISTRIBUTION_POINTS.map((d) => ({
            id: d.id,
            name: d.name,
            lat: d.lat,
            lng: d.lng,
            accessibilityLabel: `${t('distributionPoint')}: ${d.name}`,
          }))}
          onSelectDistribution={(d) => {
            const point = DISTRIBUTION_POINTS.find((p) => p.id === d.id);
            if (point) Linking.openURL(point.mapsUrl);
          }}
        />
        {/* Top overlay: filters + toggle */}
        <View style={[styles.mapTop, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
          <View style={styles.mapTopRow}>
            {!online ? (
              <View style={styles.offlineBanner}>
                <Text style={styles.offlineBannerText}>{t('offlineBanner')}</Text>
              </View>
            ) : null}
            {filterChips}
            {viewToggle}
          </View>
        </View>

        {/* Bottom sheet preview — draggable, dismiss by swiping down */}
        {selected ? (
          <MapBottomSheet
            key={selected.id}
            onDismiss={() => setSelected(null)}
            style={{ paddingBottom: SHEET_OVERSHOOT + insets.bottom + spacing.md }}
          >
            <View style={styles.sheetHeader}>
              <Heading style={{ fontSize: 26, flex: 1 }} numberOfLines={1}>
                {selected.name}
              </Heading>
              <View style={styles.stampBadge}>
                <StampView parkId={selected.id} size={46} stamped={stampedIds.has(selected.id)} />
              </View>
            </View>
            <View style={styles.sheetMeta}>
              <View style={[styles.metaPill, { backgroundColor: categories[selected.category].tint }]}>
                <Text style={[styles.metaPillText, { color: categories[selected.category].deep }]}>
                  {categoryLabel(selected.category)}
                </Text>
              </View>
              <Body style={{ color: ground.textMuted }}>
                {distanceKm(origin.lat, origin.lng, selected.lat, selected.lng).toFixed(1)} km ·{' '}
                {stampedIds.has(selected.id) ? t('stampedOn') : `○ ${t('notStamped')}`}
              </Body>
            </View>
            <View style={styles.sheetActions}>
              <PillButton label={t('details')} style={{ flex: 1 }} onPress={() => router.push(`/park/${selected.id}`)} />
              <PillButton
                label={t('navigate')}
                variant="outline"
                style={{ flex: 1 }}
                onPress={() => openNativeMaps(selected.lat, selected.lng, selected.name)}
              />
            </View>
          </MapBottomSheet>
        ) : null}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: ground.bg, paddingTop: insets.top + 8 }}>
      <View style={styles.listHeader}>
        <Heading>{t('tabExplore')}</Heading>
        {viewToggle}
      </View>
      <View style={styles.searchWrap}>
        <Icon name="search" size={18} color={ground.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('searchNParks', { n: TOTAL_PARKS })}
          placeholderTextColor={ground.textMuted}
          style={styles.searchInput}
          accessibilityLabel={t('searchNParks', { n: TOTAL_PARKS })}
        />
      </View>
      <View style={styles.sortRow}>
        <Chip label={t('nearest')} active={sort === 'nearest'} onPress={() => setSort('nearest')} />
        <Chip label={t('az')} active={sort === 'az'} onPress={() => setSort('az')} />
        <Chip label={t('category')} active={sort === 'category'} onPress={() => setSort('category')} />
      </View>
      {/* Category / un-stamped filters — same state as map view */}
      <View style={{ marginBottom: 10 }}>{filterChips}</View>
      {filtered.length === 0 ? (
        <View style={styles.empty}>
          <StampRing size={72} color={ground.surface} />
          <Body style={{ color: ground.textMuted }}>{t('noParksMatch')}</Body>
          <PillButton label={t('resetFilters')} variant="outline" onPress={() => { setQuery(''); setFilter('all'); }} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={({ p }) => p.id}
          contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: 24, gap: 12 }}
          renderItem={({ item: { p, d } }) => {
            const stamped = stampedIds.has(p.id);
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${p.name}, ${categoryLabel(p.category)}, ${d.toFixed(1)} km`}
                onPress={() => router.push(`/park/${p.id}`)}
                style={[styles.row, stamped && { backgroundColor: categories.forest.tint }]}
              >
                <View style={[styles.rowDot, { backgroundColor: categories[p.category].ink }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{p.name}</Text>
                  <Text style={styles.rowSub}>
                    {categoryLabel(p.category)} · {d.toFixed(1)} km
                  </Text>
                </View>
                {stamped ? (
                  <StampRing size={30} color={categories[p.category].deep} />
                ) : (
                  <View style={styles.rowEmpty} />
                )}
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  mapTop: { position: 'absolute', top: 0, left: 0, right: 0 },
  mapTopRow: { gap: 10 },
  offlineBanner: {
    alignSelf: 'center',
    backgroundColor: ground.dark,
    borderRadius: radii.pill,
    paddingVertical: 7,
    paddingHorizontal: 16,
  },
  offlineBannerText: { fontFamily: fonts.body, fontSize: 13.5, color: ground.white },
  chipRow: { gap: 8, paddingHorizontal: spacing.md },
  toggle: {
    flexDirection: 'row',
    backgroundColor: ground.surfaceLight,
    borderRadius: radii.pill,
    padding: 3,
    alignSelf: 'flex-end',
    marginRight: spacing.md,
  },
  toggleItem: { paddingVertical: 8, paddingHorizontal: 18, borderRadius: radii.pill },
  toggleItemActive: { backgroundColor: ground.accent },
  toggleText: { fontFamily: fonts.body, fontSize: 15, color: ground.text },
  toggleTextActive: { color: ground.white, fontFamily: fonts.bodySemi },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stampBadge: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: ground.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3a2c1a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 5,
  },
  stampBadgeArt: { width: 46, height: 46 },
  sheetMeta: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  metaPill: { borderRadius: radii.pill, paddingVertical: 5, paddingHorizontal: 12 },
  metaPillText: { fontFamily: fonts.bodySemi, fontSize: 14 },
  sheetActions: { flexDirection: 'row', gap: 12 },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    marginBottom: 10,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: ground.surface,
    borderRadius: radii.pill,
    paddingHorizontal: 16,
    marginHorizontal: spacing.md,
    minHeight: 48,
  },
  searchInput: { flex: 1, fontFamily: fonts.body, fontSize: 16, color: ground.text, paddingVertical: 12 },
  sortRow: { flexDirection: 'row', gap: 8, paddingHorizontal: spacing.md, marginTop: 12, marginBottom: 8, flexWrap: 'wrap' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: ground.surfaceLight,
    borderRadius: radii.lg,
    paddingVertical: 16,
    paddingHorizontal: spacing.md,
    minHeight: 72,
  },
  rowDot: { width: 12, height: 12, borderRadius: 6 },
  rowTitle: { fontFamily: fonts.bodySemi, fontSize: 17, color: ground.text },
  rowSub: { fontFamily: fonts.body, fontSize: 14.5, color: ground.textMuted, marginTop: 2 },
  rowEmpty: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: ground.textMuted,
    opacity: 0.5,
  },
  empty: { alignItems: 'center', gap: 14, marginTop: 60, paddingHorizontal: 40 },
});
