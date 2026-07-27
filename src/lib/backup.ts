import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { useAppStore, type Settings, type Visit } from '@/store';

const BACKUP_VERSION = 1;
const AUTO_BACKUP_FILENAME = 'parko-autobackup.json';

interface BackupState {
  visits: Record<string, Visit>;
  distanceKmTotal: number;
  settings: Settings;
  celebratedMilestones: number[];
}

interface BackupPayload {
  version: number;
  exportedAt: string;
  state: BackupState;
}

/** Serialize the persisted app state (excluding activeRoute) as a versioned JSON backup. */
export function serializeBackup(): string {
  const { visits, distanceKmTotal, settings, celebratedMilestones } = useAppStore.getState();
  const payload: BackupPayload = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    state: { visits, distanceKmTotal, settings, celebratedMilestones },
  };
  return JSON.stringify(payload, null, 2);
}

/**
 * Export the backup as a dated JSON file and open the share sheet, so the user
 * can save it to Google Drive / iCloud Drive / Files or send it elsewhere.
 */
export async function exportBackup(): Promise<void> {
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const file = new File(Paths.cache, `okp-backup-${date}.json`);
  file.write(serializeBackup());
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json' });
}

function isValidBackup(data: unknown): data is BackupPayload {
  if (typeof data !== 'object' || data === null) return false;
  const payload = data as Partial<BackupPayload>;
  if (payload.version !== BACKUP_VERSION) return false;
  const state = payload.state;
  if (typeof state !== 'object' || state === null) return false;
  return typeof state.visits === 'object' && state.visits !== null;
}

/**
 * Let the user pick a backup JSON file and restore it into the store.
 * @returns true when a backup was restored, false on cancel or invalid file.
 */
export async function importBackup(): Promise<boolean> {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/json',
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled || !result.assets?.length) return false;

    const raw = await new File(result.assets[0].uri).text();
    const parsed: unknown = JSON.parse(raw);
    if (!isValidBackup(parsed)) return false;

    const { visits, distanceKmTotal, settings, celebratedMilestones } = parsed.state;
    useAppStore.setState((current) => ({
      visits,
      distanceKmTotal: typeof distanceKmTotal === 'number' ? distanceKmTotal : current.distanceKmTotal,
      settings: { ...current.settings, ...settings },
      celebratedMilestones: Array.isArray(celebratedMilestones)
        ? celebratedMilestones
        : current.celebratedMilestones,
      activeRoute: null,
    }));
    return true;
  } catch {
    return false;
  }
}

/**
 * Write the local backup bundle now (regardless of the auto-backup toggle)
 * and update settings.lastBackupAt. Used by the "Back up now" button.
 */
export async function writeLocalBackup(): Promise<void> {
  const file = new File(Paths.document, AUTO_BACKUP_FILENAME);
  file.write(serializeBackup());
  useAppStore.getState().setSettings({ lastBackupAt: new Date().toISOString() });
}

/**
 * Write the local auto-backup bundle if the user has auto-backup enabled.
 * Cloud (iCloud/Drive) sync is a native integration step — see okp-app-requirements.md §4.11;
 * this local bundle is what gets synced.
 */
export async function autoBackupIfEnabled(): Promise<void> {
  const { settings } = useAppStore.getState();
  if (!settings.autoBackup) return;
  try {
    await writeLocalBackup();
  } catch {
    // Backup is best-effort; never crash the app over it.
  }
}
