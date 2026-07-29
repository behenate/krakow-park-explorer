import {
  Camera,
  GeoJSONSource,
  Layer,
  Map as MLMap,
} from '@maplibre/maplibre-react-native';
import React, { useMemo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { StampView } from '@/components/StampView';
import { Park, parkById, parks } from '@/data/parks';
import { useI18n } from '@/i18n';
import { KRAKOW_BOUNDS, parkoMapStyle } from '@/lib/mapStyle';
import { CategoryId, categories, fonts } from '@/theme/tokens';

export type WrappedVariant = 'summary' | 'memories' | 'map';

export interface WrappedPhoto {
  uri: string;
  /** Park the memory was taken at — its stamp is placed on the photo. */
  parkId: string;
}

export interface WrappedCardProps {
  variant: WrappedVariant;
  width: number;
  height: number;
  count: number;
  distanceTotal: number;
  photos: WrappedPhoto[];
  favouriteCategory: CategoryId;
  visitIds: string[];
}

/** Design palette: card = accent-800, inner blocks = accent-700. */
const CARD_BG = '#5b3a1e';
const BLOCK_BG = '#6f4a27';
const KICKER = '#d8bfa5';

/**
 * Pseudo-random stamp tilt in [-25, 25]°, derived from the photo URI so a
 * photo keeps the same angle across re-renders and captures.
 */
function stampAngle(uri: string): number {
  let h = 0;
  for (let i = 0; i < uri.length; i++) h = (h * 31 + uri.charCodeAt(i)) | 0;
  return (Math.abs(h) % 51) - 25;
}

/** Bounding box of a park set with padding; enforces a minimum span. */
function boundsOf(pts: Park[]): [number, number, number, number] {
  const lngs = pts.map((p) => p.lng);
  const lats = pts.map((p) => p.lat);
  let w = Math.min(...lngs);
  let e = Math.max(...lngs);
  let s = Math.min(...lats);
  let n = Math.max(...lats);
  const padX = Math.max((e - w) * 0.12, 0.02);
  const padY = Math.max((n - s) * 0.12, 0.012);
  w -= padX;
  e += padX;
  s -= padY;
  n += padY;
  return [w, s, e, n];
}

/**
 * The real deal: the app's MapLibre basemap (Organic-styled OSM tiles),
 * non-interactive, fitted to the visited parks, with the stamped parks as
 * category-coloured pins. Falls back to the full park extent pre-stamps.
 */
function ParkDotMap({ visitIds, height }: { visitIds: string[]; height: number }) {
  const { t } = useI18n();

  const visited = useMemo(
    () => visitIds.map((id) => parkById(id)).filter((p): p is Park => !!p),
    [visitIds],
  );
  const bounds = useMemo(() => boundsOf(visited.length > 0 ? visited : parks), [visited]);

  const visitedFC = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: visited.map((p) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
        properties: { deep: categories[p.category].deep },
      })),
    }),
    [visited],
  );

  return (
    <View style={[styles.map, { height }]}>
      {/* pointerEvents none — the carousel owns all gestures */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <MLMap
          mapStyle={parkoMapStyle}
          style={{ flex: 1 }}
          dragPan={false}
          touchZoom={false}
          doubleTapZoom={false}
          doubleTapHoldZoom={false}
          touchRotate={false}
          touchPitch={false}
          attribution={false}
          logo={false}
        >
          <Camera
            initialViewState={{
              bounds,
              padding: { top: 10, bottom: 10, left: 10, right: 10 },
            }}
            maxBounds={KRAKOW_BOUNDS}
          />
          <GeoJSONSource id="wrapped-visited" data={visitedFC}>
            <Layer
              id="wrapped-visited-dots"
              type="circle"
              paint={{
                'circle-radius': 5,
                'circle-color': ['get', 'deep'],
                'circle-stroke-color': '#ffffff',
                'circle-stroke-width': 1.5,
              }}
            />
          </GeoJSONSource>
        </MLMap>
      </View>
      {/* OSM attribution must stay on a shareable rendering of the map */}
      <Text style={styles.mapCredit}>© OpenStreetMap</Text>
      <Text style={styles.mapLabel}>{t('myParkMap')}</Text>
    </View>
  );
}

/**
 * The shareable "Wrapped" cards (design 1v) — deep brown, Spotify-style,
 * portrait 210×340 proportions, rendered inside ViewShots so each card can
 * be captured as a PNG. Three on-device variants: summary, memories, map.
 */
