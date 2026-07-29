import {
  Camera,
  GeoJSONSource,
  Layer,
  Map as MLMap,
  type PressEvent,
  type PressEventWithFeatures,
} from '@maplibre/maplibre-react-native';
import React, { useMemo, useRef } from 'react';
import { type NativeSyntheticEvent, View } from 'react-native';

import { Park } from '@/data/parks';
import { DistributionPoint, MapStop } from '@/components/IllustratedMap';
import { UserPuck } from '@/components/UserPuck';
import { KRAKOW_BOUNDS, parkoMapStyle } from '@/lib/mapStyle';
import { categories, ground } from '@/theme/tokens';

/**
 * Real basemap (MapLibre React Native v11 + OSM vector tiles).
 * Prop-compatible with IllustratedMap so screens can swap freely.
 * Basemap style: src/lib/mapStyle.ts (Organic palette over OSM tiles);
 * camera is hard-limited to the Kraków city bounds.
 */

interface Props {
  width: number;
  height: number;
  parks: Park[];
  stampedIds: Set<string>;
  selectedId?: string | null;
  onSelect?: (park: Park) => void;
  userLocation?: { lat: number; lng: number } | null;
  routeStops?: MapStop[];
  /**
   * Street-following geometry ([lng,lat] pairs, e.g. from lib/routing).
   * When provided, the route line follows it; otherwise straight dashed
   * lines connect the stops (offline/loading fallback).
   */
  routeGeometry?: [number, number][] | null;
  distributionPoints?: readonly DistributionPoint[];
  onSelectDistribution?: (point: DistributionPoint) => void;
  focus?: { lat: number; lng: number; span?: number } | null;
  /** Trip anchors (design 3c): sage start dot + terracotta end dot. */
  anchors?: { start?: { lat: number; lng: number }; end?: { lat: number; lng: number } };
  /** Faded, tappable candidate pins near the corridor (design 3c/3d). */
  candidates?: Park[];
  onSelectCandidate?: (park: Park) => void;
  /** Grey dotted comparison line (the direct start→end path). */
  directLine?: { lat: number; lng: number }[];
  /** Arbitrary map tap (used by the point picker). */
  onMapPress?: (coord: { lat: number; lng: number }) => void;
  /**
   * Fit the camera once on mount and never refit afterwards — for editing
   * screens where stops change under the user's fingers (preview, picker).
   */
  fitOnce?: boolean;
  /**
   * Viewport padding (points) — e.g. the area covered by a bottom sheet.
   * The initial fit (and refits on route changes) respects it. When only the
   * padding changes afterwards (sheet snapping), the camera performs a pure
   * vertical translation at constant zoom, so the same points stay visible
   * and open→close returns exactly to the initial position.
   */
  cameraPadding?: { top?: number; bottom?: number; left?: number; right?: number };
}

type FC = GeoJSON.FeatureCollection;

function bboxOf(points: { lat: number; lng: number }[], pad = 0.01): [number, number, number, number] {
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  return [
    Math.min(...lngs) - pad,
    Math.min(...lats) - pad,
    Math.max(...lngs) + pad,
    Math.max(...lats) + pad,
  ];
}

