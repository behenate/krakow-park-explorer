import React, { useState } from 'react';
import {
  Modal,
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
import { ParkMap } from '@/components/ParkMap';
import { Body, Heading, PillButton } from '@/components/ui';
import { distanceKm, Park, parks } from '@/data/parks';
import { useI18n } from '@/i18n';
import { TripPoint } from '@/store/tripDraft';
import { categories, fonts, ground, radii, spacing } from '@/theme/tokens';

/**
 * Start/end point chooser for custom trips (design 3a "Change"):
 * current location, a park, or an arbitrary tap on the map. No geocoding —
 * fully offline.
 */

interface Props {
  visible: boolean;
  title: string;
  userLoc: { lat: number; lng: number } | null;
  currentLocationLabel: string;
  onPick: (point: TripPoint) => void;
  onClose: () => void;
}

type Mode = 'menu' | 'park' | 'map';

export function TripPointPicker({
  visible,
  title,
  userLoc,
  currentLocationLabel,
  onPick,
  onClose,
}: Props) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [mode, setMode] = useState<Mode>('menu');
  const [query, setQuery] = useState('');
  /** Map mode: the tapped point waits here until the user confirms. */
  const [pending, setPending] = useState<TripPoint | null>(null);

  const close = () => {
    setMode('menu');
    setQuery('');
    setPending(null);
    onClose();
  };

  const pick = (point: TripPoint) => {
    setMode('menu');
    setQuery('');
    setPending(null);
    onPick(point);
  };

  const filtered = parks.filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()));

  const parkRow = (p: Park) => (
    <Pressable
      key={p.id}
      accessibilityRole="button"
      onPress={() => pick({ lat: p.lat, lng: p.lng, label: p.name, kind: 'park', parkId: p.id })}
      style={styles.parkRow}
    >
      <View style={[styles.catDot, { backgroundColor: categories[p.category].ink }]} />
      <Text style={styles.parkName} numberOfLines={1}>
        {p.name}
      </Text>
    </Pressable>
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <View style={[styles.wrap, { paddingTop: insets.top + 10 }]}>
        <View style={styles.headerRow}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('back')} onPress={mode === 'menu' ? close : () => setMode('menu')} style={styles.backBtn}>
            <Icon name="back" size={18} color={ground.text} />
          </Pressable>
          <Heading style={{ fontSize: 24, flex: 1 }}>{title}</Heading>
        </View>

        {mode === 'menu' ? (
          <View style={{ gap: 12, padding: spacing.md }}>
            <PillButton
              label={currentLocationLabel}
              onPress={() =>
                pick({
                  lat: userLoc?.lat ?? 50.0619,
                  lng: userLoc?.lng ?? 19.9368,
                  label: currentLocationLabel,
                  kind: 'current',
                })
              }
            />
            <PillButton label={t('chooseAPark')} variant="outline" onPress={() => setMode('park')} />
            <PillButton label={t('pickOnMap')} variant="outline" onPress={() => setMode('map')} />
            <PillButton label={t('back')} variant="ghost" onPress={close} />
          </View>
        ) : null}

        {mode === 'park' ? (
          <View style={{ flex: 1 }}>
            <View style={styles.searchBox}>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={t('searchParks')}
                placeholderTextColor={ground.textMuted}
                style={styles.searchInput}
                autoFocus
              />
            </View>
            <ScrollView contentContainerStyle={{ padding: spacing.md, gap: 8, paddingBottom: insets.bottom + 20 }}>
              {filtered.map(parkRow)}
            </ScrollView>
          </View>
        ) : null}

        {mode === 'map' ? (
          <View style={{ flex: 1 }}>
            <Body style={{ paddingHorizontal: spacing.md, paddingBottom: 8, color: ground.textMuted }}>
              {t('tapMapHint')}
            </Body>
            <View style={{ flex: 1 }}>
              <ParkMap
                width={width}
                height={height - insets.top - 190}
                parks={parks}
                stampedIds={new Set()}
                userLocation={userLoc}
                // The chosen point shows as an anchor pin first; the pick is
                // only made once the user confirms below.
                anchors={pending ? { start: pending } : undefined}
                // A park pin selects the park itself (name + entrance), not
                // raw coordinates.
                onSelect={(p) =>
                  setPending({ lat: p.lat, lng: p.lng, label: p.name, kind: 'park', parkId: p.id })
                }
                onMapPress={(c) => {
                  // Snap to a park if the tap lands close to its pin — a park
                  // makes a better anchor than raw coordinates.
                  let nearest: Park | null = null;
                  let nearestD = 0.2; // km
                  for (const p of parks) {
                    const d = distanceKm(c.lat, c.lng, p.lat, p.lng);
                    if (d < nearestD) {
                      nearestD = d;
                      nearest = p;
                    }
                  }
                  setPending(
                    nearest
                      ? { lat: nearest.lat, lng: nearest.lng, label: nearest.name, kind: 'park', parkId: nearest.id }
                      : {
                          lat: c.lat,
                          lng: c.lng,
                          label: `${t('mapPoint')} (${c.lat.toFixed(3)}, ${c.lng.toFixed(3)})`,
                          kind: 'map',
                        },
                  );
                }}
              />
            </View>
            <View style={[styles.confirmBar, { paddingBottom: insets.bottom + 10 }]}>
              {pending ? (
                <Text style={styles.pendingLabel} numberOfLines={1}>
                  {pending.label}
                </Text>
              ) : null}
              <PillButton
                label={t('confirmPoint')}
                onPress={() => pending && pick(pending)}
                style={!pending ? { opacity: 0.4 } : undefined}
              />
            </View>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: ground.bg },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: spacing.md,
    paddingBottom: 8,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: ground.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBox: {
    marginHorizontal: spacing.md,
    backgroundColor: ground.surfaceLight,
    borderRadius: radii.pill,
    paddingHorizontal: 16,
  },
  searchInput: { fontFamily: fonts.body, fontSize: 16, color: ground.text, paddingVertical: 12 },
  parkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: ground.surfaceLight,
    borderRadius: radii.lg,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  catDot: { width: 11, height: 11, borderRadius: 6 },
  parkName: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 15.5, color: ground.text },
  confirmBar: {
    backgroundColor: ground.surfaceLight,
    paddingHorizontal: spacing.md,
    paddingTop: 10,
    gap: 8,
  },
  pendingLabel: {
    fontFamily: fonts.bodySemi,
    fontSize: 14.5,
    color: ground.text,
    textAlign: 'center',
  },
});
