import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { Body, Heading, PillButton } from '@/components/ui';
import { distanceKm, Park } from '@/data/parks';
import { useI18n } from '@/i18n';
import { categories, fonts, ground, radii, spacing } from '@/theme/tokens';

interface Props {
  visible: boolean;
  /** Candidate parks (unstamped). */
  parks: Park[];
  /** Origin used to show distances on rows. */
  origin: { lat: number; lng: number };
  /** Pre-selected park ids when the picker opens. */
  initialSelected?: string[];
  onConfirm: (ids: string[]) => void;
  onClose: () => void;
}

/** Full-screen custom-trip picker: searchable list of unstamped parks with toggleable selection. */
export function ParkPicker({ visible, parks, origin, initialSelected, onConfirm, onClose }: Props) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set(initialSelected ?? []));

  useEffect(() => {
    if (visible) {
      setQuery('');
      setSelected(new Set(initialSelected ?? []));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const filtered = useMemo(() => {
    let list = parks;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q));
    }
    return list
      .map((p) => ({ p, d: distanceKm(origin.lat, origin.lng, p.lat, p.lng) }))
      .sort((a, b) => a.d - b.d);
  }, [parks, query, origin]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Heading style={{ fontSize: 28 }}>{t('pickParks')}</Heading>
            <Body style={{ color: ground.textMuted, fontSize: 15 }}>
              {t('selectedCount', { n: selected.size })}
            </Body>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('done')}
            onPress={onClose}
            style={styles.closeBtn}
            hitSlop={6}
          >
            <Icon name="x" size={20} color={ground.text} />
          </Pressable>
        </View>

        <View style={styles.searchWrap}>
          <Icon name="search" size={18} color={ground.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('searchParks')}
            placeholderTextColor={ground.textMuted}
            style={styles.searchInput}
            accessibilityLabel={t('searchParks')}
          />
        </View>

        <FlatList
          data={filtered}
          keyExtractor={({ p }) => p.id}
          contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: 24, gap: 12 }}
          renderItem={({ item: { p, d } }) => {
            const isSelected = selected.has(p.id);
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={`${p.name}, ${t(p.category)}, ${d.toFixed(1)} km`}
                onPress={() => toggle(p.id)}
                style={[styles.row, isSelected && styles.rowSelected]}
              >
                <View style={[styles.rowDot, { backgroundColor: categories[p.category].ink }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{p.name}</Text>
                  <Text style={styles.rowSub}>
                    {t(p.category)} · {d.toFixed(1)} km
                  </Text>
                </View>
                {isSelected ? (
                  <Icon name="check" size={22} color={ground.accent} />
                ) : (
                  <View style={styles.rowEmpty} />
                )}
              </Pressable>
            );
          }}
        />

        <View style={[styles.footer, { paddingBottom: insets.bottom + 10 }]}>
          <PillButton
            label={t('confirmSelection')}
            disabled={selected.size === 0}
            onPress={() => onConfirm([...selected])}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: ground.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: spacing.md,
    marginBottom: 10,
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    backgroundColor: ground.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: ground.surface,
    borderRadius: radii.pill,
    paddingHorizontal: 16,
    marginHorizontal: spacing.md,
    marginBottom: 12,
    minHeight: 48,
  },
  searchInput: { flex: 1, fontFamily: fonts.body, fontSize: 16, color: ground.text, paddingVertical: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: ground.surfaceLight,
    borderRadius: radii.lg,
    paddingVertical: 16,
    paddingHorizontal: spacing.md,
    minHeight: 72,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  rowSelected: { borderColor: ground.accent },
  rowDot: { width: 12, height: 12, borderRadius: 6 },
  rowTitle: { fontFamily: fonts.bodySemi, fontSize: 17, color: ground.text },
  rowSub: { fontFamily: fonts.body, fontSize: 14.5, color: ground.textMuted, marginTop: 2 },
  rowEmpty: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: ground.textMuted,
    opacity: 0.5,
  },
  footer: { paddingHorizontal: spacing.md, paddingTop: 8 },
});
