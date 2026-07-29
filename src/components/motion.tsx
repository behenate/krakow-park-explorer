import React, { useEffect, useRef } from 'react';
import {
  Animated as RNAnimated,
  Easing as RNEasing,
  StyleSheet,
  useWindowDimensions,
  View,
  ViewStyle,
} from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import { ground } from '@/theme/tokens';

const AnimatedPath = RNAnimated.createAnimatedComponent(Path);
const AnimatedCircle = RNAnimated.createAnimatedComponent(Circle);

/**
 * Motion primitives transcribed from the design source (design-handoff/
 * OKP App Design.dc.html @keyframes). All loops and big entrances respect
 * the OS reduce-motion setting per the spec.
 *
 * Everything here runs on core RN Animated — the animation system this app
 * has proven reliable (Reanimated effect-driven shared values and `Keyframe`
 * entering animations silently no-op under the react-compiler experiment).
 */

/** tokens.json "unlock" curve: cubic-bezier(.2, 1.6, .4, 1) */
export const unlockEasing = RNEasing.bezier(0.2, 1.6, 0.4, 1);

/** One-shot 0→1 timing that drives interpolated keyframes. */
function useKeyframeProgress(duration: number, delay: number) {
  const reduced = useReducedMotion();
  const t = useRef(new RNAnimated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) {
      t.setValue(1);
      return;
    }
    const anim = RNAnimated.timing(t, {
      toValue: 1,
      duration,
      delay,
      easing: RNEasing.linear,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);
  return t;
}

/** Looping 0→1→0 (reverse) driver for gentle drifts and pulses. */
function useLoopProgress(halfDuration: number, delay: number) {
  const reduced = useReducedMotion();
  const t = useRef(new RNAnimated.Value(0)).current;
  useEffect(() => {
    if (reduced) return;
    const anim = RNAnimated.sequence([
      RNAnimated.delay(delay),
      RNAnimated.loop(
        RNAnimated.sequence([
          RNAnimated.timing(t, {
            toValue: 1,
            duration: halfDuration,
            easing: RNEasing.inOut(RNEasing.ease),
            useNativeDriver: true,
          }),
          RNAnimated.timing(t, {
            toValue: 0,
            duration: halfDuration,
            easing: RNEasing.inOut(RNEasing.ease),
            useNativeDriver: true,
          }),
        ]),
      ),
    ]);
    anim.start();
    return () => anim.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);
  return t;
}

/**
 * @keyframes slam — stamp lands from above with overshoot.
 * Spec (normalized to the ~630ms active part of the 4.5s review loop):
 * 0% scale 2.8 / +14° rel / opacity 0 → 50% scale 1 / 0° → 71% scale 1.1 → 100% scale 1.
 * Rotation is relative — StampView bakes each park's own final tilt.
 * Default delay lets the screen push transition finish first.
 */
export function StampSlam({
  children,
  delay = 800,
  endRotation = 0,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  /** Final resting tilt in degrees — the hand-pressed "crooked" charm. */
  endRotation?: number;
  style?: ViewStyle;
}) {
  const t = useKeyframeProgress(630, delay);
  const deg = (n: number) => `${n.toFixed(2)}deg`;
  return (
    <RNAnimated.View
      style={[
        {
          opacity: t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 1, 1] }),
          transform: [
            { scale: t.interpolate({ inputRange: [0, 0.5, 0.71, 1], outputRange: [2.8, 1, 1.1, 1] }) },
            {
              // Sweeps in while twisting, overshoots, settles crooked.
              rotate: t.interpolate({
                inputRange: [0, 0.5, 0.71, 1],
                outputRange: [deg(endRotation + 22), deg(endRotation - 3), deg(endRotation + 1.5), deg(endRotation)],
              }),
            },
          ],
        },
        style,
      ]}
    >
      {children}
    </RNAnimated.View>
  );
}

/**
 * @keyframes popin — unlock pop: scale 0 → 1.18 → 1.
 * Spec rotation −40° → −8° final; relative: −32° → 0°.
 */
