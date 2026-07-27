import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PulseDot } from '@/components/motion';
import { useI18n } from '@/i18n';
import { useAppStore } from '@/store';
import { fonts, ground, radii } from '@/theme/tokens';

/**
 * Persistent "following route" indicator — always visible while tracking is
 * active (spec 4.2: user must always see when location is being tracked).
 */
export function FollowingBanner() {
  const { t } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const route = useAppStore((s) => s.activeRoute);

  if (!route?.following) return null;

  const done = route.legs.filter((l) => l.done).length;
  const trackingLabel = route.trackingEnabled ? t('trackingOn') : t('trackingManual');

  return (
    <View style={[styles.wrap, { top: insets.top + 6 }]} pointerEvents="box-none">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t('followingRoute')}, ${done} ${t('of')} ${route.legs.length}`}
        onPress={() => router.navigate('/(tabs)/route')}
        style={styles.pill}
      >
        {/* Spec @keyframes shim — the tracking dot pulses while live */}
        <PulseDot color="#8fd07f" size={8} />
        <Text style={styles.text}>
          {t('followingRoute')} · {done}/{route.legs.length} · {trackingLabel}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, zIndex: 50, alignItems: 'center' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: ground.dark,
    borderRadius: radii.pill,
    paddingVertical: 9,
    paddingHorizontal: 16,
  },
  text: { color: ground.white, fontFamily: fonts.bodySemi, fontSize: 13.5 },
});
