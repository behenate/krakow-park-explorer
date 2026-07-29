import { Marker, useCurrentPosition } from '@maplibre/maplibre-react-native';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo } from 'react';
import { Animated as RNAnimated, Easing as RNEasing, StyleSheet, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { categories, ground } from '@/theme/tokens';

/**
 * "You are here" puck with a radar sweep: a hairline ring that closes in on
 * the dot, once per cycle. Replaces MapLibre's default blue puck so the marker
 * sits in the Organic palette.
 *
 * Rendered through Marker (a real RN view on the map) rather than circle
 * layers, because style paint properties can't be driven per frame — the sweep
 * runs on core RN Animated with the native driver, like the rest of
 * `components/motion.tsx`, and respects reduce-motion.
 */

/** Ring diameter at the start of a sweep. */
const RING = 40;
/** Puck diameter (blue core + white rim) — where the sweep lands. */
const DOT = 16;
/** Soft presence halo behind the dot. */
const HALO = 26;
/** One sweep plus the rest before the next ping. */
const PERIOD = 2200;

const ink = categories.water.ink;

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
    <Marker id="user-puck" lngLat={[coords.lng, coords.lat]} anchor="center">
      <View style={styles.frame} pointerEvents="none">
        {reduced ? null : (
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
        )}
        <View style={styles.halo} />
        <View style={styles.dot} />
      </View>
    </Marker>
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
  halo: {
    position: 'absolute',
    width: HALO,
    height: HALO,
    borderRadius: HALO / 2,
    backgroundColor: ink,
    opacity: 0.18,
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    backgroundColor: ink,
    borderWidth: 2.5,
    borderColor: ground.white,
  },
});
