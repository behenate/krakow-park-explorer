import { distanceKm, Park } from '@/data/parks';
import { TransportMode } from '@/store';

/**
 * Custom-trip engine (design 3a–3e): a route from a start point to an end
 * point (or a loop) that picks up parks along the way.
 *
 * - Hand-picked ("locked") parks are always included — auto-fill tops up
 *   around them and never drops them.
 * - Auto-fill inserts the N un-stamped parks with the cheapest insertion
 *   (detour) cost into the corridor.
 * - All live numbers are haversine × street factor (fast, offline); the
 *   preview/save step swaps in real Valhalla distances like the day-trip
 *   flow does.
 */

export interface GeoPoint {
  lat: number;
  lng: number;
}

const SPEED: Record<TransportMode, number> = { walk: 4.6, bike: 14, transit: 16 };
const TRANSIT_OVERHEAD_MIN = 8;
/** Streets are not straight lines — inflate haversine a little. */
const DETOUR = 1.28;

const d = (a: GeoPoint, b: GeoPoint) => distanceKm(a.lat, a.lng, b.lat, b.lng);

/** Length of start → stops… → end (raw haversine, no street factor). */
function pathLength(start: GeoPoint, stops: Park[], end: GeoPoint): number {
  let len = 0;
  let prev: GeoPoint = start;
  for (const p of stops) {
    len += d(prev, p);
    prev = p;
  }
  return len + d(prev, end);
}

/** Cheapest insertion position for a park into the current path. */
function bestInsertion(
  park: Park,
  start: GeoPoint,
  stops: Park[],
  end: GeoPoint,
): { index: number; cost: number } {
  let best = { index: 0, cost: Infinity };
  for (let i = 0; i <= stops.length; i++) {
    const prev: GeoPoint = i === 0 ? start : stops[i - 1];
    const next: GeoPoint = i === stops.length ? end : stops[i];
    const cost = d(prev, park) + d(park, next) - d(prev, next);
    if (cost < best.cost) best = { index: i, cost };
  }
  return best;
}

/** 2-opt with fixed endpoints (interior reversals only), bounded. */
function twoOpt(start: GeoPoint, stops: Park[], end: GeoPoint): Park[] {
  const tour = [...stops];
  let improved = true;
  let guard = 0;
  while (improved && guard < 30) {
    improved = false;
    guard++;
    for (let i = 0; i < tour.length - 1; i++) {
      for (let j = i + 1; j < tour.length; j++) {
        const candidate = [...tour.slice(0, i), ...tour.slice(i, j + 1).reverse(), ...tour.slice(j + 1)];
        if (pathLength(start, candidate, end) < pathLength(start, tour, end) - 1e-6) {
          tour.splice(0, tour.length, ...candidate);
          improved = true;
        }
      }
    }
  }
  return tour;
}

export interface TripPlan {
  /** Ordered stops start → … → end. */
  stops: Park[];
  /** Ids the engine picked (subset of stops, excludes locked). */
  autoIds: string[];
  /** Total km including the street factor. */
  totalKm: number;
  /** Direct start→end km including the street factor (0 for loops). */
  directKm: number;
  /** totalKm − directKm. */
  extraKm: number;
}

/**
 * Build the trip: locked parks first (cheapest-insertion order), then top up
 * with `autoCount` cheapest un-stamped candidates, then 2-opt polish.
 */
