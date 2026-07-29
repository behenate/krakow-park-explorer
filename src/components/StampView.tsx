import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { parkById } from '@/data/parks';
import { basePlates, parkLayers, stampLang, unvisitedOverlays } from '@/data/stampArt';
import { useI18n } from '@/i18n';

/**
 * Layered digital stamp (design's "digital sticker book" system):
 * base plate (category + language kind text) + park layer (name arc + motif),
 * or the localised "?" unvisited overlay for parks not yet stamped.
 *
 * Rules from the design task:
 * - Hand-pressed character (rotation −6°…+6°, opacity 0.82…0.95) applies to
 *   the composed stack, derived deterministically from parkId.
 * - Unvisited slots render at full opacity, untilted — the park motif stays
 *   a surprise until stamped (never a greyed-out park stamp).
 * - No recoloring, shadows, or backgrounds; ink colors are baked into layers.
 * - Language changes swap only the base plate / unvisited overlay.
 */

function hash(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = (h * 33) ^ str.charCodeAt(i);
  return h >>> 0;
}

export function stampCharacter(parkId: string): { rotation: number; opacity: number } {
  const h = hash(parkId);
  const rotation = -6 + ((h % 1000) / 999) * 12;
  const opacity = 0.82 + (((h >> 10) % 1000) / 999) * 0.13;
  return { rotation, opacity };
}

interface Props {
  parkId: string;
  size: number;
  stamped: boolean;
  /** Render the stamp art in solid white (for use on solid category backgrounds). */
  whiteTint?: boolean;
  /** Arbitrary tint (e.g. grey for the "locked artwork" state, design 1h). */
  tintColor?: string;
  /**
   * Override the deterministic hand-pressed tilt (degrees, negative = left).
   * Use where the layout calls for a fixed angle — e.g. the park detail hero.
   */
  rotation?: number;
}

export function StampView({ parkId, size, stamped, whiteTint = false, tintColor, rotation }: Props) {
  const { lang } = useI18n();
  const park = parkById(parkId);
  if (!park) return null;

  const plateLang = stampLang(lang);
  const plate = basePlates[`${park.category}-${plateLang}`];
  const overlay = stamped ? parkLayers[parkId] : unvisitedOverlays[`${park.category}-${plateLang}`];
  const character = stamped ? stampCharacter(parkId) : { rotation: 0, opacity: 1 };
  const angle = rotation ?? character.rotation;

  return (
    <View
      style={{
        width: size,
        height: size,
        opacity: character.opacity,
        transform: [{ rotate: `${angle.toFixed(2)}deg` }],
      }}
    >
      <Image
        source={plate}
        style={[styles.layer, whiteTint && styles.white, tintColor ? { tintColor } : null]}
        accessibilityIgnoresInvertColors
      />
      <Image
        source={overlay}
        style={[styles.layer, whiteTint && styles.white, tintColor ? { tintColor } : null]}
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  white: { tintColor: '#ffffff' },
});
