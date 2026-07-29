import React, { useEffect, useRef, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Heading, PillButton, SectionLabel } from '@/components/ui';
import { GITHUB_URL, ZZM } from '@/config';
import { localeTag, useI18n } from '@/i18n';
import { LANGUAGE_LABELS, LANGUAGE_ORDER } from '@/i18n/language';
import { autoBackupIfEnabled, exportBackup, importBackup, writeLocalBackup } from '@/lib/backup';
import { exportPhotosToGallery } from '@/lib/photos';
import { useAppStore } from '@/store';
import { categories, fonts, ground, radii, spacing } from '@/theme/tokens';

export default function SettingsScreen() {
  const { t, lang } = useI18n();
  const insets = useSafeAreaInsets();

  const settings = useAppStore((s) => s.settings);
  const setSettings = useAppStore((s) => s.setSettings);
  const [restored, setRestored] = useState(false);
  const restoredTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [exportingPhotos, setExportingPhotos] = useState(false);
  const [photosNote, setPhotosNote] = useState<string | null>(null);
  const photosNoteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-backup: debounce 3s after visits change, then write the local bundle.
  useEffect(() => {
    let debounce: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = useAppStore.subscribe((state, prev) => {
      if (state.visits === prev.visits) return;
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => {
        void autoBackupIfEnabled();
      }, 3000);
    });
    return () => {
      unsubscribe();
      if (debounce) clearTimeout(debounce);
    };
  }, []);

  useEffect(
    () => () => {
      if (restoredTimer.current) clearTimeout(restoredTimer.current);
      if (photosNoteTimer.current) clearTimeout(photosNoteTimer.current);
    },
    [],
  );

  const handleExportPhotos = async () => {
    if (exportingPhotos) return;
    setExportingPhotos(true);
    try {
      const saved = await exportPhotosToGallery();
      setPhotosNote(
        saved === null
          ? t('photosPermissionDenied')
          : saved === 0
            ? t('noPhotosToExport')
            : t('photosExported', { count: saved }),
      );
      if (photosNoteTimer.current) clearTimeout(photosNoteTimer.current);
      photosNoteTimer.current = setTimeout(() => setPhotosNote(null), 3000);
    } finally {
      setExportingPhotos(false);
    }
  };

  const handleImport = async () => {
    const ok = await importBackup();
    if (!ok) return;
    setRestored(true);
    if (restoredTimer.current) clearTimeout(restoredTimer.current);
    restoredTimer.current = setTimeout(() => setRestored(false), 2500);
  };

  const service = Platform.OS === 'ios' ? 'iCloud' : 'Google Drive';
  const lastBackup = settings.lastBackupAt
    ? new Date(settings.lastBackupAt).toLocaleString(localeTag(lang), {
        hour: '2-digit',
        minute: '2-digit',
        day: 'numeric',
        month: 'short',
      })
    : null;

  const backupNow = () => {
    void writeLocalBackup();
  };

  const languageLabel =
    settings.language === 'system'
      ? `${t('systemDefault')} (${LANGUAGE_LABELS[lang]})`
      : LANGUAGE_LABELS[settings.language];

  const cycleLanguage = () => {
    const next = LANGUAGE_ORDER[(LANGUAGE_ORDER.indexOf(settings.language) + 1) % LANGUAGE_ORDER.length];
    setSettings({ language: next });
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: ground.bg }}
      contentContainerStyle={{ paddingTop: insets.top + 16, padding: spacing.md, gap: 14, paddingBottom: 40 }}
    >
      <Heading>{t('settings')}</Heading>

      <SectionLabel color={ground.text}>{t('backup')}</SectionLabel>
      <View style={styles.rowCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle}>{t('autoBackup', { service })}</Text>
          <Text style={styles.rowSub}>
            {lastBackup ? t('lastBackup', { when: lastBackup }) : t('neverBackedUp')}
          </Text>
        </View>
        <Switch
          value={settings.autoBackup}
          onValueChange={(v) => setSettings({ autoBackup: v })}
          trackColor={{ true: categories.forest.ink, false: ground.surface }}
          thumbColor={ground.white}
          accessibilityLabel={t('autoBackup', { service })}
        />
      </View>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <PillButton label={t('backUpNow')} variant="outline" style={{ flex: 1 }} onPress={backupNow} />
        <PillButton
          label={t('restore')}
          variant="outline"
          style={{ flex: 1 }}
          onPress={() => void handleImport()}
        />
      </View>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <PillButton
          label={t('exportBackup')}
          variant="outline"
          style={{ flex: 1 }}
          onPress={() => void exportBackup()}
        />
        <PillButton
          label={t('importBackup')}
          variant="outline"
          style={{ flex: 1 }}
          onPress={() => void handleImport()}
        />
      </View>
      {restored ? <Text style={styles.restoredNote}>{t('backupRestored')}</Text> : null}
      <PillButton
        label={t('exportPhotosToGallery')}
        variant="outline"
        disabled={exportingPhotos}
        onPress={() => void handleExportPhotos()}
      />
      {photosNote ? <Text style={styles.restoredNote}>{photosNote}</Text> : null}

      <SectionLabel color={ground.text} style={{ marginTop: 8 }}>
        {t('language')}
      </SectionLabel>
      <Pressable accessibilityRole="button" onPress={cycleLanguage} style={styles.rowCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle}>{t('language')}</Text>
          <Text style={styles.rowSub}>{languageLabel}</Text>
        </View>
      </Pressable>

      <SectionLabel color={ground.text} style={{ marginTop: 8 }}>
        {t('helpSection')}
      </SectionLabel>
      <Pressable
        accessibilityRole="button"
        onPress={() => Linking.openURL(ZZM.okpUrl)}
        style={styles.rowCard}
      >
        <Text style={styles.rowTitle}>{t('getBooklet')}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={() => Linking.openURL(ZZM.okpUrl)}
        style={styles.rowCard}
      >
        <Text style={styles.rowTitle}>{t('rulesFaq')}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={() => Linking.openURL(`mailto:${ZZM.email}?subject=OKP`)}
        style={styles.rowCard}
      >
        <Text style={styles.rowTitle}>{t('reportToZzm')}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={t('github')}
        onPress={() => Linking.openURL(GITHUB_URL)}
        style={styles.rowCard}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle}>{t('github')}</Text>
          <Text style={styles.rowSub}>{t('githubSub')}</Text>
        </View>
      </Pressable>

      <View style={{ marginTop: 20, gap: 8 }}>
        <Body style={{ color: ground.textMuted, fontSize: 14, lineHeight: 21 }}>{t('aboutFooter')}</Body>
        <Pressable accessibilityRole="button" onPress={() => setSettings({ onboardingDone: false })}>
          <Text style={styles.replay}>{t('replayIntro')}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: ground.surfaceLight,
    borderRadius: radii.lg,
    padding: spacing.md,
    minHeight: 68,
  },
  rowTitle: { fontFamily: fonts.bodySemi, fontSize: 16.5, color: ground.text },
  rowSub: { fontFamily: fonts.body, fontSize: 14.5, color: ground.textMuted, marginTop: 3 },
  replay: { fontFamily: fonts.body, fontSize: 14, color: ground.textMuted, textDecorationLine: 'underline' },
  restoredNote: {
    fontFamily: fonts.bodySemi,
    fontSize: 14.5,
    color: categories.forest.ink,
    textAlign: 'center',
  },
});
