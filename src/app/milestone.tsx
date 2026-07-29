import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ConfettiRain, Floaty, PopIn } from '@/components/motion';
import { StampView } from '@/components/StampView';
import { Body, Heading, PillButton } from '@/components/ui';
import { TOTAL_PARKS } from '@/data/parks';
import { useI18n } from '@/i18n';
import { useAppStore } from '@/store';
import { ground } from '@/theme/tokens';

/**
 * The five most recent stamps scatter across the stage at varied sizes and
 * tilts. Every Floaty gets its own period + phase so the drifts never sync.
 */
const SCATTER: {
  pos: ViewStyle;
  size: number;
  rotate: string;
  floatDuration: number;
  floatDelay: number;
  popDelay: number;
}[] = [
  { pos: { top: 46, left: 88 }, size: 132, rotate: '-8deg', floatDuration: 8600, floatDelay: 1200, popDelay: 250 },
  { pos: { top: 0, left: -6 }, size: 96, rotate: '9deg', floatDuration: 10400, floatDelay: 1700, popDelay: 400 },
  { pos: { top: 8, right: -2 }, size: 86, rotate: '-14deg', floatDuration: 9400, floatDelay: 2300, popDelay: 520 },
  { pos: { bottom: 4, left: 16 }, size: 80, rotate: '12deg', floatDuration: 11800, floatDelay: 2900, popDelay: 640 },
  { pos: { bottom: 0, right: 20 }, size: 90, rotate: '-5deg', floatDuration: 12800, floatDelay: 3400, popDelay: 760 },
];

export default function MilestoneScreen() {
  const { n } = useLocalSearchParams<{ n: string }>();
  const count = Number(n ?? 0);
  const { t } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const visits = useAppStore((s) => s.visits);

  /** Five most recently stamped parks, newest first. */
  const recentIds = useMemo(
    () =>
      Object.values(visits)
        .sort((a, b) => new Date(b.stampedAt).getTime() - new Date(a.stampedAt).getTime())
        .slice(0, 5)
        .map((v) => v.parkId),
    [visits],
  );

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  const flavour =
    count >= TOTAL_PARKS
      ? t('milestone78')
      : count >= 50
        ? t('milestone50')
        : count >= 25
          ? t('milestone25')
          : t('milestone10');

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}>
      {/* Spec @keyframes fall — looping confetti rain (static under reduce-motion) */}
      <ConfettiRain count={26} duration={3200} />

      <View style={styles.content}>
        {/* The latest five real stamps pop in and drift out of phase */}
        <View style={styles.stampStage}>
          {recentIds.map((parkId, i) => {
            const c = SCATTER[i];
            return (
              <View key={parkId} style={[styles.stampSlot, c.pos, { transform: [{ rotate: c.rotate }] }]}>
                <PopIn duration={900} delay={c.popDelay}>
                  <Floaty duration={c.floatDuration} delay={c.floatDelay}>
                    <StampView parkId={parkId} size={c.size} stamped />
                  </Floaty>
                </PopIn>
              </View>
            );
          })}
        </View>
        <Animated.View entering={FadeIn.delay(300)} style={{ alignItems: 'center', gap: 12 }}>
          <Heading style={{ fontSize: 46, textAlign: 'center' }}>
            {t('milestoneTitle', { n: count })}
          </Heading>
          <Body style={{ textAlign: 'center', fontSize: 18, color: ground.textMuted }}>{flavour}</Body>
        </Animated.View>
      </View>

      <View style={{ gap: 12 }}>
        <PillButton
          label={t('makeWrapped')}
          onPress={() => {
            router.back();
            router.navigate({ pathname: '/(tabs)/booklet', params: { segment: 'wrapped' } });
          }}
        />
        <PillButton label={t('keepGoing')} variant="ghost" onPress={() => router.back()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: ground.bg, paddingHorizontal: 28, justifyContent: 'space-between' },
  content: { alignItems: 'center', gap: 28, marginTop: 40 },
  stampStage: { width: 310, height: 260 },
  stampSlot: { position: 'absolute' },
});
