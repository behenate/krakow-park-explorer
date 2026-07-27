import React, { useRef } from 'react';
import { Animated, PanResponder, StyleSheet, View, ViewStyle } from 'react-native';

import { ground, radii, spacing } from '@/theme/tokens';

const DISMISS_DRAG = 90;
const DISMISS_VELOCITY = 0.8; // px/ms (PanResponder velocity units)
const OFFSCREEN = 700; // dismiss distance — must exceed visible sheet height
/**
 * The sheet extends this far below the screen edge, so neither an upward
 * spring overshoot nor a long downward drag (which can travel well past the
 * 90pt dismiss threshold before release) ever reveals the map between the
 * sheet and the tab bar.
 */
export const SHEET_OVERSHOOT = 320;

interface Props {
  children: React.ReactNode;
  onDismiss: () => void;
  style?: ViewStyle;
}
/**
 * Draggable map bottom sheet built on core RN Animated + PanResponder
 * (deliberately no reanimated/gesture-handler — their layout animations
 * proved unreliable with this project's react-compiler experiment).
 * Slides in on mount, rubber-bands upward, swipe-down or fling dismisses.
 */
export function MapBottomSheet({ children, onDismiss, style }: Props) {
  const translateY = useRef(new Animated.Value(OFFSCREEN)).current;
  const lastOffset = useRef(0);

  // Slide in on mount (starts off-screen only for the animation's duration;
  // Animated.spring runs natively and needs no effects).
  const mounted = useRef(false);
  if (!mounted.current) {
    mounted.current = true;
    Animated.spring(translateY, {
      toValue: 0,
      damping: 18,
      stiffness: 180,
      useNativeDriver: false, // value is also set from JS during drags — see SnapBottomSheet
    }).start();
  }

  const panResponder = useRef(
    PanResponder.create({
      // Claim the gesture only for clear vertical drags so buttons stay tappable.
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderGrant: () => {
        translateY.stopAnimation((v) => {
          lastOffset.current = v;
        });
      },
      onPanResponderMove: (_e, g) => {
        const y = lastOffset.current + g.dy;
        translateY.setValue(y < 0 ? y / 5 : y); // rubber-band above rest
      },
      onPanResponderRelease: (_e, g) => {
        const y = lastOffset.current + g.dy;
        if (y > DISMISS_DRAG || g.vy > DISMISS_VELOCITY) {
          Animated.timing(translateY, {
            toValue: OFFSCREEN,
            duration: 180,
            useNativeDriver: false, // value is also set from JS during drags — see SnapBottomSheet
          }).start(({ finished }) => {
            if (finished) onDismiss();
          });
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            damping: 18,
            stiffness: 220,
            useNativeDriver: false, // value is also set from JS during drags — see SnapBottomSheet
          }).start();
        }
      },
    }),
  ).current;

  return (
    <Animated.View
      style={[styles.sheet, { transform: [{ translateY }] }, style]}
      {...panResponder.panHandlers}
    >
      <View style={styles.handle} accessibilityLabel="drag handle" />
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: -SHEET_OVERSHOOT,
    zIndex: 40,
    // Same surface as the tab bar (reference: sheet + tab bar read as one
    // continuous panel, separated only by the tab bar's hairline).
    backgroundColor: ground.surfaceLight,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    padding: spacing.md,
    paddingBottom: SHEET_OVERSHOOT, // consumers add their own inset on top
    gap: 10,
    // Layer above the map: soft shadow (iOS) + elevation (Android)
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
    marginBottom: 2,
  },
});
