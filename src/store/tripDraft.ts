import { create } from 'zustand';

import { AutoSwap } from '@/lib/corridor';
import { TransportMode } from '@/store';

/**
 * Draft state for the custom-trip planner (design 3a–3e). Session-only —
 * deliberately NOT persisted; a saved trip becomes a regular activeRoute.
 * Shared between the route tab and the point-picker / hand-picker modals.
 */

export type TripScope = 'quick' | 'custom';

export interface TripPoint {
  lat: number;
  lng: number;
  /** Human label: park name, "Current location", or coordinates. */
  label: string;
  kind: 'current' | 'park' | 'map';
  parkId?: string;
}

interface TripDraftState {
  start: TripPoint | null;
  end: TripPoint | null;
  roundTrip: boolean;
  /**
   * How many parks the engine should pick along the way, kept per scope: a
   * quick trip is all auto-picks, while a custom trip auto-fills *around*
   * hand-picks, so 0 there means "only the parks I chose myself".
   */
  autoCount: Record<TripScope, number>;
  /** Hand-picked park ids — locked, auto-fill never drops them. */
  lockedIds: string[];
  /** Auto-picks the user removed with ×; the engine won't re-pick them. */
  excludedIds: string[];
  /** Diff rows from the last recompute (design 3c) with Undo. */
  swaps: AutoSwap[];
  /** Auto-pick set from the previous compute, for diffing. */
  prevAutoIds: string[];
  prevTotalKm: number;
  mode: TransportMode;

  setStart: (p: TripPoint | null) => void;
  setEnd: (p: TripPoint | null) => void;
  setRoundTrip: (on: boolean) => void;
  setAutoCount: (scope: TripScope, n: number) => void;
  setMode: (m: TransportMode) => void;
  toggleLocked: (parkId: string) => void;
  clearLocked: () => void;
  excludeAuto: (parkId: string) => void;
  /** Undo a swap: lock the replaced park back in, allow the new one out. */
  undoSwap: (swap: AutoSwap) => void;
  setSwaps: (swaps: AutoSwap[], autoIds: string[], totalKm: number) => void;
  clearSwaps: () => void;
  reset: () => void;
}

const initial = {
  start: null,
  end: null,
  // Loop from where you stand is the default outing (design 1m).
  roundTrip: true,
  autoCount: { quick: 6, custom: 0 } as Record<TripScope, number>,
  lockedIds: [] as string[],
  excludedIds: [] as string[],
  swaps: [] as AutoSwap[],
  prevAutoIds: [] as string[],
  prevTotalKm: 0,
  mode: 'walk' as TransportMode,
};

export const useTripDraft = create<TripDraftState>()((set) => ({
  ...initial,
  setStart: (start) => set({ start }),
  setEnd: (end) => set({ end }),
  setRoundTrip: (roundTrip) => set({ roundTrip }),
  // Bounds live in the route screen: it knows the visit log (upper cap) and
  // the scope (a quick trip needs ≥ 1 park, a custom one can be hand-picks
  // only). Here we only refuse a negative count.
  setAutoCount: (scope, n) =>
    set((s) => ({ autoCount: { ...s.autoCount, [scope]: Math.max(0, n) } })),
  setMode: (mode) => set({ mode }),
  toggleLocked: (parkId) =>
    set((s) => ({
      lockedIds: s.lockedIds.includes(parkId)
        ? s.lockedIds.filter((id) => id !== parkId)
        : [...s.lockedIds, parkId],
      // picking a park by hand also un-excludes it
      excludedIds: s.excludedIds.filter((id) => id !== parkId),
    })),
  clearLocked: () => set({ lockedIds: [] }),
  excludeAuto: (parkId) =>
    set((s) => ({
      excludedIds: s.excludedIds.includes(parkId) ? s.excludedIds : [...s.excludedIds, parkId],
      lockedIds: s.lockedIds.filter((id) => id !== parkId),
    })),
  undoSwap: (swap) =>
    set((s) => ({
      swaps: s.swaps.filter((x) => x !== swap),
      lockedIds: s.lockedIds.includes(swap.outId) ? s.lockedIds : [...s.lockedIds, swap.outId],
      excludedIds: s.excludedIds.filter((id) => id !== swap.outId),
    })),
  setSwaps: (swaps, prevAutoIds, prevTotalKm) => set({ swaps, prevAutoIds, prevTotalKm }),
  clearSwaps: () => set({ swaps: [], prevAutoIds: [], prevTotalKm: 0 }),
  reset: () => set({ ...initial }),
}));
