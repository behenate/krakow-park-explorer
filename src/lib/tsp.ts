import { distanceKm, Park } from '@/data/parks';
import { TransportMode } from '@/store';

/**
 * On-device route ordering: nearest-neighbour + 2-opt over a haversine matrix.
 * When the routing backend ships, the matrix comes from /matrix and legs from
 * /route (see okp-routing-backend-plan.md) — the solver stays the same.
 */

export interface OrderedLeg {
  park: Park;
  distanceKm: number;
  durationMin: number;
}

/** km/h estimates per mode; transit gets a boarding overhead per leg. */
const SPEED: Record<TransportMode, number> = { walk: 4.6, bike: 14, transit: 16 };
const TRANSIT_OVERHEAD_MIN = 8;
/** Streets are not straight lines — inflate haversine a little. */
const DETOUR = 1.28;

export function orderParks(
  start: { lat: number; lng: number },
  targets: Park[],
  mode: TransportMode,
): OrderedLeg[] {
  if (targets.length === 0) return [];

  // nearest neighbour
  const remaining = [...targets];
  const ordered: Park[] = [];
  let cur = { lat: start.lat, lng: start.lng };
  while (remaining.length) {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = distanceKm(cur.lat, cur.lng, remaining[i].lat, remaining[i].lng);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    const next = remaining.splice(best, 1)[0];
    ordered.push(next);
    cur = { lat: next.lat, lng: next.lng };
  }

  // 2-opt improvement (bounded)
  const dist = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) =>
    distanceKm(a.lat, a.lng, b.lat, b.lng);
  const tourLength = (tour: Park[]) => {
    let len = dist(start, tour[0]);
    for (let i = 0; i < tour.length - 1; i++) len += dist(tour[i], tour[i + 1]);
    return len;
  };
  let improved = true;
  let guard = 0;
  while (improved && guard < 40) {
    improved = false;
    guard++;
    for (let i = 0; i < ordered.length - 1; i++) {
      for (let j = i + 1; j < ordered.length; j++) {
        const candidate = [...ordered.slice(0, i), ...ordered.slice(i, j + 1).reverse(), ...ordered.slice(j + 1)];
        if (tourLength(candidate) < tourLength(ordered) - 1e-6) {
          ordered.splice(0, ordered.length, ...candidate);
          improved = true;
        }
      }
    }
  }

  // legs
  return relegLegs(start, ordered, mode);
}

/**
 * Map an ORDERED park array to legs, computing each leg's distance/duration
 * sequentially from the start location (same math as orderParks).
 */
export function relegLegs(
  start: { lat: number; lng: number },
  ordered: Park[],
  mode: TransportMode,
): OrderedLeg[] {
  const legs: OrderedLeg[] = [];
  let prev: { lat: number; lng: number } = start;
  for (const park of ordered) {
    const d = distanceKm(prev.lat, prev.lng, park.lat, park.lng) * DETOUR;
    const minutes = (d / SPEED[mode]) * 60 + (mode === 'transit' ? TRANSIT_OVERHEAD_MIN : 0);
    legs.push({ park, distanceKm: d, durationMin: Math.max(3, Math.round(minutes)) });
    prev = park;
  }
  return legs;
}

/** Split legs into day-sized chunks. */
export function chunkDays(legs: OrderedLeg[], parksPerDay: number): OrderedLeg[][] {
  const days: OrderedLeg[][] = [];
  for (let i = 0; i < legs.length; i += parksPerDay) days.push(legs.slice(i, i + parksPerDay));
  return days;
}
