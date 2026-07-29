import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import ViewShot, { ViewShotRef } from 'react-native-view-shot';

import { Floaty, PopIn, RingFillCircle } from '@/components/motion';
import { photoExists, resolvePhotoUri } from '@/lib/photos';
import { Body, Chip, Heading, PillButton, SectionLabel, StampRing } from '@/components/ui';
import { WrappedCard, WrappedVariant } from '@/components/WrappedCard';
import { StampView } from '@/components/StampView';
import { Park, parks, TOTAL_PARKS } from '@/data/parks';
import { localeTag, useI18n } from '@/i18n';
import { photoUris, useAppStore } from '@/store';
import { CategoryId, categories, fonts, ground, radii, spacing } from '@/theme/tokens';

type Segment = 'progress' | 'stamps' | 'stats' | 'wrapped';

const CATEGORY_IDS = Object.keys(categories) as CategoryId[];

const SEGMENTS: Segment[] = ['progress', 'stamps', 'stats', 'wrapped'];

/** Gap between Wrapped carousel cards. */
const CARD_GAP = 14;

/** Plot height of the parks-per-month chart. */
const CHART_H = 110;

function isSegment(value: string | undefined): value is Segment {
  return !!value && (SEGMENTS as string[]).includes(value);
}

export default function BookletScreen() {
  const { t, lang } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { segment: segmentParam } = useLocalSearchParams<{ segment?: string }>();
  const visits = useAppStore((s) => s.visits);
  const distanceTotal = useAppStore((s) => s.distanceKmTotal);

  const [segment, setSegment] = useState<Segment>('progress');
  const [activeCard, setActiveCard] = useState(0);
  const shotRefs = useRef<Record<number, ViewShotRef | null>>({});
  const { width } = useWindowDimensions();

  // Design 1v proportions: 210×340 card with side peeks
  const cardW = Math.min(Math.round(width * 0.62), 260);
  const cardH = Math.round(cardW * (340 / 210));

  useEffect(() => {
    if (isSegment(segmentParam)) setSegment(segmentParam);
  }, [segmentParam]);

  const stampedIds = useMemo(() => new Set(Object.keys(visits)), [visits]);
  const count = stampedIds.size;


  const byCategory = useMemo(() => {
    const res: Record<CategoryId, { done: number; total: number }> = {
      historical: { done: 0, total: 0 },
      forest: { done: 0, total: 0 },
      water: { done: 0, total: 0 },
    };
    for (const p of parks) {
      res[p.category].total++;
      if (stampedIds.has(p.id)) res[p.category].done++;
    }
    return res;
  }, [stampedIds]);

  const titles: Record<Segment, string> = {
    progress: t('myBooklet'),
    stamps: t('stamps'),
    stats: t('stats'),
    wrapped: t('wrapped'),
  };

  const monthlyCounts = useMemo(() => {
    const months: Record<string, number> = {};
    for (const v of Object.values(visits)) {
      const d = new Date(v.stampedAt);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      months[key] = (months[key] ?? 0) + 1;
    }
    return months;
  }, [visits]);

  /** Longest run of consecutive DAYS with at least one stamp. */
  const streakDays = useMemo(() => {
    const days = new Set(
      Object.values(visits).map((v) => {
        const d = new Date(v.stampedAt);
        return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000;
      }),
    );
    const sorted = [...days].sort((a, b) => a - b);
    let best = 0;
    let run = 0;
    for (let i = 0; i < sorted.length; i++) {
      run = i > 0 && sorted[i] === sorted[i - 1] + 1 ? run + 1 : 1;
      best = Math.max(best, run);
    }
    return best;
  }, [visits]);

  /** Last six months for the chart, oldest first, with a friendly scale. */
  const monthData = useMemo(() => {
    const now = new Date();
    const months = Array.from({ length: 6 }).map((_, i) => {
      // Anchor to the 1st: setMonth() on a 29th–31st overflows into the next
      // month when the target month is shorter, which duplicated columns.
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      return { key, date: d, n: monthlyCounts[key] ?? 0 };
    });
    const maxN = Math.max(1, ...months.map((m) => m.n));
    const step = Math.max(1, Math.ceil(maxN / 3));
    const ticks = [0, step, step * 2, step * 3];
    return { months, ticks, maxTick: step * 3 };
  }, [monthlyCounts]);

  // Skip photos whose cache files the OS already deleted — a stale URI
  // renders as a blank Image and used to leave Wrapped cards empty.
  // resolvePhotoUri re-anchors persisted URIs to the current app container
  // (the iOS container path changes on app updates).
  const allPhotos = useMemo(
    () =>
      Object.values(visits).flatMap((v) =>
        photoUris(v)
          .filter(photoExists)
          .map((uri) => ({ uri: resolvePhotoUri(uri), parkId: v.parkId })),
      ),
    [visits],
  );

  /** 2–3 swipeable cards; the memories card needs at least one photo. */
  const wrappedCards = useMemo<WrappedVariant[]>(
    () => (allPhotos.length > 0 ? ['summary', 'memories', 'map'] : ['summary', 'map']),
    [allPhotos.length],
  );

  const favouriteCategory = useMemo(() => {
    let best: CategoryId = 'forest';
    let bestN = -1;
    for (const c of CATEGORY_IDS) {
      if (byCategory[c].done > bestN) {
        bestN = byCategory[c].done;
        best = c;
      }
    }
    return best;
  }, [byCategory]);

  /** Park stamped most recently, only if within the last 24 hours. */
  const justUnlockedId = useMemo(() => {
    let bestId: string | null = null;
    let bestAt = 0;
    for (const v of Object.values(visits)) {
      const at = new Date(v.stampedAt).getTime();
      if (at > bestAt) {
        bestAt = at;
        bestId = v.parkId;
      }
    }
    return bestId && Date.now() - bestAt <= 24 * 60 * 60 * 1000 ? bestId : null;
  }, [visits]);

  const shareFallback = useCallback(() => {
    Share.share({
      message: `${count}/${TOTAL_PARKS} ${t('parksExplored')} · ${distanceTotal.toFixed(0)} ${t('kmWalked')} · ${t('appName')}`,
    });
  }, [count, distanceTotal, t]);

  const handleShare = useCallback(async () => {
    try {
      const uri = await shotRefs.current[activeCard]?.capture();
      if (!uri) throw new Error('capture failed');
      await Sharing.shareAsync(uri, { mimeType: 'image/png' });
    } catch {
      shareFallback();
    }
  }, [shareFallback, activeCard]);

  return (
    <View style={{ flex: 1, backgroundColor: ground.bg, paddingTop: insets.top + 12 }}>
      <Heading style={{ paddingHorizontal: spacing.md }}>{titles[segment]}</Heading>
      <View style={styles.segmentRow}>
        <Chip label={t('progress')} active={segment === 'progress'} onPress={() => setSegment('progress')} />
        <Chip label={t('stamps')} active={segment === 'stamps'} onPress={() => setSegment('stamps')} />
        <Chip label={t('stats')} active={segment === 'stats'} onPress={() => setSegment('stats')} />
        <Chip label={t('wrapped')} active={segment === 'wrapped'} onPress={() => setSegment('wrapped')} />
      </View>

      {segment === 'progress' ? (
        <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.lg, paddingBottom: 30 }}>
          <View style={styles.progressHero}>
            <View style={styles.ringWrap}>
              <Svg width={150} height={150} viewBox="0 0 100 100">
                <Circle cx={50} cy={50} r={42} stroke={ground.surface} strokeWidth={9} fill="none" />
                {/* Spec @keyframes ringfill — ring draws in over 1.4s */}
                <RingFillCircle
                  progress={count / TOTAL_PARKS}
                  cx={50}
                  cy={50}
                  r={42}
                  stroke={ground.accent}
                  strokeWidth={9}
                />
              </Svg>
              <View style={styles.ringCenter}>
                <Text style={styles.ringNumber}>{count}</Text>
                <Text style={styles.ringSub}>
                  {t('of')} {TOTAL_PARKS}
                </Text>
              </View>
            </View>
            <View style={{ flex: 1, gap: 12 }}>
              {CATEGORY_IDS.map((c) => (
                <View key={c}>
                  <View style={styles.catRow}>
                    <Text style={[styles.catName, { color: categories[c].deep }]}>{t(c)}</Text>
                    <Text style={styles.catCount}>
                      {byCategory[c].done} / {byCategory[c].total}
                    </Text>
                  </View>
                  <View style={[styles.catTrack, { backgroundColor: categories[c].tint }]}>
                    <View
                      style={[
                        styles.catFill,
                        {
                          backgroundColor: categories[c].ink,
                          width: `${(byCategory[c].done / Math.max(1, byCategory[c].total)) * 100}%`,
                        },
                      ]}
                    />
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* 78-tile booklet grid — stamped slots show the mini stamp art */}
          <View style={styles.grid}>
            {parks.map((p) => {
              const stamped = stampedIds.has(p.id);
              return (
                <Pressable
                  key={p.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${p.name}${stamped ? ` — ${t('stampedOn')}` : ''}`}
                  onPress={() => router.push(`/park/${p.id}`)}
                  style={[styles.tile, stamped && { backgroundColor: categories[p.category].ink }]}
                >
                  {stamped ? <StampView parkId={p.id} size={30} stamped whiteTint /> : null}
                </Pressable>
              );
            })}
          </View>
          <Body style={{ textAlign: 'center', color: ground.textMuted, fontSize: 14.5 }}>
            {t('officialNote')}
          </Body>
        </ScrollView>
      ) : null}

      {segment === 'stamps' ? (
        count === 0 ? (
          <View style={styles.empty}>
            <StampRing size={90} color={ground.surface} />
            <Body style={{ textAlign: 'center', color: ground.textMuted }}>{t('emptyGallery')}</Body>
            <PillButton label={t('findFirstPark')} onPress={() => router.navigate('/(tabs)')} />
          </View>
        ) : (
          // Badges stay pinned below; only the stamps inside the light card scroll
          <View style={{ flex: 1, padding: spacing.md, paddingBottom: 12 }}>
            <View style={[styles.galleryCard, { flex: 1 }]}>
              <ScrollView contentContainerStyle={{ padding: spacing.md }} showsVerticalScrollIndicator={false}>
              <View style={styles.galleryGrid}>
                {parks.map((p) => {
                  const stamped = stampedIds.has(p.id);
                  return (
                    <Pressable
                      key={p.id}
                      accessibilityRole="button"
                      accessibilityLabel={p.name}
                      onPress={() =>
                        router.push({ pathname: '/stamp-viewer', params: { parkId: p.id } })
                      }
                      style={styles.galleryItem}
                    >
                      {stamped && p.id === justUnlockedId ? (
                        // Spec: just-unlocked stamp pops in (@keyframes popin, .8s)
                        <PopIn duration={800}>
                          <StampView parkId={p.id} size={110} stamped />
                        </PopIn>
                      ) : (
                        <StampView parkId={p.id} size={110} stamped={stamped} />
                      )}
                      {stamped && p.id === justUnlockedId ? (
                        <View style={styles.justUnlockedChip}>
                          <Text style={styles.justUnlockedText}>{t('justUnlocked')}</Text>
                        </View>
                      ) : (
                        <Text
                          style={[styles.galleryName, !stamped && { color: ground.textMuted, fontFamily: fonts.body }]}
                          numberOfLines={1}
                        >
                          {p.name}
                        </Text>
                      )}
                    </Pressable>
                  );
                })}
              </View>
              </ScrollView>
            </View>
            <SectionLabel color={ground.text} style={{ marginTop: spacing.md }}>
              {t('categoryBadges')}
            </SectionLabel>
            <View style={styles.badgeRow}>
              {CATEGORY_IDS.map((c) => (
                <View key={c} style={[styles.badge, { backgroundColor: categories[c].tint }]}>
                  <Text style={[styles.badgeText, { color: categories[c].deep }]}>
                    {byCategory[c].done}/{byCategory[c].total}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )
      ) : null}

      {segment === 'stats' ? (
        <ScrollView contentContainerStyle={{ padding: spacing.md, gap: 14, paddingBottom: 30 }}>
          <View style={styles.statRow}>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{count}</Text>
              <Text style={styles.statLabel}>{t('totalParks')}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{distanceTotal.toFixed(0)}</Text>
              <Text style={styles.statLabel}>{t('totalDistance')}</Text>
            </View>
          </View>
          <View style={styles.statCardWide}>
            <SectionLabel color={ground.text}>{t('parksPerMonth')}</SectionLabel>
            <View style={styles.chartRow}>
              {/* y-axis scale */}
              <View style={styles.yAxis}>
                {monthData.ticks.map((tk) => (
                  <Text key={tk} style={[styles.yTick, { bottom: (tk / monthData.maxTick) * CHART_H - 7 }]}>
                    {tk}
                  </Text>
                ))}
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.plot}>
                  {/* horizontal gridlines at each y value */}
                  {monthData.ticks.map((tk) => (
                    <View
                      key={tk}
                      style={[styles.gridline, { bottom: (tk / monthData.maxTick) * CHART_H }]}
                    />
                  ))}
                  <View style={styles.barsRow}>
                    {monthData.months.map((m) => (
                      <View key={m.key} style={styles.monthCol}>
                        <View
                          style={[
                            styles.monthBar,
                            { height: Math.max(3, (m.n / monthData.maxTick) * CHART_H) },
                            m.n === 0 && { opacity: 0.35 },
                          ]}
                        />
                      </View>
                    ))}
                  </View>
                </View>
                <View style={styles.monthLabelRow}>
                  {monthData.months.map((m) => (
                    <Text key={m.key} style={styles.monthLabel}>
                      {m.date.toLocaleDateString(localeTag(lang), { month: 'short' })}
                    </Text>
                  ))}
                </View>
              </View>
            </View>
          </View>
          <View style={styles.statCardWide}>
            <View style={styles.statRowInner}>
              <Text style={styles.statNumber}>{streakDays}</Text>
              <Text style={[styles.statLabel, { flex: 1, paddingRight: spacing.sm }]}>
                {t('longestStreak')} ({t('days')})
              </Text>
            </View>
          </View>
        </ScrollView>
      ) : null}

      {segment === 'wrapped' ? (
        count === 0 ? (
          <View style={styles.empty}>
            <StampRing size={90} color={ground.surface} />
            <Body style={{ textAlign: 'center', color: ground.textMuted }}>{t('wrappedNeedsOne')}</Body>
            <PillButton label={t('findFirstPark')} onPress={() => router.navigate('/(tabs)')} />
          </View>
        ) : (
          /* Wrapped (design 1v) — swipeable card carousel with side peeks,
             page dots and a slow floaty bob; each card captured via ViewShot */
          <ScrollView contentContainerStyle={{ paddingVertical: spacing.sm, gap: 14, paddingBottom: 30 }}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={cardW + CARD_GAP}
              decelerationRate="fast"
              contentContainerStyle={{
                paddingHorizontal: (width - cardW) / 2,
                gap: CARD_GAP,
                paddingVertical: 14,
              }}
              onMomentumScrollEnd={(e) =>
                setActiveCard(
                  Math.min(
                    wrappedCards.length - 1,
                    Math.max(0, Math.round(e.nativeEvent.contentOffset.x / (cardW + CARD_GAP))),
                  ),
                )
              }
            >
              {wrappedCards.map((variant, i) => (
                <Floaty key={variant} duration={10000} delay={i * 700}>
                  <ViewShot
                    ref={(r) => {
                      shotRefs.current[i] = r;
                    }}
                    options={{ format: 'png', quality: 1 }}
                  >
                    <WrappedCard
                      variant={variant}
                      width={cardW}
                      height={cardH}
                      count={count}
                      distanceTotal={distanceTotal}
                      photos={allPhotos}
                      favouriteCategory={favouriteCategory}
                      visitIds={Object.keys(visits)}
                    />
                  </ViewShot>
                </Floaty>
              ))}
            </ScrollView>
            <View style={styles.pageDots}>
              {wrappedCards.map((variant, i) => (
                <View
                  key={variant}
                  style={[styles.pageDot, i === activeCard && styles.pageDotActive]}
                />
              ))}
            </View>
            <View style={{ paddingHorizontal: spacing.md }}>
              <PillButton label={t('shareCard')} onPress={handleShare} />
            </View>
          </ScrollView>
        )
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  segmentRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: spacing.md,
    marginTop: 12,
    marginBottom: 10,
    flexWrap: 'wrap',
  },
  progressHero: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  ringWrap: { width: 150, height: 150, alignItems: 'center', justifyContent: 'center' },
  ringCenter: { position: 'absolute', alignItems: 'center' },
  ringNumber: { fontFamily: fonts.heading, fontSize: 44, color: ground.text },
  ringSub: { fontFamily: fonts.body, fontSize: 15, color: ground.textMuted },
  catRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  catName: { fontFamily: fonts.bodySemi, fontSize: 15.5 },
  catCount: { fontFamily: fonts.bodySemi, fontSize: 15.5, color: ground.text },
  catTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  catFill: { height: 8, borderRadius: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  tile: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: ground.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { alignItems: 'center', gap: 16, marginTop: 60, paddingHorizontal: 44 },
  // Padding lives on the scroll content, not the card — the card's rounded
  // edge is what clips the scrolling stamps.
  galleryCard: { backgroundColor: ground.surfaceLight, borderRadius: radii.lg, overflow: 'hidden' },
  galleryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    rowGap: 22,
  },
  galleryItem: { alignItems: 'center', gap: 8, width: '45%' },
  galleryName: { fontFamily: fonts.bodySemi, fontSize: 14.5, color: ground.text },
  badgeRow: { flexDirection: 'row', gap: 12 },
  badge: {
    flex: 1,
    borderRadius: radii.pill,
    paddingVertical: 16,
    alignItems: 'center',
  },
  badgeText: { fontFamily: fonts.bodyBold, fontSize: 16.5 },
  statRow: { flexDirection: 'row', gap: 12 },
  statRowInner: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  statCard: {
    flex: 1,
    backgroundColor: ground.surfaceLight,
    borderRadius: radii.lg,
    padding: spacing.md,
    alignItems: 'center',
    gap: 4,
  },
  statCardWide: { backgroundColor: ground.surfaceLight, borderRadius: radii.lg, padding: spacing.md },
  pageDots: { flexDirection: 'row', gap: 6, justifyContent: 'center', alignItems: 'center' },
  pageDot: { width: 6, height: 6, borderRadius: 99, backgroundColor: '#cdbfa3' },
  pageDotActive: { width: 20, backgroundColor: ground.accent },
  statNumber: { fontFamily: fonts.heading, fontSize: 40, color: ground.text },
  statLabel: { fontFamily: fonts.body, fontSize: 14.5, color: ground.textMuted, textAlign: 'center' },
  chartRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  yAxis: { width: 22, height: CHART_H },
  yTick: {
    position: 'absolute',
    right: 0,
    fontFamily: fonts.bodySemi,
    fontSize: 11,
    color: ground.textMuted,
    textAlign: 'right',
  },
  plot: { height: CHART_H },
  gridline: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(32,30,29,0.10)',
  },
  barsRow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
  },
  monthCol: { flex: 1, alignItems: 'center' },
  monthBar: { width: 20, borderRadius: 7, backgroundColor: ground.accent },
  monthLabelRow: { flexDirection: 'row', marginTop: 6 },
  monthLabel: { flex: 1, textAlign: 'center', fontFamily: fonts.body, fontSize: 12.5, color: ground.textMuted },
  justUnlockedChip: {
    backgroundColor: ground.accentTint,
    borderRadius: radii.pill,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  justUnlockedText: { fontFamily: fonts.bodySemi, fontSize: 13, color: ground.accent },
});