export function buildTrip(
  start: GeoPoint,
  end: GeoPoint,
  locked: Park[],
  autoCount: number,
  candidates: Park[],
  excludedIds: Set<string>,
): TripPlan {
  let stops: Park[] = [];

  const lockedPool = [...locked];
  while (lockedPool.length) {
    let bestIdx = 0;
    let best = { index: 0, cost: Infinity };
    for (let i = 0; i < lockedPool.length; i++) {
      const ins = bestInsertion(lockedPool[i], start, stops, end);
      if (ins.cost < best.cost) {
        best = ins;
        bestIdx = i;
      }
    }
    const park = lockedPool.splice(bestIdx, 1)[0];
    stops = [...stops.slice(0, best.index), park, ...stops.slice(best.index)];
  }

  const lockedIds = new Set(locked.map((p) => p.id));
  const pool = candidates.filter((p) => !lockedIds.has(p.id) && !excludedIds.has(p.id));
  const autoIds: string[] = [];
  for (let n = 0; n < autoCount && pool.length > 0; n++) {
    let bestIdx = 0;
    let best = { index: 0, cost: Infinity };
    for (let i = 0; i < pool.length; i++) {
      const ins = bestInsertion(pool[i], start, stops, end);
      if (ins.cost < best.cost) {
        best = ins;
        bestIdx = i;
      }
    }
    const park = pool.splice(bestIdx, 1)[0];
    stops = [...stops.slice(0, best.index), park, ...stops.slice(best.index)];
    autoIds.push(park.id);
  }

  stops = twoOpt(start, stops, end);

  const totalKm = pathLength(start, stops, end) * DETOUR;
  const directKm = d(start, end) * DETOUR;
  return { stops, autoIds, totalKm, directKm, extraKm: Math.max(0, totalKm - directKm) };
}

/** Live detour cost (km, street factor applied) of adding one park. */
export function detourKm(park: Park, start: GeoPoint, stops: Park[], end: GeoPoint): number {
  return bestInsertion(park, start, stops, end).cost * DETOUR;
}

export interface TripLeg {
  park: Park;
  distanceKm: number;
  durationMin: number;
}

/** Legs for the ordered stops + the final hop back to the end point. */
export function tripLegs(
  start: GeoPoint,
  stops: Park[],
  end: GeoPoint,
  mode: TransportMode,
): { legs: TripLeg[]; finalKm: number; finalMin: number } {
  const legs: TripLeg[] = [];
  let prev: GeoPoint = start;
  for (const park of stops) {
    const km = d(prev, park) * DETOUR;
    const minutes = (km / SPEED[mode]) * 60 + (mode === 'transit' ? TRANSIT_OVERHEAD_MIN : 0);
    legs.push({ park, distanceKm: km, durationMin: Math.max(3, Math.round(minutes)) });
    prev = park;
  }
  const finalKm = d(prev, end) * DETOUR;
  const finalMin = Math.round((finalKm / SPEED[mode]) * 60);
  return { legs, finalKm, finalMin };
}

/** Rough total duration (minutes) incl. ~20 min per park for the box hunt. */
export function tripMinutes(totalKm: number, stopCount: number, mode: TransportMode): number {
  const moving = (totalKm / SPEED[mode]) * 60;
  const overhead = mode === 'transit' ? TRANSIT_OVERHEAD_MIN * (stopCount + 1) : 0;
  return Math.round(moving + stopCount * 20 + overhead);
}

export interface AutoSwap {
  /** Park the engine swapped in. */
  inId: string;
  /** Park it replaced. */
  outId: string;
  /** Cost difference shown in the diff row (km, can be negative). */
  deltaKm: number;
}

/**
 * Diff two auto-pick sets after a recompute (design 3c): removed and added
 * ids are paired positionally into "X swapped in — replaces Y" rows.
 */
export function diffAutoPicks(
  prevAutoIds: string[],
  nextAutoIds: string[],
  prevTotalKm: number,
  nextTotalKm: number,
): AutoSwap[] {
  const prevSet = new Set(prevAutoIds);
  const nextSet = new Set(nextAutoIds);
  const removed = prevAutoIds.filter((id) => !nextSet.has(id));
  const added = nextAutoIds.filter((id) => !prevSet.has(id));
  const deltaKm = nextTotalKm - prevTotalKm;
  const n = Math.min(removed.length, added.length);
  const swaps: AutoSwap[] = [];
  for (let i = 0; i < n; i++) swaps.push({ inId: added[i], outId: removed[i], deltaKm: deltaKm / n });
  return swaps;
}
