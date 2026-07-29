import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { parkById, TOTAL_PARKS } from '@/data/parks';
import { LanguageSetting } from '@/i18n/language';

export type TransportMode = 'walk' | 'bike' | 'transit';

export interface VisitPhoto {
  uri: string; // local URI
  lat?: number;
  lng?: number;
}

export interface Visit {
  parkId: string;
  stampedAt: string; // ISO date
  note?: string;
  photos: VisitPhoto[];
}

export interface RouteLeg {
  parkId: string;
  distanceKm: number;
  durationMin: number;
  done: boolean;
}

export interface ActiveRoute {
  mode: TransportMode;
  /** Which planner produced it (design 1m/3a); legacy routes have none. */
  kind?: 'quick' | 'custom';
  legs: RouteLeg[];
  dayIndex: number;
  dayCount: number;
  following: boolean;
  trackingEnabled: boolean; // background permission granted
  startedAt?: string;
  /** Custom trips (design 3a–3c): explicit anchors; loop when roundTrip. */
  startPoint?: { lat: number; lng: number; label: string };
  endPoint?: { lat: number; lng: number; label: string };
  roundTrip?: boolean;
}

export interface Settings {
  language: LanguageSetting;
  autoBackup: boolean;
  lastBackupAt?: string;
  onboardingDone: boolean;
}

interface AppState {
  visits: Record<string, Visit>;
  distanceKmTotal: number;
  settings: Settings;
  activeRoute: ActiveRoute | null;
  /** Milestone counts already celebrated, so we fire each once. */
  celebratedMilestones: number[];

  stamp: (parkId: string) => void;
  unstamp: (parkId: string) => void;
  addPhoto: (parkId: string, photo: VisitPhoto) => void;
  setNote: (parkId: string, note: string) => void;
  setSettings: (patch: Partial<Settings>) => void;
  setActiveRoute: (route: ActiveRoute | null) => void;
  setFollowing: (following: boolean) => void;
  completeLeg: (parkId: string) => void;
  markCelebrated: (n: number) => void;
}

export const MILESTONES = [10, 25, 50, TOTAL_PARKS];

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      visits: {},
      distanceKmTotal: 0,
      settings: {
        language: 'system',
        autoBackup: true,
        onboardingDone: false,
      },
      activeRoute: null,
      celebratedMilestones: [],

      stamp: (parkId) =>
        set((s) => ({
          visits: {
            ...s.visits,
            [parkId]: s.visits[parkId] ?? { parkId, stampedAt: new Date().toISOString(), photos: [] },
          },
        })),
      unstamp: (parkId) =>
        set((s) => {
          const visits = { ...s.visits };
          delete visits[parkId];
          return { visits };
        }),
      addPhoto: (parkId, photo) =>
        set((s) => {
          const v = s.visits[parkId];
          if (!v) return s;
          return { visits: { ...s.visits, [parkId]: { ...v, photos: [...v.photos, photo] } } };
        }),
      setNote: (parkId, note) =>
        set((s) => {
          const v = s.visits[parkId];
          if (!v) return s;
          return { visits: { ...s.visits, [parkId]: { ...v, note } } };
        }),
      setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      setActiveRoute: (activeRoute) => set({ activeRoute }),
      setFollowing: (following) =>
        set((s) => (s.activeRoute ? { activeRoute: { ...s.activeRoute, following } } : s)),
      completeLeg: (parkId) =>
        set((s) => {
          if (!s.activeRoute) return s;
          const legs = s.activeRoute.legs.map((l) => (l.parkId === parkId ? { ...l, done: true } : l));
          const leg = s.activeRoute.legs.find((l) => l.parkId === parkId);
          const added = leg && !leg.done ? leg.distanceKm : 0;
          return {
            activeRoute: { ...s.activeRoute, legs },
            distanceKmTotal: s.distanceKmTotal + added,
          };
        }),
      markCelebrated: (n) =>
        set((s) => ({ celebratedMilestones: [...new Set([...s.celebratedMilestones, n])] })),
    }),
    {
      name: 'parko-store',
      storage: createJSONStorage(() => AsyncStorage),
      version: 5,
      migrate: (persisted, version) => {
        const state = persisted as Partial<AppState> | undefined;
        if (state && version < 2 && state.visits) {
          const visits: Record<string, Visit> = {};
          for (const [id, v] of Object.entries(state.visits)) {
            const photos = ((v as { photos?: unknown }).photos ?? []) as unknown[];
            visits[id] = {
              ...(v as Visit),
              photos: photos.map((p) =>
                typeof p === 'string' ? { uri: p } : (p as VisitPhoto),
              ),
            };
          }
          state.visits = visits;
        }
        // v3/v4: drop phantom visits whose park id no longer exists in the
        // data (v4 re-runs the prune after the official-list revision).
        if (state && version < 4 && state.visits) {
          const visits: Record<string, Visit> = {};
          for (const [id, v] of Object.entries(state.visits)) {
            if (parkById(id)) visits[id] = v;
          }
          state.visits = visits;
        }
        // v5: cheat mode and the private box pin were removed from the app —
        // strip the leftover persisted fields so nothing lingers on device.
        if (state && version < 5) {
          if (state.visits) {
            const visits: Record<string, Visit> = {};
            for (const [id, v] of Object.entries(state.visits)) {
              const { boxPin, ...rest } = v as Visit & { boxPin?: unknown };
              void boxPin;
              visits[id] = rest as Visit;
            }
            state.visits = visits;
          }
          if (state.settings) {
            const { neverShowCheats, ...rest } = state.settings as Settings & {
              neverShowCheats?: unknown;
            };
            void neverShowCheats;
            state.settings = rest as Settings;
          }
        }
        return state as AppState;
      },
    },
  ),
);

/** Photo URIs for a visit — kept for consumers that only need the image list. */
export function photoUris(v: Visit): string[] {
  return v.photos.map((p) => p.uri);
}

export function useStampedCount(): number {
  return useAppStore((s) => Object.keys(s.visits).length);
}
