import { TransportMode } from '@/store';

/**
 * Street-following route geometry via Valhalla (FOSSGIS public instance,
 * fair-use, keyless). When the self-hosted routing backend ships (see
 * okp-routing-backend-plan.md §3.1 — it is also Valhalla), only BASE_URL
 * changes. Display-only: leg ordering/distances still come from tsp.ts.
 * Falls back to straight lines when offline or on any failure.
 */

const BASE_URL = 'https://valhalla1.openstreetmap.de/route';
const TIMEOUT_MS = 12000;

export type LngLatCoord = [lng: number, lat: number];

const COSTING: Record<TransportMode, string> = {
  walk: 'pedestrian',
  bike: 'bicycle',
  // Transit paths aren't modelled by Valhalla's free instance; pedestrian is
  // the closest visual approximation until the OTP2 backend exists.
  transit: 'pedestrian',
};

/** Decode Valhalla's polyline6 shape into [lng, lat] coordinates. */
export function decodePolyline6(encoded: string): LngLatCoord[] {
  const coords: LngLatCoord[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    for (const which of [0, 1] as const) {
      let result = 0;
      let shift = 0;
      let byte: number;
      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      const delta = result & 1 ? ~(result >> 1) : result >> 1;
      if (which === 0) lat += delta;
      else lng += delta;
    }
    coords.push([lng / 1e6, lat / 1e6]);
  }
  return coords;
}

interface ValhallaLeg {
  shape: string;
}

interface ValhallaResponse {
  trip?: { legs?: ValhallaLeg[] };
}

const cache = new Map<string, LngLatCoord[]>();

function cacheKey(points: { lat: number; lng: number }[], mode: TransportMode): string {
  return mode + '|' + points.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join(';');
}

/**
 * Fetch the full street-following geometry for an ordered set of points
 * (start + stops). Returns null on any failure — callers fall back to
 * straight lines.
 */
export async function fetchRouteGeometry(
  points: { lat: number; lng: number }[],
  mode: TransportMode,
): Promise<LngLatCoord[] | null> {
  if (points.length < 2) return null;
  const key = cacheKey(points, mode);
  const cached = cache.get(key);
  if (cached) return cached;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        locations: points.map((p) => ({ lat: p.lat, lon: p.lng })),
        costing: COSTING[mode],
        directions_options: { units: 'kilometers' },
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as ValhallaResponse;
    const legs = json.trip?.legs;
    if (!legs?.length) return null;
    const coords = legs.flatMap((leg) => decodePolyline6(leg.shape));
    if (coords.length < 2) return null;
    cache.set(key, coords);
    return coords;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
