import * as MediaLibrary from 'expo-media-library';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import ViewShot, { ViewShotRef } from 'react-native-view-shot';

import { Floaty, PopIn, RingFillCircle } from '@/components/motion';
import { photoExists } from '@/lib/photos';
import { Body, Chip, Heading, PillButton, SectionLabel, StampRing } from '@/components/ui';
import { WrappedCard, WrappedVariant } from '@/components/WrappedCard';
import { StampView } from '@/components/StampView';
import { Park, parks, TOTAL_PARKS } from '@/data/parks';
import { useI18n } from '@/i18n';
import { photoUris, useAppStore } from '@/store';
import { CategoryId, categories, fonts, ground, radii, spacing } from '@/theme/tokens';

type Segment = 'progress' | 'stamps' | 'stats' | 'wrapped';

const CATEGORY_IDS = Object.keys(categories) as CategoryId[];

const SEGMENTS: Segment[] = ['progress', 'stamps', 'stats', 'wrapped'];

/** Gap between Wrapped carousel cards. */
const CARD_GAP = 14;

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
  const [justSaved, setJustSaved] = useState(false);
  const [activeCard, setActiveCard] = useState(0);
  const shotRefs = useRef<Record<number, ViewShotRef | null>>({});
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { width } = useWindowDimensions();

  // Design 1v proportions: 210×340 card with side peeks
  const cardW = Math.min(Math.round(width * 0.62), 260);
  const cardH = Math.round(cardW * (340 / 210));

  useEffect(() => {
    if (isSegment(segmentParam)) setSegment(segmentParam);
  }, [segmentParam]);

  useEffect(
    () => () => {
      if (savedTimer.current) clearTimeout(savedTimer.current);
    },
    [],
  );

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

  const streakWeeks = useMemo(() => {
    const weeks = new Set(
      Object.values(visits).map((v) => {
        const d = new Date(v.stampedAt);
        const onejan = new Date(d.getFullYear(), 0, 1);
        const week = Math.ceil(((d.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7);
        return `${d.getFullYear()}-${week}`;
      }),
    );
    // longest run of consecutive weeks
    const sorted = [...weeks]
      .map((w) => {
        const [y, wk] = w.split('-').map(Number);
        return y * 53 + wk;
      })
      .sort((a, b) => a - b);
    let best = 0;
    let run = 0;
    for (let i = 0; i < sorted.length; i++) {
      run = i > 0 && sorted[i] === sorted[i - 1] + 1 ? run + 1 : 1;
      best = Math.max(best, run);
    }
    return best;
  }, [visits]);

  // Skip photos whose cache files the OS already deleted — a stale URI
  // renders as a blank Image and used to leave Wrapped cards empty.
  const allPhotos = useMemo(
    () => Object.values(visits).flatMap((v) => photoUris(v)).filter(photoExists),
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

  const handleSaveToPhotos = useCallback(async () => {
    try {
      const uri = await shotRefs.current[activeCard]?.capture();
      if (!uri) return;
      const permission = await MediaLibrary.requestPermissionsAsync();
      if (!permission.granted) return;
      await MediaLibrary.saveToLibraryAsync(uri);
      setJustSaved(true);
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setJustSaved(false), 2000);
    } catch {
      // capture or save failed — leave the button as-is
    }
  }, [activeCard]);

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
          <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 30 }}>
            <View style={styles.galleryCard}>
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
            </View>
            <SectionLabel color={ground.text} style={{ marginTop: spacing.lg }}>
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
          </ScrollView>
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
            <View style={styles.monthChart}>
              {Array.from({ length: 6 }).map((_, i) => {
                const d = new Date();
                d.setMonth(d.getMonth() - (5 - i));
                const key = `${d.getFullYear()}-${d.getMonth()}`;
                const n = monthlyCounts[key] ?? 0;
                const max = Math.max(1, ...Object.values(monthlyCounts));
                return (
                  <View key={key} style={styles.monthCol}>
                    <View style={[styles.monthBar, { height: 8 + (n / max) * 80 }]} />
                    <Text style={styles.monthLabel}>
                      {d.toLocaleDateString(lang === 'pl' ? 'pl-PL' : 'en-GB', { month: 'short' })}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
          <View style={styles.statCardWide}>
            <View style={styles.statRowInner}>
              <Text style={styles.statNumber}>{streakWeeks}</Text>
              <Text style={[styles.statLabel, { flex: 1, paddingRight: spacing.sm }]}>
                {t('longestStreak')} ({t('weeks')})
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
            <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: spacing.md }}>
              <PillButton
                label={justSaved ? t('savedToPhotos') : t('saveToPhotos')}
                variant="outline"
                style={{ flex: 1 }}
                onPress={handleSaveToPhotos}
              />
              <PillButton label={t('shareCard')} style={{ flex: 1 }} onPress={handleShare} />
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
  galleryCard: { backgroundColor: ground.surfaceLight, borderRadius: radii.lg, padding: spacing.md },
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
  monthChart: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', height: 120 },
  monthCol: { alignItems: 'center', gap: 6 },
  monthBar: { width: 22, borderRadius: 8, backgroundColor: ground.accent },
  monthLabel: { fontFamily: fonts.body, fontSize: 12.5, color: ground.textMuted },
  justUnlockedChip: {
    backgroundColor: ground.accentTint,
    borderRadius: radii.pill,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  justUnlockedText: { fontFamily: fonts.bodySemi, fontSize: 13, color: ground.accent },
});
