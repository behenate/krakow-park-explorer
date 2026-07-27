import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ConfettiRain, Floaty, PopIn } from '@/components/motion';
import { Body, Heading, PillButton, StampRing } from '@/components/ui';
import { TOTAL_PARKS } from '@/data/parks';
import { useI18n } from '@/i18n';
import { ground } from '@/theme/tokens';

export default function MilestoneScreen() {
  const { n } = useLocalSearchParams<{ n: string }>();
  const count = Number(n ?? 0);
  const { t } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();

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
        {/* Spec @keyframes popin (1s) then floaty (4s drift) */}
        <PopIn duration={1000} delay={250}>
          <Floaty duration={8000} delay={1350}>
            <StampRing size={180} color={ground.accent} filled={count >= TOTAL_PARKS} />
          </Floaty>
        </PopIn>
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
});
