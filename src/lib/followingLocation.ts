import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';

import { distanceKm, parkById } from '@/data/parks';
import { resolveLanguage } from '@/i18n/language';
import { Language, translations } from '@/i18n/translations';
import { useAppStore } from '@/store';

export const TASK_NAME = 'parko-following-location';

const ARRIVAL_RADIUS_KM = 0.18;

/** Parks we've already notified about this following session — avoids repeat pings. */
const notifiedParkIds = new Set<string>();

/** Resolve the app language outside React (tasks can't use hooks). */
function currentLanguage(): Language {
  return resolveLanguage(useAppStore.getState().settings.language);
}

function tr(key: keyof (typeof translations)['en']): string {
  const lang = currentLanguage();
  return translations[lang][key] ?? translations.en[key] ?? key;
}

// Show arrival notifications even while the app is foregrounded.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Defined at module scope so the task survives app relaunches in the background.
TaskManager.defineTask<{ locations: Location.LocationObject[] }>(
  TASK_NAME,
  async ({ data, error }) => {
    if (error || !data?.locations?.length) return;
    const { activeRoute } = useAppStore.getState();
    if (!activeRoute?.following || !activeRoute.trackingEnabled) return;

    const nextLeg = activeRoute.legs.find((l) => !l.done);
    const park = nextLeg ? parkById(nextLeg.parkId) : undefined;
    if (!park || notifiedParkIds.has(park.id)) return;

    const latest = data.locations[data.locations.length - 1];
    const d = distanceKm(latest.coords.latitude, latest.coords.longitude, park.lat, park.lng);
    if (d > ARRIVAL_RADIUS_KM) return;

    notifiedParkIds.add(park.id);
    await Notifications.scheduleNotificationAsync({
      content: {
        title: tr('arrivedTitle').replace('{park}', park.name),
        body: tr('arrivedBody'),
        data: { parkId: park.id },
      },
      trigger: null,
    });
  },
);

/**
 * Start background location updates for arrival detection.
 * Call only after foreground permission is granted; background is a best-effort
 * enhancement — the foreground watcher keeps working either way.
 */
export async function startBackgroundFollowing(): Promise<boolean> {
  try {
    const { status } = await Location.requestBackgroundPermissionsAsync();
    if (status !== Location.PermissionStatus.GRANTED) return false;
    await Location.startLocationUpdatesAsync(TASK_NAME, {
      accuracy: Location.Accuracy.Balanced,
      distanceInterval: 50,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: tr('appName'),
        notificationBody: tr('followingRoute'),
        killServiceOnDestroy: true,
      },
    });
    return true;
  } catch {
    return false;
  }
}

/** Stop background updates immediately (route ended / following stopped). */
export async function stopBackgroundFollowing(): Promise<void> {
  notifiedParkIds.clear();
  try {
    if (
      (await TaskManager.isTaskRegisteredAsync(TASK_NAME)) &&
      (await Location.hasStartedLocationUpdatesAsync(TASK_NAME))
    ) {
      await Location.stopLocationUpdatesAsync(TASK_NAME);
    }
  } catch {
    // best-effort — nothing to clean up if the task never started
  }
}

/** Ask for notification permission (arrival prompts). */
export async function requestNotifPermission(): Promise<boolean> {
  try {
    const res = await Notifications.requestPermissionsAsync();
    return res.granted;
  } catch {
    return false;
  }
}
