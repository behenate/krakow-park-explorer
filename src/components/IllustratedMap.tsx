import React, { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Path, Rect, Text as SvgText } from 'react-native-svg';

import { Park } from '@/data/parks';
import { categories, fonts, ground } from '@/theme/tokens';

/**
 * Stylised illustrated map (matches the design's abstract cream map).
 * A real MapLibre basemap replaces this in a later phase; the component keeps
 * the same props so the swap is contained.
 */

export interface MapStop {
  park: Park;
  index: number; // 1-based label for route stops
}

export interface DistributionPoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
  /** Optional full label announced by screen readers (defaults to name). */
  accessibilityLabel?: string;
}

interface Props {
  width: number;
  height: number;
  parks: Park[];
  stampedIds: Set<string>;
  selectedId?: string | null;
  onSelect?: (park: Park) => void;
  userLocation?: { lat: number; lng: number } | null;
  routeStops?: MapStop[];
  /** Booklet pickup locations — rendered as distinct dark book-like markers. */
  distributionPoints?: readonly DistributionPoint[];
  onSelectDistribution?: (point: DistributionPoint) => void;
  /** Focus region: defaults to bounding box of given parks. */
  focus?: { lat: number; lng: number; span?: number } | null;
}

const VISTULA: [number, number][] = [
  [50.058, 19.85],
  [50.048, 19.9],
  [50.045, 19.94],
  [50.052, 19.98],
  [50.045, 20.02],
  [50.036, 20.07],
  [50.03, 20.13],
];

