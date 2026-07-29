import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { Floaty } from '@/components/motion';
import { StampView } from '@/components/StampView';
import { Body, Heading, PillButton } from '@/components/ui';
import { useI18n } from '@/i18n';
import { LANGUAGE_CYCLE, LANGUAGE_LABELS, resolveLanguage } from '@/i18n/language';
import { useAppStore } from '@/store';
import { categories, fonts, ground, radii, spacing } from '@/theme/tokens';

const CARDS = ['challenge', 'app', 'booklet', 'location'] as const;

const SYMBIOZA_MAPS_URL = 'https://www.google.com/maps/search/?api=1&query=CEE+Symbioza+Krak%C3%B3w';
const OKP_PDF_URL = 'https://zzm.krakow.pl/okp.html';

export default function OnboardingScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const language = useAppStore((s) => s.settings.language);
  const setSettings = useAppStore((s) => s.setSettings);
  const [page, setPage] = useState(0);

  const finish = () => {
    setSettings({ onboardingDone: true });
    router.replace('/(tabs)');
  };

  const next = () => {
    if (page < CARDS.length - 1) setPage(page + 1);
    else finish();
  };

  const allowLocation = async () => {
    await Location.requestForegroundPermissionsAsync().catch(() => null);
    finish();
  };

  const card = CARDS[page];
  const isLast = card === 'location';

  const copy: Record<(typeof CARDS)[number], { title: string; body: string }> = {
    challenge: { title: t('onbChallengeTitle'), body: t('onbChallengeBody') },
    // Design 1c: no body paragraph — the tinted disclaimer card is the text
    app: { title: t('onbAppTitle'), body: '' },
    booklet: { title: t('onbBookletTitle'), body: t('onbBookletBody') },
    location: { title: t('onbLocationTitle'), body: t('onbLocationBody') },
  };

  // Cycles the concrete languages; picking one here pins it over the system default.
  const current = resolveLanguage(language);
  const cycleLanguage = () => {
    setSettings({ language: LANGUAGE_CYCLE[(LANGUAGE_CYCLE.indexOf(current) + 1) % LANGUAGE_CYCLE.length] });
  };

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 16 }]}>
      <View style={styles.topRow}>
        {/* Design 1b: language switcher lives on card 1 only */}
        {card === 'challenge' ? (
          <Pressable accessibilityRole="button" onPress={cycleLanguage} style={styles.langPill}>
            <Icon name="globe" size={13} color={ground.text} />
            <Text style={styles.langText}>{LANGUAGE_LABELS[current]} ▾</Text>
          </Pressable>
        ) : (
          <View />
        )}
        <Pressable accessibilityRole="button" onPress={finish}>
          <Text style={styles.skip}>{t('onbSkip')}</Text>
        </Pressable>
      </View>

      {/* Illustration — one per card, as designed (1b–1e) */}
      <Animated.View key={card} entering={FadeIn} style={styles.stage}>
        {card === 'challenge' ? (
          <View style={styles.blobBox}>
            <View style={styles.blob} />
            <View style={[styles.stamp, { top: 26, left: 8, transform: [{ rotate: '-12deg' }] }]}>
              <Floaty duration={10000}>
                <StampView parkId="planty-krakowskie" size={104} stamped={false} />
              </Floaty>
            </View>
            <View style={[styles.stamp, { top: 64, right: 2, transform: [{ rotate: '7deg' }] }]}>
              <Floaty duration={11200} delay={400}>
                {/* One filled stamp: solid ink disc, artwork tinted white */}
                <View style={[styles.filledStamp, { backgroundColor: categories.forest.ink }]}>
                  <StampView parkId="blonia-krakowskie" size={118} stamped whiteTint />
                </View>
              </Floaty>
            </View>
            <View style={[styles.stamp, { bottom: 14, left: 78, transform: [{ rotate: '-4deg' }] }]}>
              <Floaty duration={9200} delay={800}>
                <StampView parkId="park-zakrzowek" size={110} stamped={false} />
              </Floaty>
            </View>
          </View>
        ) : null}

        {card === 'app' ? (
          <View style={styles.featureCol}>
            {(
              [
                ['route', t('onbFeatRoutes')],
                ['stamp', t('onbFeatProgress')],
                ['cam', t('onbFeatPhotos')],
              ] as const
            ).map(([icon, label]) => (
              <View key={icon} style={styles.featureRow}>
                <Icon name={icon} size={20} color="#9c5a24" />
                <Text style={styles.featureText}>{label}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {card === 'booklet' ? (
          <Floaty duration={11000}>
            <Image
              // Real OKP booklets, cut out with a white keyline (assets 2)
              source={require('../../assets/images/booklet.webp')}
              style={styles.bookletImage}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
            />
          </Floaty>
        ) : null}

        {card === 'location' ? (
          <View style={styles.locateCircle}>
            <View style={styles.locateRing} />
            <Icon name="locate" size={56} color={categories.forest.deep} />
          </View>
        ) : null}
      </Animated.View>

      <View style={{ gap: 10 }}>
        <Heading style={{ fontSize: 30, lineHeight: 35 }}>{copy[card].title}</Heading>
        {copy[card].body ? (
          <Body style={{ color: ground.textMuted, fontSize: 14.5, lineHeight: 21 }}>{copy[card].body}</Body>
        ) : null}

        {/* Design 1c: the disclaimer gets its own tinted card */}
        {card === 'app' ? (
          <View style={styles.disclaimer}>
            <Text style={styles.disclaimerText}>{t('onbDisclaimer')}</Text>
          </View>
        ) : null}

        {/* Design 1d: distribution shortcuts */}
        {card === 'booklet' ? (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <PillButton
              label={t('onbShowOnMap')}
              variant="outline"
              style={{ flex: 1, paddingVertical: 10, minHeight: 44 }}
              textStyle={{ fontSize: 14.5 }}
              onPress={() => Linking.openURL(SYMBIOZA_MAPS_URL)}
            />
            <PillButton
              label={t('onbPrintPdf')}
              variant="outline"
              style={{ flex: 1, paddingVertical: 10, minHeight: 44 }}
              textStyle={{ fontSize: 14.5 }}
              onPress={() => Linking.openURL(OKP_PDF_URL)}
            />
          </View>
        ) : null}

        {/* Design 1e: the "you can say no" reassurance */}
        {card === 'location' ? (
          <Text style={styles.locationNote}>{t('onbLocationNote')}</Text>
        ) : null}
      </View>

      <View style={styles.dots}>
        {CARDS.map((c, i) => (
          <View key={c} style={[styles.dot, i === page && styles.dotActive]} />
        ))}
      </View>

      {isLast ? (
        <View style={{ gap: 10 }}>
          <PillButton label={t('onbAllow')} onPress={allowLocation} />
          <PillButton label={t('maybeLater')} variant="ghost" onPress={finish} />
        </View>
      ) : (
        <PillButton label={t('onbNext')} onPress={next} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // No space-between: the illustration stage is the only flexible region, so
  // text, dots and buttons keep their own spacing and can never collide.
  wrap: { flex: 1, backgroundColor: ground.bg, paddingHorizontal: spacing.lg },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  langPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: ground.surfaceLight,
    borderRadius: radii.pill,
    paddingVertical: 7,
    paddingHorizontal: 13,
  },
  langText: { fontFamily: fonts.bodySemi, fontSize: 13, color: ground.text },
  skip: { fontFamily: fonts.bodySemi, fontSize: 13.5, color: ground.textMuted },
  stage: { flex: 1, minHeight: 120, alignItems: 'center', justifyContent: 'center' },
  // 1b — organic blob + three stamps
  blobBox: { width: 290, height: 290 },
  blob: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    bottom: 20,
    backgroundColor: categories.forest.tint,
    borderTopLeftRadius: 120,
    borderTopRightRadius: 135,
    borderBottomRightRadius: 112,
    borderBottomLeftRadius: 140,
  },
  stamp: { position: 'absolute' },
  filledStamp: { borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  // 1c — feature rows
  featureCol: { alignSelf: 'stretch', gap: 14, justifyContent: 'center' },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: ground.surfaceLight,
    borderRadius: 20,
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  featureText: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 13.5, color: ground.text },
  // 1d — booklet photo (white keyline baked into the cutout)
  bookletImage: {
    width: 310,
    height: 252,
    transform: [{ rotate: '-3deg' }],
  },
  // 1e — location primer circle
  locateCircle: {
    width: 210,
    height: 210,
    borderRadius: 105,
    backgroundColor: categories.forest.tint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locateRing: {
    position: 'absolute',
    top: 26,
    left: 26,
    right: 26,
    bottom: 26,
    borderRadius: 999,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: ground.accent2,
  },
  disclaimer: {
    backgroundColor: '#f9e3cf',
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  disclaimerText: { fontFamily: fonts.bodySemi, fontSize: 12.5, lineHeight: 19, color: '#7c4a1e' },
  locationNote: { fontFamily: fonts.bodySemi, fontSize: 12.5, color: ground.textMuted },
  dots: { flexDirection: 'row', gap: 8, alignItems: 'center', paddingVertical: 16 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: ground.surface },
  dotActive: { width: 22, backgroundColor: ground.accent },
});