export function ParkMap({
  width,
  height,
  parks,
  stampedIds,
  selectedId,
  onSelect,
  userLocation,
  routeStops,
  routeGeometry,
  distributionPoints,
  onSelectDistribution,
  focus,
  anchors,
  candidates,
  onSelectCandidate,
  directLine,
  onMapPress,
  fitOnce = false,
  cameraPadding,
}: Props) {
  const routeIds = useMemo(() => new Set((routeStops ?? []).map((s) => s.park.id)), [routeStops]);

  const parksFC = useMemo<FC>(
    () => ({
      type: 'FeatureCollection',
      features: parks
        .filter((p) => !routeIds.has(p.id))
        .map((p) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
          properties: {
            id: p.id,
            stamped: stampedIds.has(p.id),
            selected: p.id === selectedId,
            ink: categories[p.category].ink,
            deep: categories[p.category].deep,
          },
        })),
    }),
    [parks, stampedIds, selectedId, routeIds],
  );

  const routeLineFC = useMemo<FC>(() => {
    const stops = routeStops ?? [];
    // Prefer real street-following geometry; fall back to straight lines
    // through the anchors (start → stops → end) when they're provided.
    const straight =
      stops.length > 0
        ? [
            ...(anchors?.start ? [[anchors.start.lng, anchors.start.lat]] : []),
            ...stops.map((s) => [s.park.lng, s.park.lat]),
            ...(anchors?.end ? [[anchors.end.lng, anchors.end.lat]] : []),
          ]
        : [];
    const coordinates =
      routeGeometry && routeGeometry.length >= 2
        ? routeGeometry
        : straight.length >= 2
          ? straight
          : null;
    return {
      type: 'FeatureCollection',
      features: coordinates
        ? [
            {
              type: 'Feature',
              geometry: { type: 'LineString', coordinates },
              properties: { real: !!(routeGeometry && routeGeometry.length >= 2) },
            },
          ]
        : [],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeStops, routeGeometry, anchors?.start?.lat, anchors?.start?.lng, anchors?.end?.lat, anchors?.end?.lng]);

  const routeStopsFC = useMemo<FC>(
    () => ({
      type: 'FeatureCollection',
      features: (routeStops ?? []).map((s) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [s.park.lng, s.park.lat] },
        properties: {
          id: s.park.id,
          index: String(s.index),
          ink: categories[s.park.category].ink,
          stamped: stampedIds.has(s.park.id),
        },
      })),
    }),
    [routeStops, stampedIds],
  );

  const anchorsFC = useMemo<FC>(
    () => ({
      type: 'FeatureCollection',
      features: [
        ...(anchors?.start
          ? [
              {
                type: 'Feature' as const,
                geometry: { type: 'Point' as const, coordinates: [anchors.start.lng, anchors.start.lat] },
                properties: { kind: 'start' },
              },
            ]
          : []),
        ...(anchors?.end
          ? [
              {
                type: 'Feature' as const,
                geometry: { type: 'Point' as const, coordinates: [anchors.end.lng, anchors.end.lat] },
                properties: { kind: 'end' },
              },
            ]
          : []),
      ],
    }),
    [anchors?.start?.lat, anchors?.start?.lng, anchors?.end?.lat, anchors?.end?.lng],
  );

  const candidatesFC = useMemo<FC>(
    () => ({
      type: 'FeatureCollection',
      features: (candidates ?? []).map((p) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
        properties: { id: p.id, ink: categories[p.category].ink },
      })),
    }),
    [candidates],
  );

  const directLineFC = useMemo<FC>(
    () => ({
      type: 'FeatureCollection',
      features:
        directLine && directLine.length >= 2
          ? [
              {
                type: 'Feature',
                geometry: {
                  type: 'LineString',
                  coordinates: directLine.map((p) => [p.lng, p.lat]),
                },
                properties: {},
              },
            ]
          : [],
    }),
    [directLine],
  );

  const distFC = useMemo<FC>(
    () => ({
      type: 'FeatureCollection',
      features: (distributionPoints ?? []).map((d) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [d.lng, d.lat] },
        properties: { id: d.id },
      })),
    }),
    [distributionPoints],
  );

  // Initial viewport: computed once on mount. Filter changes must NOT move
  // the camera, so the parks list never feeds camera props after this.
  const initialCamera = useRef(
    (() => {
      const p = cameraPadding;
      const padding = p
        ? { top: p.top ?? 0, bottom: p.bottom ?? 0, left: p.left ?? 0, right: p.right ?? 0 }
        : undefined;
      if (focus) return { center: [focus.lng, focus.lat] as [number, number], zoom: 13, padding };
      const stops = routeStops ?? [];
      if (stops.length > 0) {
        return { bounds: bboxOf(stops.map((s) => ({ lat: s.park.lat, lng: s.park.lng }))), padding };
      }
      if (parks.length > 0) return { bounds: bboxOf(parks), padding };
      return { center: [19.9368, 50.0619] as [number, number], zoom: 11, padding };
    })(),
  ).current;

  const paddingRef = useRef(cameraPadding);
  paddingRef.current = cameraPadding;

  // After mount, the camera only follows explicit intents: a focus target or
  // a changed set of route stops. Never the (filtered) parks list. Padding is
  // applied to fits but never moves the camera on its own — sheet-follow
  // motion is a plain view translation done by the parent, not camera work.
  const dynamicCamera = useMemo(() => {
    if (fitOnce) return null;
    const p = paddingRef.current;
    const padding = p
      ? { top: p.top ?? 0, bottom: p.bottom ?? 0, left: p.left ?? 0, right: p.right ?? 0 }
      : undefined;
    if (focus) return { center: [focus.lng, focus.lat] as [number, number], zoom: 13, padding };
    const stops = routeStops ?? [];
    if (stops.length > 0) {
      return {
        bounds: bboxOf(stops.map((s) => ({ lat: s.park.lat, lng: s.park.lng }))),
        padding,
        easing: 'ease' as const,
      };
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, routeStops, fitOnce]);

  const handleParkPress = (event: NativeSyntheticEvent<PressEventWithFeatures>) => {
    const feature = event.nativeEvent.features?.[0];
    const id = feature?.properties?.id as string | undefined;
    if (!id || !onSelect) return;
    const park = parks.find((p) => p.id === id);
    if (park) onSelect(park);
  };

  const handleDistPress = (event: NativeSyntheticEvent<PressEventWithFeatures>) => {
    const feature = event.nativeEvent.features?.[0];
    const id = feature?.properties?.id as string | undefined;
    const point = (distributionPoints ?? []).find((d) => d.id === id);
    if (point && onSelectDistribution) onSelectDistribution(point);
  };

  const handleCandidatePress = (event: NativeSyntheticEvent<PressEventWithFeatures>) => {
    const feature = event.nativeEvent.features?.[0];
    const id = feature?.properties?.id as string | undefined;
    const park = (candidates ?? []).find((p) => p.id === id);
    if (park && onSelectCandidate) onSelectCandidate(park);
  };

  const handleMapPress = (
    event: NativeSyntheticEvent<PressEvent> | NativeSyntheticEvent<PressEventWithFeatures>,
  ) => {
    if (!onMapPress) return;
    const [lng, lat] = event.nativeEvent.lngLat;
    onMapPress({ lat, lng });
  };

  return (
    <View style={{ width, height, backgroundColor: ground.surface, overflow: 'hidden' }}>
      <MLMap mapStyle={parkoMapStyle} style={{ flex: 1 }} onPress={onMapPress ? handleMapPress : undefined}>
        <Camera
          initialViewState={initialCamera}
          {...(dynamicCamera ?? {})}
          minZoom={10}
          maxZoom={17}
          maxBounds={KRAKOW_BOUNDS}
        />

        {/* Park pins */}
        <GeoJSONSource id="parks" data={parksFC} onPress={handleParkPress} hitbox={{ top: 22, bottom: 22, left: 22, right: 22 }}>
          {/* selection halo */}
          <Layer
            id="parks-selected-halo"
            type="circle"
            filter={['==', ['get', 'selected'], true]}
            paint={{
              'circle-radius': 16,
              'circle-color': 'transparent',
              'circle-stroke-color': ['get', 'ink'],
              'circle-stroke-width': 2,
              'circle-stroke-opacity': 0.9,
            }}
          />
          {/* un-stamped pins */}
          <Layer
            id="parks-unstamped"
            type="circle"
            filter={['==', ['get', 'stamped'], false]}
            paint={{
              'circle-radius': 9,
              'circle-color': ['get', 'ink'],
              'circle-stroke-color': ground.white,
              'circle-stroke-width': 2.5,
            }}
          />
          {/* stamped: deep fill + check */}
          <Layer
            id="parks-stamped"
            type="circle"
            filter={['==', ['get', 'stamped'], true]}
            paint={{
              'circle-radius': 10,
              'circle-color': ['get', 'deep'],
              'circle-stroke-color': ground.white,
              'circle-stroke-width': 2.5,
            }}
          />
          <Layer
            id="parks-stamped-check"
            type="symbol"
            filter={['==', ['get', 'stamped'], true]}
            layout={{
              'text-field': '✓',
              'text-font': ['Noto Sans Bold'],
              'text-size': 12,
              'text-allow-overlap': true,
            }}
            paint={{ 'text-color': ground.white }}
          />
        </GeoJSONSource>

        {/* Direct start→end comparison path (design 3c: grey dotted) */}
        <GeoJSONSource id="direct-line" data={directLineFC}>
          <Layer
            id="direct-line-dots"
            type="line"
            layout={{ 'line-cap': 'round' }}
            paint={{
              'line-color': '#8a8378',
              'line-width': 2.5,
              'line-dasharray': [0.4, 2.4],
              'line-opacity': 0.9,
            }}
          />
        </GeoJSONSource>

        {/* Route line: solid when street-following, dashed when approximate */}
        <GeoJSONSource id="route-line" data={routeLineFC}>
          <Layer
            id="route-line-real"
            type="line"
            filter={['==', ['get', 'real'], true]}
            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            paint={{
              'line-color': ground.accent,
              'line-width': 4.5,
              'line-opacity': 0.9,
            }}
          />
          <Layer
            id="route-line-approx"
            type="line"
            filter={['==', ['get', 'real'], false]}
            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            paint={{
              'line-color': ground.accent,
              'line-width': 4,
              'line-dasharray': [2, 1.6],
            }}
          />
        </GeoJSONSource>

        {/* Numbered route stops */}
        <GeoJSONSource id="route-stops" data={routeStopsFC} onPress={handleParkPress} hitbox={{ top: 22, bottom: 22, left: 22, right: 22 }}>
          <Layer
            id="route-stops-circle"
            type="circle"
            paint={{
              'circle-radius': 13,
              'circle-color': ['case', ['get', 'stamped'], ground.dark, ['get', 'ink']],
              'circle-stroke-color': ground.white,
              'circle-stroke-width': 3,
            }}
          />
          <Layer
            id="route-stops-index"
            type="symbol"
            layout={{
              'text-field': ['get', 'index'],
              'text-font': ['Noto Sans Bold'],
              'text-size': 14,
              'text-allow-overlap': true,
            }}
            paint={{ 'text-color': ground.white }}
          />
        </GeoJSONSource>

        {/* Booklet distribution points */}
        <GeoJSONSource id="dist-points" data={distFC} onPress={handleDistPress} hitbox={{ top: 22, bottom: 22, left: 22, right: 22 }}>
          <Layer
            id="dist-circle"
            type="circle"
            paint={{
              'circle-radius': 11,
              'circle-color': ground.dark,
              'circle-stroke-color': ground.white,
              'circle-stroke-width': 2.5,
            }}
          />
          <Layer
            id="dist-label"
            type="symbol"
            layout={{
              'text-field': 'B',
              'text-font': ['Noto Sans Bold'],
              'text-size': 13,
              'text-allow-overlap': true,
            }}
            paint={{ 'text-color': ground.white }}
          />
        </GeoJSONSource>

        {/* Faded, tappable candidate pins near the corridor */}
        <GeoJSONSource
          id="candidate-parks"
          data={candidatesFC}
          onPress={handleCandidatePress}
          hitbox={{ top: 22, bottom: 22, left: 22, right: 22 }}
        >
          <Layer
            id="candidates-circle"
            type="circle"
            paint={{
              'circle-radius': 8,
              'circle-color': ['get', 'ink'],
              'circle-opacity': 0.55,
              'circle-stroke-color': ground.white,
              'circle-stroke-width': 2,
              'circle-stroke-opacity': 0.55,
            }}
          />
        </GeoJSONSource>

        {/* Trip anchors: sage start, terracotta end (design 3c) */}
        <GeoJSONSource id="trip-anchors" data={anchorsFC}>
          <Layer
            id="anchors-circle"
            type="circle"
            paint={{
              'circle-radius': 11,
              'circle-color': ['case', ['==', ['get', 'kind'], 'start'], ground.accent2, ground.accent],
              'circle-stroke-color': ground.white,
              'circle-stroke-width': 3,
            }}
          />
          <Layer
            id="anchors-core"
            type="circle"
            paint={{
              'circle-radius': 3.5,
              'circle-color': ground.white,
            }}
          />
        </GeoJSONSource>

        {userLocation ? <UserPuck fallback={userLocation} /> : null}
      </MLMap>
    </View>
  );
}