export function WrappedCard({
  variant,
  width,
  height,
  count,
  distanceTotal,
  photos,
  favouriteCategory,
  visitIds,
}: WrappedCardProps) {
  const { t } = useI18n();

  const byCategory: Record<CategoryId, number> = { historical: 0, forest: 0, water: 0 };
  for (const id of visitIds) {
    const park = parkById(id);
    if (park) byCategory[park.category]++;
  }

  const kicker =
    variant === 'summary'
      ? `${t('myYearSoFar').toUpperCase()} · ${new Date().getFullYear()}`
      : variant === 'memories'
        ? t('myMemories').toUpperCase()
        : t('myParkMap').toUpperCase();

  return (
    <View style={[styles.card, { width, height }]}>
      <Text style={styles.kicker}>{kicker}</Text>

      {variant === 'summary' ? (
        <>
          <Text style={styles.number}>{count}</Text>
          <Text style={styles.label}>{t('parksExplored')}</Text>
          <View style={styles.photoRow}>
            {photos.slice(0, 2).map((p) => (
              <Image key={p.uri} source={{ uri: p.uri }} style={styles.photo} resizeMode="cover" />
            ))}
            {photos.length === 0 ? (
              <>
                <View style={[styles.photo, styles.photoPlaceholder]} />
                <View style={[styles.photo, styles.photoPlaceholder]} />
              </>
            ) : null}
          </View>
          <View style={{ marginTop: 'auto' }}>
            <ParkDotMap visitIds={visitIds} height={height * 0.24} />
            {/* One row under the map: distance left, favourite category right */}
            <View style={[styles.metaRow, { marginTop: 6 }]}>
              <Text style={styles.meta}>
                {distanceTotal.toFixed(0)} {t('kmWalked')}
              </Text>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.metaCaption}>{t('favouriteCategory').toUpperCase()}</Text>
                <Text style={styles.meta}>{t(favouriteCategory)}</Text>
              </View>
            </View>
          </View>
        </>
      ) : null}

      {variant === 'memories' ? (
        <>
          <View style={styles.memoryGrid}>
            {[...new Map(photos.map((p) => [p.uri, p])).values()].slice(0, 4).map((p) => (
              // Explicit pixel size — percent+aspectRatio collapsed to
              // zero height inside the fixed-size card.
              <View
                key={p.uri}
                style={{ width: (width - 46) / 2, height: (height - 190) / 2 }}
              >
                <Image
                  source={{ uri: p.uri }}
                  style={[styles.memoryPhoto, { width: '100%', height: '100%' }]}
                  resizeMode="cover"
                />
                {/* The stamp of the park where the picture was taken */}
                <View
                  style={[styles.memoryStamp, { transform: [{ rotate: `${stampAngle(p.uri)}deg` }] }]}
                  pointerEvents="none"
                >
                  <StampView parkId={p.parkId} size={46} stamped whiteTint />
                </View>
              </View>
            ))}
          </View>
          <View style={[styles.metaRow, { marginTop: 'auto' }]}>
            <Text style={styles.meta}>
              {count} {t('parksExplored')}
            </Text>
            <Text style={styles.meta}>
              {distanceTotal.toFixed(0)} {t('kmWalked')}
            </Text>
          </View>
        </>
      ) : null}

      {variant === 'map' ? (
        <>
          <ParkDotMap visitIds={visitIds} height={height * 0.42} />
          <View style={{ gap: 6, marginTop: 10 }}>
            {(Object.keys(byCategory) as CategoryId[]).map((c) => (
              <View key={c} style={styles.catRow}>
                <View style={[styles.catSwatch, { backgroundColor: categories[c].tint }]} />
                <Text style={styles.catName}>{t(c)}</Text>
                <Text style={styles.meta}>{byCategory[c]}</Text>
              </View>
            ))}
          </View>
          <View style={[styles.metaRow, { marginTop: 'auto' }]}>
            <Text style={styles.meta}>
              {count} {t('parksExplored')}
            </Text>
            <Text style={styles.meta}>
              {distanceTotal.toFixed(0)} {t('kmWalked')}
            </Text>
          </View>
        </>
      ) : null}

      <Text style={styles.footer}>{t('madeWith')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 26,
    padding: 20,
    gap: 6,
    overflow: 'hidden',
  },
  kicker: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 2, color: KICKER },
  number: { fontFamily: fonts.heading, fontSize: 64, lineHeight: 68, color: '#fffdf9' },
  label: { fontFamily: fonts.bodyBold, fontSize: 15, color: '#fffdf9', marginTop: -4 },
  photoRow: { flexDirection: 'row', gap: 6, marginTop: 8 },
  // Placeholder tint on the Image itself: a photo that fails to decode
  // shows as a lighter tile instead of vanishing into the card.
  photo: { flex: 1, height: 62, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.18)' },
  photoPlaceholder: { backgroundColor: 'rgba(255,255,255,0.22)' },
  memoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  memoryPhoto: { borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.18)' },
  // Long Polish strings ("8 odkrytych parków" + "0 km przebyte") must never
  // collide: the row wraps into stacked lines when one line can't fit both.
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    columnGap: 12,
    rowGap: 3,
    marginTop: 8,
  },
  meta: { fontFamily: fonts.bodyBold, fontSize: 13.5, color: '#fffdf9' },
  metaCaption: { fontFamily: fonts.bodyBold, fontSize: 8, letterSpacing: 1.4, color: KICKER },
  map: { borderRadius: 14, backgroundColor: BLOCK_BG, overflow: 'hidden' },
  mapCredit: {
    position: 'absolute',
    left: 8,
    bottom: 6,
    fontFamily: fonts.body,
    fontSize: 8,
    color: 'rgba(255,255,255,0.75)',
  },
  mapLabel: {
    position: 'absolute',
    right: 8,
    bottom: 6,
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    color: 'rgba(255,255,255,0.65)',
  },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  catSwatch: { width: 10, height: 10, borderRadius: 5 },
  catName: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 13, color: '#f3e6d5' },
  footer: { fontFamily: fonts.bodyBold, fontSize: 9, color: 'rgba(255,255,255,0.5)', marginTop: 8 },
  memoryStamp: { position: 'absolute', right: 4, top: 4, opacity: 0.95 },
});