export function PopIn({
  children,
  duration = 900,
  delay = 0,
  style,
}: {
  children: React.ReactNode;
  duration?: number;
  delay?: number;
  style?: ViewStyle;
}) {
  const t = useKeyframeProgress(duration, delay);
  return (
    <RNAnimated.View
      style={[
        {
          opacity: t.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 1] }),
          transform: [
            { scale: t.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0, 1.18, 1] }) },
            { rotate: t.interpolate({ inputRange: [0, 0.7, 1], outputRange: ['-32deg', '6deg', '0deg'] }) },
          ],
        },
        style,
      ]}
    >
      {children}
    </RNAnimated.View>
  );
}

/**
 * @keyframes floaty — gentle drift: ±8px translateY, a symmetric ±1.5° rock
 * and a subtle breathing scale (0.985 ↔ 1.015) on its own, slightly shorter
 * period so it drifts out of phase with the rock.
 */
export function Floaty({
  children,
  duration = 10000,
  delay = 0,
  style,
}: {
  children: React.ReactNode;
  /** Full rock cycle in ms. */
  duration?: number;
  delay?: number;
  style?: ViewStyle;
}) {
  const t = useLoopProgress(duration / 2, delay);
  const s = useLoopProgress(duration * 0.4, delay);
  return (
    <RNAnimated.View
      style={[
        {
          transform: [
            { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, -8] }) },
            { rotate: t.interpolate({ inputRange: [0, 1], outputRange: ['-1.5deg', '1.5deg'] }) },
            { scale: s.interpolate({ inputRange: [0, 1], outputRange: [0.985, 1.015] }) },
          ],
        },
        style,
      ]}
    >
      {children}
    </RNAnimated.View>
  );
}

/** @keyframes fall — confetti rain: pieces fall through the screen rotating 560°, looped. */
const CONFETTI_COLORS = ['#c67139', '#6f8153', '#4f7d99', '#b04437', '#7a8a5e'];

function ConfettiPiece({
  index,
  duration,
  fallHeight,
}: {
  index: number;
  duration: number;
  /** Full window height — travel must span it so pieces spawn above the
   * screen and disappear below it. A hardcoded 900px end stop made pieces
   * vanish (and reset) mid-screen on taller devices. */
  fallHeight: number;
}) {
  const reduced = useReducedMotion();
  const t = useRef(new RNAnimated.Value(0)).current;
  useEffect(() => {
    if (reduced) return;
    const anim = RNAnimated.sequence([
      // Start delays spread uniformly across the whole fall duration:
      // after the first cycle every piece loops with a distinct phase,
      // so the rain is constant instead of arriving in bursts.
      RNAnimated.delay((index * 997) % duration),
      RNAnimated.loop(
        RNAnimated.timing(t, { toValue: 1, duration, easing: RNEasing.linear, useNativeDriver: true }),
      ),
    ]);
    anim.start();
    return () => anim.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);
  const baseRotate = (index * 53) % 360;
  const size = 7 + ((index * 41) % 6);
  return (
    <RNAnimated.View
      style={[
        styles.confetti,
        {
          left: `${(index * 39) % 100}%`,
          width: size,
          height: size * 1.5,
          backgroundColor: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
          opacity: 0.85,
          transform: [
            // Both endpoints are off-screen, so the loop reset (bottom
            // teleporting back above the top) is never visible.
            { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [-40, fallHeight + 40] }) },
            {
              rotate: t.interpolate({
                inputRange: [0, 1],
                outputRange: [`${baseRotate}deg`, `${baseRotate + 560}deg`],
              }),
            },
          ],
        },
      ]}
    />
  );
}

export function ConfettiRain({ count = 26, duration = 3600 }: { count?: number; duration?: number }) {
  const { height } = useWindowDimensions();
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {Array.from({ length: count }).map((_, i) => (
        <ConfettiPiece key={i} index={i} duration={duration} fallHeight={height} />
      ))}
    </View>
  );
}

