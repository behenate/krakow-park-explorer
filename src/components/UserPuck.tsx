import { Layer, LayerAnnotation, Marker, useCurrentPosition } from '@maplibre/maplibre-react-native';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo } from 'react';
import { Animated as RNAnimated, Easing as RNEasing, StyleSheet, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { ground } from '@/theme/tokens';

/**
 * "You are here" puck with a radar sweep: a hairline ring that closes in on
 * the dot, once per cycle.
 *
 * Hybrid rendering: the halo and dot are native circle layers on a
 * LayerAnnotation, so they stay glued to the map during pans and zooms
 * (a Marker is a RN view synced over the bridge and visibly trails the map
 * on Android). The sweep stays a Marker because style paint properties
 * can't be driven per frame — it runs on core RN Animated with the native
 * driver and respects reduce-motion. It's decorative, so a slight trail
 * during gestures is acceptable.
 */

/** Ring diameter at the start of a sweep. */
const RING = 32;
/** Puck diameter (blue core + white rim) — where the sweep lands. */
const DOT = 12;
/** Soft presence halo behind the dot. */
const HALO = 20;
/** One sweep plus the rest before the next ping. */
const PERIOD = 2200;

// Lighter blue than the water-category park pins (#4f7d99), so the
// "you are here" puck reads as unique on the map.
const ink = '#5fa8dc';

export function UserPuck({ fallback }: { fallback?: { lat: number; lng: number } | null }) {
  // Live native fix; the caller's last-known position fills the gap until the
  // first update arrives.
  const position = useCurrentPosition();
  const reduced = useReducedMotion();
  const t = useMemo(() => new RNAnimated.Value(0), []);

  // The sweep only runs while its screen is on top: an endless loop behind a
  // backgrounded map would keep the compositor awake for nothing.
  useFocusEffect(
    useCallback(() => {
      if (reduced) return;
      t.setValue(0);
      const anim = RNAnimated.loop(
        RNAnimated.timing(t, {
          toValue: 1,
          duration: PERIOD,
          easing: RNEasing.linear,
          useNativeDriver: true,
        }),
      );
      anim.start();
      return () => anim.stop();
    }, [reduced, t]),
  );

  const coords = position?.coords
    ? { lat: position.coords.latitude, lng: position.coords.longitude }
    : fallback;
  if (!coords) return null;

  return (
    <>
      {/* Halo + dot: map layers, perfectly in sync with map movement. */}
      <LayerAnnotation id="user-puck" lngLat={[coords.lng, coords.lat]} animated>
        <Layer
          id="user-puck-halo"
          type="circle"
          source="user-puck"
          paint={{
            'circle-radius': HALO / 2,
            'circle-color': ink,
            'circle-opacity': 0.18,
          }}
        />
        <Layer
          id="user-puck-dot"
          type="circle"
          source="user-puck"
          paint={{
            'circle-radius': DOT / 2,
            'circle-color': ink,
            'circle-stroke-color': ground.white,
            'circle-stroke-width': 2,
          }}
        />
      </LayerAnnotation>

      {/* Radar sweep: a RN view, so it can animate per frame. */}
      {reduced ? null : (
        <Marker id="user-puck-sweep" lngLat={[coords.lng, coords.lat]} anchor="center">
          <View style={styles.frame} pointerEvents="none">
            <RNAnimated.View
              style={[
                styles.ring,
                {
                  // Sweep travels inward over the first 70% of the cycle, then
                  // waits out the rest invisibly.
                  transform: [
                    { scale: t.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, DOT / RING, DOT / RING] }) },
                  ],
                  opacity: t.interpolate({
                    inputRange: [0, 0.08, 0.55, 0.7, 1],
                    outputRange: [0, 0.9, 0.7, 0, 0],
                  }),
                },
              ]}
            />
          </View>
        </Marker>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: RING,
    height: RING,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  ring: {
    position: 'absolute',
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    borderWidth: 1,
    borderColor: ink,
  },
});
