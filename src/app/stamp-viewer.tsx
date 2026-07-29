import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Floaty } from '@/components/motion';
import { StampView } from '@/components/StampView';
import { Body, Heading, PillButton } from '@/components/ui';
import { parkById } from '@/data/parks';
import { localeTag, useI18n } from '@/i18n';
import { useAppStore } from '@/store';
import { categories, fonts, ground, radii, spacing } from '@/theme/tokens';

/**
 * Enlarged stamp view — opened from the gallery as a native modal, so the
 * platform's own dismissal works too (swipe-down on iOS, hardware back on
 * Android) alongside the explicit back button.
 */
export default function StampViewerScreen() {
  const { parkId } = useLocalSearchParams<{ parkId: string }>();
  const park = parkById(parkId ?? '');
  const { t, lang } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const visit = useAppStore((s) => (park ? s.visits[park.id] : undefined));

  if (!park) return null;
  const pal = categories[park.category];
  const stamped = !!visit;
  const stampedDate = visit
    ? new Date(visit.stampedAt).toLocaleDateString(localeTag(lang), {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;
  const stampSize = Math.min(width - 2 * spacing.lg, 340);

  return (
    <View style={[styles.wrap, { paddingBottom: insets.bottom + spacing.md, paddingTop: spacing.lg }]}>
      <View style={styles.content}>
        {/* Gentle floaty drift with a slight tilt sway — no slam here */}
        <Animated.View entering={FadeIn.duration(250)}>
          <Floaty duration={9000}>
            <StampView parkId={park.id} size={stampSize} stamped={stamped} />
          </Floaty>
        </Animated.View>
        <Animated.View entering={FadeIn.delay(150)} style={{ alignItems: 'center', gap: 8 }}>
          <Heading style={{ fontSize: 30, textAlign: 'center' }}>{park.name}</Heading>
          <View style={[styles.catPill, { backgroundColor: pal.tint }]}>
            <Text style={[styles.catPillText, { color: pal.deep }]}>{t(park.category)}</Text>
          </View>
          <Body style={{ color: ground.textMuted, textAlign: 'center' }}>
            {stamped ? `${t('stampedOn')} ${stampedDate}` : t('lockedStamp')}
          </Body>
        </Animated.View>
      </View>

      <View style={{ gap: 12 }}>
        <PillButton
          label={t('showParkDetails')}
          color={pal.ink}
          onPress={() => router.replace(`/park/${park.id}`)}
        />
        <PillButton label={t('back')} variant="ghost" onPress={() => router.back()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: ground.bg,
    paddingHorizontal: spacing.lg,
    justifyContent: 'space-between',
  },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24 },
  catPill: { borderRadius: radii.pill, paddingVertical: 6, paddingHorizontal: 14 },
  catPillText: { fontFamily: fonts.bodySemi, fontSize: 15 },
});
