import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StampSlam } from '@/components/motion';
import { persistPhoto } from '@/lib/photos';
import { StampView, stampCharacter } from '@/components/StampView';
import { Body, Heading, PillButton } from '@/components/ui';
import { parkById, TOTAL_PARKS } from '@/data/parks';
import { useI18n } from '@/i18n';
import { MILESTONES, useAppStore } from '@/store';
import { categories, ground, spacing } from '@/theme/tokens';

/**
 * Full-screen stamp celebration — pushed after a park is marked stamped
 * (from the park detail confirm or the route arrival popup). Category-tinted,
 * zooms in the park's unlocked stamp, offers a memory photo, and hands off
 * to the milestone screen when a threshold was just crossed.
 */
export default function StampSuccessScreen() {
  // `from: 'detail'` = pushed from the park detail screen (going back lands
  // there); anything else (route arrival) replaces this screen with the park
  // detail, so the user always ends up on the park to add memories.
  const { parkId, from } = useLocalSearchParams<{ parkId: string; from?: string }>();
  const park = parkById(parkId ?? '');
  const { t } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const visits = useAppStore((s) => s.visits);
  const addPhoto = useAppStore((s) => s.addPhoto);
  const celebrated = useAppStore((s) => s.celebratedMilestones);
  const markCelebrated = useAppStore((s) => s.markCelebrated);

  if (!park) return null;
  const pal = categories[park.category];
  const stampedCount = Object.keys(visits).length;

  const close = () => {
    if (from === 'detail') {
      router.back();
    } else {
      router.replace(`/park/${park.id}`);
    }
    const milestone = MILESTONES.find((m) => m === stampedCount && !celebrated.includes(m));
    if (milestone) {
      markCelebrated(milestone);
      router.push({ pathname: '/milestone', params: { n: String(milestone) } });
    }
  };

  const pickPhoto = async () => {
    const res = await ImagePicker.launchCameraAsync({ quality: 0.8 }).catch(() => null);
    const fallback =
      res && !res.canceled
        ? res
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.8 }).catch(() => null);
    if (fallback && !fallback.canceled && fallback.assets[0]) {
      let lat: number | undefined;
      let lng: number | undefined;
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status === Location.PermissionStatus.GRANTED) {
          const last = await Location.getLastKnownPositionAsync();
          if (last) {
            lat = last.coords.latitude;
            lng = last.coords.longitude;
          }
        }
      } catch {
        // no geotag — photo still saves
      }
      addPhoto(park.id, { uri: persistPhoto(fallback.assets[0].uri), lat, lng });
    }
  };

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: pal.tint,
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        paddingTop: insets.top + 60,
        gap: 24,
      }}
    >
      {/* Spec @keyframes slam — twists in and lands hand-pressed crooked.
          StampView already bakes the park's own tilt (−6..+6°); top up so the
          total resting tilt is always a visible ±9°, direction per park. */}
      <StampSlam
        endRotation={(stampCharacter(park.id).rotation >= 0 ? 9 : -9) - stampCharacter(park.id).rotation}
      >
        <StampView parkId={park.id} size={220} stamped />
      </StampSlam>
      <Animated.View entering={FadeIn.delay(1000)} style={{ alignItems: 'center', gap: 10 }}>
        <Heading style={{ fontSize: 40, textAlign: 'center' }}>
          {t('stampOfTotal', { n: stampedCount, total: TOTAL_PARKS })}
        </Heading>
        <Body style={{ textAlign: 'center', color: pal.deep, fontSize: 18 }}>{t('stampSuccessSub')}</Body>
      </Animated.View>
      <View style={{ gap: 14, width: '100%', marginTop: 20 }}>
        <PillButton
          label={t('addMemoryPhoto')}
          color={pal.ink}
          onPress={async () => {
            await pickPhoto();
            close();
          }}
        />
        <PillButton label={t('done')} variant="ghost" textColor={pal.deep} onPress={close} />
      </View>
      <Body style={{ color: ground.textMuted, fontSize: 14, textAlign: 'center', marginTop: 10 }}>
        {t('photosNotProof')}
      </Body>
    </View>
  );
}