export function IllustratedMap({
  width,
  height,
  parks,
  stampedIds,
  selectedId,
  onSelect,
  userLocation,
  routeStops,
  distributionPoints,
  onSelectDistribution,
  focus,
}: Props) {
  const project = useMemo(() => {
    let minLat: number, maxLat: number, minLng: number, maxLng: number;
    if (focus) {
      const span = focus.span ?? 0.05;
      minLat = focus.lat - span;
      maxLat = focus.lat + span;
      minLng = focus.lng - span * 1.6;
      maxLng = focus.lng + span * 1.6;
    } else {
      const lats = parks.map((p) => p.lat);
      const lngs = parks.map((p) => p.lng);
      const padLat = 0.012;
      const padLng = 0.02;
      minLat = Math.min(...lats) - padLat;
      maxLat = Math.max(...lats) + padLat;
      minLng = Math.min(...lngs) - padLng;
      maxLng = Math.max(...lngs) + padLng;
    }
    return (lat: number, lng: number) => ({
      x: ((lng - minLng) / (maxLng - minLng)) * width,
      y: ((maxLat - lat) / (maxLat - minLat)) * height,
    });
  }, [parks, focus, width, height]);

  const riverPath = useMemo(() => {
    const pts = VISTULA.map(([lat, lng]) => project(lat, lng));
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  }, [project]);

  const routePath = useMemo(() => {
    if (!routeStops || routeStops.length < 2) return null;
    const pts = routeStops.map((s) => project(s.park.lat, s.park.lng));
    let d = `M${pts[0].x},${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1];
      const cur = pts[i];
      const mx = (prev.x + cur.x) / 2;
      d += ` Q${mx},${prev.y} ${cur.x},${cur.y}`;
    }
    return d;
  }, [routeStops, project]);

  const routeIds = new Set((routeStops ?? []).map((s) => s.park.id));

  return (
    <View style={{ width, height, backgroundColor: ground.surface, overflow: 'hidden' }}>
      <Svg width={width} height={height}>
        {/* Vistula */}
        <Path d={riverPath} stroke="#c3d9e4" strokeWidth={26} fill="none" strokeLinecap="round" opacity={0.85} />

        {/* Park blobs */}
        {parks.map((p) => {
          const { x, y } = project(p.lat, p.lng);
          const selected = selectedId === p.id;
          return (
            <G key={`blob-${p.id}`}>
              <Ellipse
                cx={x}
                cy={y}
                rx={34}
                ry={26}
                fill={categories[p.category].tint}
                stroke={selected ? categories[p.category].ink : 'none'}
                strokeWidth={2}
                strokeDasharray={selected ? '7 5' : undefined}
                opacity={0.9}
              />
            </G>
          );
        })}

        {/* Route line */}
        {routePath ? (
          <Path
            d={routePath}
            stroke={ground.accent}
            strokeWidth={4.5}
            strokeDasharray="10 8"
            fill="none"
            strokeLinecap="round"
          />
        ) : null}

        {/* Pins / numbered stops */}
        {parks.map((p) => {
          const { x, y } = project(p.lat, p.lng);
          const stamped = stampedIds.has(p.id);
          const pal = categories[p.category];
          const stop = routeStops?.find((s) => s.park.id === p.id);
          if (stop) {
            return (
              <G key={`stop-${p.id}`}>
                <Circle cx={x} cy={y} r={15} fill={stamped ? ground.dark : pal.ink} stroke={ground.white} strokeWidth={3} />
                <SvgText
                  x={x}
                  y={y + 5.5}
                  textAnchor="middle"
                  fontSize={15}
                  fontFamily={fonts.bodyBold}
                  fill={ground.white}
                >
                  {String(stop.index)}
                </SvgText>
              </G>
            );
          }
          if (routeIds.size > 0 && !stop) return null; // route mode shows only stops
          if (stamped) {
            // collected marker: dark filled circle w/ dashed stamp ring
            return (
              <G key={`pin-${p.id}`}>
                <Circle cx={x} cy={y} r={13} fill={pal.deep} stroke={ground.white} strokeWidth={3} />
                <Circle cx={x} cy={y} r={8} stroke={ground.white} strokeWidth={1.5} strokeDasharray="3 2.5" fill="none" />
              </G>
            );
          }
          return (
            <G key={`pin-${p.id}`}>
              <Path
                d={`M${x} ${y} m0 6 c-6-6 -9-10 -9-14 a9 9 0 1 1 18 0 c0 4 -3 8 -9 14 Z`}
                fill={pal.ink}
                stroke={ground.white}
                strokeWidth={2.5}
              />
              <Circle cx={x} cy={y - 8} r={3.4} fill={ground.white} />
            </G>
          );
        })}

        {/* Distribution points — dark rounded-square book markers */}
        {(distributionPoints ?? []).map((d) => {
          const { x, y } = project(d.lat, d.lng);
          return (
            <G key={`dist-${d.id}`}>
              <Rect
                x={x - 12}
                y={y - 12}
                width={24}
                height={24}
                rx={7}
                fill={ground.dark}
                stroke={ground.white}
                strokeWidth={2.5}
              />
              {/* Open-book glyph */}
              <Path
                d={`M${x - 6} ${y - 3.5} Q${x - 1} ${y - 6.5} ${x} ${y - 3} Q${x + 1} ${y - 6.5} ${x + 6} ${y - 3.5} L${x + 6} ${y + 4.5} Q${x + 1} ${y + 2} ${x} ${y + 5} Q${x - 1} ${y + 2} ${x - 6} ${y + 4.5} Z`}
                fill={ground.white}
              />
            </G>
          );
        })}

        {/* User location */}
        {userLocation
          ? (() => {
              const { x, y } = project(userLocation.lat, userLocation.lng);
              return (
                <G>
                  <Circle cx={x} cy={y} r={13} fill="#9dc3d8" opacity={0.5} />
                  <Circle cx={x} cy={y} r={6.5} fill="#2f6da0" stroke={ground.white} strokeWidth={2.5} />
                </G>
              );
            })()
          : null}
      </Svg>

      {/* Touch targets (min 44pt) over pins */}
      {onSelect
        ? parks.map((p) => {
            const { x, y } = project(p.lat, p.lng);
            return (
              <Pressable
                key={`tap-${p.id}`}
                accessibilityRole="button"
                accessibilityLabel={p.name}
                onPress={() => onSelect(p)}
                style={[styles.tap, { left: x - 22, top: y - 26 }]}
              />
            );
          })
        : null}

      {/* Touch targets over distribution-point markers */}
      {onSelectDistribution
        ? (distributionPoints ?? []).map((d) => {
            const { x, y } = project(d.lat, d.lng);
            return (
              <Pressable
                key={`dist-tap-${d.id}`}
                accessibilityRole="button"
                accessibilityLabel={d.accessibilityLabel ?? d.name}
                onPress={() => onSelectDistribution(d)}
                style={[styles.tap, { left: x - 22, top: y - 22 }]}
              />
            );
          })
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tap: { position: 'absolute', width: 44, height: 44 },
});
