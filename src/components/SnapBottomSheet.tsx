import React, { useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, View } from 'react-native';

import { ground, radii, spacing } from '@/theme/tokens';

/** Skirt below the screen edge — hides gaps on spring overshoot. */
const SKIRT = 60;

/**
 * Two-snap bottom sheet (collapsed ⇄ expanded) on core RN Animated +
 * PanResponder. The drag gesture lives on the header only, so scrollable
 * content inside the sheet keeps its own gestures; tapping the header
 * toggles. `children` fade in with expansion (opacity follows the sheet
 * position) and can't be tapped while collapsed.
 */

interface Props {
  /** Visible height when collapsed (header area). */
  collapsedHeight: number;
  /** Total sheet height when expanded. */
  expandedHeight: number;
  /** Always-visible header (title row). Rendered under the drag handle. */
  header: React.ReactNode;
  /** Expandable content — faded/disabled while collapsed. */
  children: React.ReactNode;
  initiallyExpanded?: boolean;
  /** Fires when the sheet settles on a snap point. */
  onSnapChange?: (expanded: boolean) => void;
  /**
   * Optional externally-owned position value (0 = expanded, range =
   * collapsed). Lets siblings (e.g. the map) follow the sheet 1:1 during
   * drags via interpolation.
   */
  sheetY?: Animated.Value;
}

export function SnapBottomSheet({
  collapsedHeight,
  expandedHeight,
  header,
  children,
  initiallyExpanded = false,
  onSnapChange,
  sheetY,
}: Props) {
  const range = Math.max(1, expandedHeight - collapsedHeight);
  const internalY = useRef(new Animated.Value(initiallyExpanded ? 0 : range)).current;
  const translateY = sheetY ?? internalY;
  const initialized = useRef(false);
  if (!initialized.current) {
    initialized.current = true;
    if (sheetY) sheetY.setValue(initiallyExpanded ? 0 : range);
  }
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const dragStart = useRef(0);

  const snapTo = (open: boolean, velocity = 0) => {
    setExpanded(open);
    onSnapChange?.(open);
    // JS driver on purpose: the drag writes this value from the JS thread
    // (PanResponder setValue). Mixing that with native-driven springs makes
    // the native transform flash to the stale JS value (0 = expanded) for
    // one frame when a drag interrupts/starts after an animation.
    Animated.spring(translateY, {
      toValue: open ? 0 : range,
      damping: 20,
      stiffness: 200,
      velocity,
      useNativeDriver: false,
    }).start();
  };

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderGrant: () => {
        translateY.stopAnimation((v) => {
          dragStart.current = v;
        });
      },
      onPanResponderMove: (_e, g) => {
        const y = dragStart.current + g.dy;
        translateY.setValue(y < 0 ? y / 6 : Math.min(y, range + 40));
      },
      onPanResponderRelease: (_e, g) => {
        const y = dragStart.current + g.dy;
        const open = g.vy < -0.4 ? true : g.vy > 0.4 ? false : y < range / 2;
        snapTo(open, g.vy);
      },
    }),
  ).current;

  const contentOpacity = translateY.interpolate({
    inputRange: [0, range * 0.6, range],
    outputRange: [1, 0, 0],
  });

  return (
    <Animated.View
      style={[styles.sheet, { height: expandedHeight + SKIRT, transform: [{ translateY }] }]}
    >
      <View {...pan.panHandlers}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityHint="toggle"
          onPress={() => snapTo(!expanded)}
        >
          <View style={styles.handle} />
          {header}
        </Pressable>
      </View>
      <Animated.View
        // paddingBottom keeps content (e.g. a pinned footer) out of the
        // below-screen skirt.
        style={{ flex: 1, opacity: contentOpacity, paddingBottom: SKIRT }}
        pointerEvents={expanded ? 'auto' : 'none'}
      >
        {children}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: -SKIRT,
    zIndex: 40,
    backgroundColor: ground.surfaceLight,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingTop: 8,
    shadowColor: '#3a2c1a',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 14,
  },
  handle: {
    alignSelf: 'center',
    width: 56,
    height: 5,
    borderRadius: 3,
    backgroundColor: ground.surface,
    marginBottom: 6,
  },
});
