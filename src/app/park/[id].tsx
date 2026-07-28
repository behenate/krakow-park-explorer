import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { Floaty } from '@/components/motion';
import { Body, Card, Dialog, Heading, PillButton, SectionLabel } from '@/components/ui';
import { StampView } from '@/components/StampView';
import { distanceKm, KRAKOW_CENTER, parkById } from '@/data/parks';
import { parkPhotos, photoCredits } from '@/data/parkPhotos';
import { useUserLocation } from '@/hooks/useUserLocation';
import { useI18n } from '@/i18n';
import { openNativeMaps } from '@/lib/nativeMaps';
import { persistPhoto, photoExists } from '@/lib/photos';
import { useAppStore } from '@/store';
import { categories, fonts, ground, radii, spacing } from '@/theme/tokens';

export default function ParkDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const park = parkById(id ?? '');
  const { t, lang } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const userLoc = useUserLocation();

  const visits = useAppStore((s) => s.visits);
  const stamp = useAppStore((s) => s.stamp);
  const addPhoto = useAppStore((s) => s.addPhoto);
  const setNote = useAppStore((s) => s.setNote);

  const [confirmVisible, setConfirmVisible] = useState(false);
  const [photoSourceVisible, setPhotoSourceVisible] = useState(false);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [noteDraft, setNoteDraft] = useState<string | null>(null);
  /**
   * Set the moment a park is stamped and cleared when this screen regains
   * focus. While set, the screen keeps rendering its un-stamped state so the
   * new stamp is never spoiled behind the celebration screen's push
   * transition — the stamp-slam animation gets to be the reveal.
   */
  const [holdStampReveal, setHoldStampReveal] = useState(false);

  const visit = park ? visits[park.id] : undefined;
  const showStamped = !!visit && !holdStampReveal;

  const pal = useMemo(() => (park ? categories[park.category] : categories.forest), [park]);

  useFocusEffect(
    useCallback(() => {
      // Back from the celebration — the user has seen the animation, reveal.
      setHoldStampReveal(false);
    }, []),
  );

  if (!park) return null;

  const origin = userLoc ?? KRAKOW_CENTER;
  const dist = distanceKm(origin.lat, origin.lng, park.lat, park.lng);
  const history = lang === 'pl' ? park.history.pl : park.history.en;
  const stampedDate = visit
    ? new Date(visit.stampedAt).toLocaleDateString(lang === 'pl' ? 'pl-PL' : 'en-GB', {
        day: 'numeric',
        month: 'short',
      })
    : null;

  const doStamp = () => {
    // Hold the reveal BEFORE writing to the store, so this screen never
    // renders the stamped state while the celebration is still animating in.
    setHoldStampReveal(true);
    stamp(park.id);
    setConfirmVisible(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // Shared full-screen celebration; it returns here (from: 'detail') so
    // the user lands on My Visit to add more memories.
    router.push({ pathname: '/stamp-success', params: { parkId: park.id, from: 'detail' } });
  };

  /**
   * Add a memory photo from an explicitly chosen source. The user picks
   * camera or gallery up front rather than the camera being tried first
   * with a silent fall-through to the library.
   */
  const addPhotoFrom = async (source: 'camera' | 'library') => {
    setPhotoSourceVisible(false);
    // The chooser is a React Native <Modal>. Presenting the system picker
    // while it is still on screen is silently dropped on iOS (you cannot
    // present two view controllers at once), so wait out the fade-out first.
    // The camera path only appeared to work because its permission request
    // happened to yield long enough for the modal to go away.
    await closeModalAndSettle();

    let res: ImagePicker.ImagePickerResult | null;
    if (source === 'camera') {
      const perm = await ImagePicker.requestCameraPermissionsAsync().catch(() => null);
      if (!perm?.granted) return;
      res = await ImagePicker.launchCameraAsync({ quality: 0.8 }).catch(() => null);
    } else {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync().catch(() => null);
      if (!perm?.granted) return;
      res = await ImagePicker.launchImageLibraryAsync({ quality: 0.8 }).catch(() => null);
    }
    if (!res || res.canceled || !res.assets[0]) return;

    // Best-effort geotag — never blocks adding the photo.
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
      // location unavailable — save photo without coordinates
    }
    addPhoto(park.id, { uri: persistPhoto(res.assets[0].uri), lat, lng });
  };

  return (
    <View style={{ flex: 1, backgroundColor: ground.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
        {/* Design: category tint melts into the cream ground down the page —
            the gradient scrolls with the content. */}
        <LinearGradient
          // Solid tint for the 500px overscroll skirt above the screen, then
          // the tint→bg fade over the visible 0–340px as per the design.
          colors={[pal.tint, pal.tint, ground.bg]}
          locations={[0, GRADIENT_SKIRT / (GRADIENT_SKIRT + 340), 1]}
          style={styles.headerGradient}
          pointerEvents="none"
        />
        {/* Themed header */}
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <View style={styles.headerRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              onPress={() => router.back()}
              style={styles.backBtn}
            >
              <Icon name="back" size={22} color={ground.text} />
            </Pressable>
            {showStamped ? (
              <View style={[styles.stampedBadge, { backgroundColor: categories.forest.tint }]}>
                <Text style={[styles.stampedBadgeText, { color: categories.forest.deep }]}>
                  {t('stampedOn')} {stampedDate}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Park photo (Wikimedia Commons, WebP) with required attribution */}
          {parkPhotos[park.id] ? (
            <View style={styles.photoWrap}>
              <Image
                source={parkPhotos[park.id]}
                style={styles.photo}
                resizeMode="cover"
                accessibilityIgnoresInvertColors
                accessibilityLabel={park.name}
              />
              {photoCredits[park.id] ? (
                <Text style={styles.photoCredit} numberOfLines={1}>
                  © {photoCredits[park.id].author} · {photoCredits[park.id].license}
                </Text>
              ) : null}
            </View>
          ) : (
            <View style={styles.photoPlaceholder}>
              <Text style={styles.photoPlaceholderText}>PARK PHOTO</Text>
            </View>
          )}

          <View style={styles.titleRow}>
            <Heading style={{ fontSize: 34, flex: 1 }}>{park.name}</Heading>
            {/* Hero stamp: double size, fixed 15° left tilt, gently floating. */}
            <Floaty>
              <StampView parkId={park.id} size={128} stamped={showStamped} rotation={-15} />
            </Floaty>
          </View>
          <View style={styles.pillRow}>
            <View style={[styles.catPill, { backgroundColor: pal.ink }]}>
              <View style={styles.catDot} />
              <Text style={styles.catPillText}>{t(park.category)}</Text>
            </View>
            <View style={styles.distPill}>
              <Text style={styles.distPillText}>
                {dist.toFixed(1)} {t('kmAway')}
              </Text>
            </View>
          </View>
        </View>

        <View style={{ paddingHorizontal: spacing.md, gap: spacing.md }}>
          {/* Actions */}
          {!showStamped ? (
            <PillButton
              label={t('markAsStamped')}
              color={pal.ink}
              icon={<Icon name="stamp" size={19} color={ground.white} />}
              onPress={() => setConfirmVisible(true)}
            />
          ) : null}
          {/* Photo lives in My Visit only — no duplicate action here. */}
          <View style={styles.actionRow}>
            <PillButton
              label={t('navigate')}
              variant="outline"
              style={{ flex: 1 }}
              onPress={() => openNativeMaps(park.lat, park.lng, park.name)}
            />
            <PillButton
              label={t('route')}
              variant="outline"
              style={{ flex: 1 }}
              onPress={() => router.navigate('/(tabs)/route')}
            />
          </View>

          {/* My visit */}
          {showStamped && visit ? (
            <Card>
              <SectionLabel color={pal.deep}>{t('myVisit')}</SectionLabel>
              <View style={styles.photoRow}>
                {visit.photos
                  .filter((photo) => photoExists(photo.uri))
                  .map((photo) => (
                    <Image key={photo.uri} source={{ uri: photo.uri }} style={styles.visitPhoto} />
                  ))}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('addMemoryPhoto')}
                  onPress={() => setPhotoSourceVisible(true)}
                  style={styles.addPhoto}
                >
                  <Icon name="plus" size={22} color={ground.textMuted} />
                </Pressable>
              </View>
              {noteDraft !== null ? (
                <View style={styles.noteEdit}>
                  <TextInput
                    value={noteDraft}
                    onChangeText={setNoteDraft}
                    multiline
                    autoFocus
                    style={styles.noteInput}
                  />
                  <PillButton
                    label={t('done')}
                    color={pal.ink}
                    onPress={() => {
                      setNote(park.id, noteDraft.trim());
                      setNoteDraft(null);
                    }}
                  />
                </View>
              ) : visit.note ? (
                <View style={styles.noteBox}>
                  <Body style={{ fontStyle: 'italic' }}>&ldquo;{visit.note}&rdquo;</Body>
                </View>
              ) : null}
              <View style={styles.visitFooter}>
                <Pressable accessibilityRole="button" onPress={() => setNoteDraft(visit.note ?? '')}>
                  <Text style={[styles.link, { color: pal.deep }]}>
                    {visit.note ? t('editNote') : t('addNote')}
                  </Text>
                </Pressable>
              </View>
            </Card>
          ) : null}

          {/* Park history */}
          <View>
            <SectionLabel color={pal.deep}>{t('parkHistory')}</SectionLabel>
            <Body numberOfLines={historyExpanded ? undefined : 3}>{history}</Body>
            <Pressable accessibilityRole="button" onPress={() => setHistoryExpanded((e) => !e)}>
              <Text style={[styles.link, { color: pal.deep, marginTop: 4 }]}>
                {historyExpanded ? t('less') : t('more')}
              </Text>
            </Pressable>
          </View>

          {/* Footer links */}
          <View style={styles.footerLinks}>
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                Linking.openURL(
                  `mailto:zzm@zzm.krakow.pl?subject=${encodeURIComponent(`OKP box problem: ${park.name}`)}`,
                )
              }
            >
              <Text style={styles.footerLink}>{t('reportBox')}</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      {/* Stamp confirmation */}
      <Dialog visible={confirmVisible} onClose={() => setConfirmVisible(false)}>
        <Heading style={{ fontSize: 24, textAlign: 'center' }}>{t('stampConfirmTitle')}</Heading>
        <Body style={{ textAlign: 'center', color: ground.textMuted }}>{t('stampConfirmBody')}</Body>
        <PillButton label={t('stampConfirmYes')} color={pal.ink} onPress={doStamp} />
        <PillButton label={t('stampConfirmNo')} variant="ghost" onPress={() => setConfirmVisible(false)} />
      </Dialog>

      {/* Photo source picker — camera or gallery, chosen explicitly */}
      <Dialog visible={photoSourceVisible} onClose={() => setPhotoSourceVisible(false)}>
        <Heading style={{ fontSize: 24, textAlign: 'center' }}>{t('addPhotoMemory')}</Heading>
        <PillButton
          label={t('takePhoto')}
          color={pal.ink}
          icon={<Icon name="cam" size={19} color={ground.white} />}
          onPress={() => void addPhotoFrom('camera')}
        />
        <PillButton
          label={t('chooseFromGallery')}
          variant="outline"
          onPress={() => void addPhotoFrom('library')}
        />
        <PillButton
          label={t('maybeLater')}
          variant="ghost"
          onPress={() => setPhotoSourceVisible(false)}
        />
      </Dialog>
    </View>
  );
}

/**
 * How far the gradient extends above the screen so a hard overscroll pull
 * (iOS bounce) never reveals the bare background above it.
 */
const GRADIENT_SKIRT = 500;

/**
 * Wait for a dismissed <Modal> to actually leave the screen before presenting
 * a native picker over it. Matches the Dialog's `animationType="fade"` plus a
 * small margin; without it iOS drops the picker presentation entirely.
 */
const MODAL_DISMISS_MS = 400;
const closeModalAndSettle = () => new Promise<void>((resolve) => setTimeout(resolve, MODAL_DISMISS_MS));

const styles = StyleSheet.create({
  // Design source: background: linear-gradient(var(--tint) 0, var(--bg) 340px)
  // — the tint fades fully into the cream ground by exactly 340pt.
  headerGradient: {
    position: 'absolute',
    top: -GRADIENT_SKIRT,
    left: 0,
    right: 0,
    height: GRADIENT_SKIRT + 340,
  },
  header: { paddingHorizontal: spacing.md, gap: 12, paddingBottom: 6 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: ground.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stampedBadge: { borderRadius: radii.pill, paddingVertical: 8, paddingHorizontal: 14 },
  stampedBadgeText: { fontFamily: fonts.bodySemi, fontSize: 14.5 },
  photoWrap: { borderRadius: radii.lg, overflow: 'hidden' },
  photo: { width: '100%', height: 150 },
  photoCredit: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 3,
    paddingHorizontal: 10,
    fontFamily: fonts.body,
    fontSize: 10.5,
    color: 'rgba(255,255,255,0.95)',
    backgroundColor: 'rgba(32,30,29,0.45)',
  },
  photoPlaceholder: {
    height: 150,
    borderRadius: radii.lg,
    backgroundColor: 'rgba(255,255,255,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPlaceholderText: { fontFamily: fonts.bodySemi, letterSpacing: 2, color: ground.textMuted, fontSize: 13 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pillRow: { flexDirection: 'row', gap: 10 },
  catPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: radii.pill,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  catDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: ground.white },
  catPillText: { color: ground.white, fontFamily: fonts.bodySemi, fontSize: 15 },
  distPill: {
    backgroundColor: ground.surfaceLight,
    borderRadius: radii.pill,
    paddingVertical: 7,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  distPillText: { fontFamily: fonts.body, fontSize: 15, color: ground.text },
  actionRow: { flexDirection: 'row', gap: 10 },
  photoRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginBottom: 12 },
  visitPhoto: { width: 92, height: 92, borderRadius: radii.md },
  addPhoto: {
    width: 92,
    height: 92,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: ground.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteBox: { backgroundColor: ground.bg, borderRadius: radii.md, padding: 14 },
  noteEdit: { gap: 10 },
  noteInput: {
    backgroundColor: ground.bg,
    borderRadius: radii.md,
    padding: 14,
    fontFamily: fonts.body,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
    color: ground.text,
  },
  visitFooter: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 10 },
  link: { fontFamily: fonts.bodyBold, fontSize: 15.5 },
  footerLinks: { gap: 10, marginTop: 6 },
  footerLink: { fontFamily: fonts.body, fontSize: 15.5, color: ground.textMuted },
});