/** @keyframes bnc — three staggered bouncing dots (loading affordance). */
function BounceDot({ delay }: { delay: number }) {
  const t = useLoopProgress(500, delay);
  return (
    <RNAnimated.View
      style={[
        styles.dot,
        { transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }] },
      ]}
    />
  );
}

export function LoaderDots() {
  return (
    <View style={styles.dotRow}>
      <BounceDot delay={0} />
      <BounceDot delay={150} />
      <BounceDot delay={300} />
    </View>
  );
}

/** @keyframes shim — pulse opacity to 0.4 and back (1.6s loop). */
export function PulseDot({ color, size = 8 }: { color: string; size?: number }) {
  const t = useLoopProgress(800, 0);
  return (
    <RNAnimated.View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        opacity: t.interpolate({ inputRange: [0, 1], outputRange: [1, 0.4] }),
      }}
    />
  );
}

/**
 * @keyframes dashh — a dashed route doodle that draws itself, looping
 * (2.6s linear). Shown while the route optimiser is thinking. The two dots
 * mark start and end of the imaginary walk. SVG props animate on the JS
 * driver — native driver only handles styles.
 */
export function RouteDoodle({ width = 220, height = 120 }: { width?: number; height?: number }) {
  const reduced = useReducedMotion();
  const offset = useRef(new RNAnimated.Value(reduced ? 0 : 300)).current;
  useEffect(() => {
    if (reduced) {
      offset.setValue(0);
      return;
    }
    const anim = RNAnimated.loop(
      RNAnimated.timing(offset, {
        toValue: 0,
        duration: 2600,
        easing: RNEasing.linear,
        useNativeDriver: false,
      }),
    );
    anim.start();
    return () => anim.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);
  return (
    <Svg width={width} height={height} viewBox="0 0 220 120">
      <Circle cx={18} cy={100} r={6} fill={ground.accent} />
      <AnimatedPath
        d="M 18 100 C 48 60, 88 108, 118 78 S 168 38, 196 24"
        fill="none"
        stroke={ground.accent}
        strokeWidth={3.5}
        strokeLinecap="round"
        strokeDasharray="7 8"
        strokeDashoffset={offset}
      />
      <Circle cx={196} cy={24} r={6} fill={ground.accent2} />
    </Svg>
  );
}

/**
 * @keyframes ringfill — progress ring draws from empty to its value
 * (1.4s ease-out, once on mount). Drop inside an existing <Svg>.
 */
export function RingFillCircle({
  progress,
  cx,
  cy,
  r,
  stroke,
  strokeWidth,
}: {
  /** 0..1 */
  progress: number;
  cx: number;
  cy: number;
  r: number;
  stroke: string;
  strokeWidth: number;
}) {
  const reduced = useReducedMotion();
  const circumference = 2 * Math.PI * r;
  const offset = useRef(
    new RNAnimated.Value(reduced ? circumference * (1 - progress) : circumference),
  ).current;
  useEffect(() => {
    const target = circumference * (1 - progress);
    if (reduced) {
      offset.setValue(target);
      return;
    }
    RNAnimated.timing(offset, {
      toValue: target,
      duration: 1400,
      easing: RNEasing.out(RNEasing.cubic),
      useNativeDriver: false,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress, reduced]);
  return (
    <AnimatedCircle
      cx={cx}
      cy={cy}
      r={r}
      stroke={stroke}
      strokeWidth={strokeWidth}
      fill="none"
      strokeLinecap="round"
      strokeDasharray={`${circumference} ${circumference}`}
      strokeDashoffset={offset}
      transform={`rotate(-90 ${cx} ${cy})`}
    />
  );
}

const styles = StyleSheet.create({
  confetti: { position: 'absolute', top: 0, borderRadius: 2 },
  dotRow: { flexDirection: 'row', gap: 6, alignItems: 'flex-end', height: 16 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: ground.accent },
});
