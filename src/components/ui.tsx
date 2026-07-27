import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text as RNText,
  TextProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { CategoryId, categories, fonts, ground, radii, spacing } from '@/theme/tokens';

// ---------- Typography ----------

export function Heading({ style, ...rest }: TextProps) {
  return <RNText {...rest} style={[styles.heading, style]} />;
}

export function Body({ style, ...rest }: TextProps) {
  return <RNText {...rest} style={[styles.body, style]} />;
}

/** Small-caps style section label, e.g. "PARK HISTORY". */
export function SectionLabel({ color, style, ...rest }: TextProps & { color?: string }) {
  return (
    <RNText
      {...rest}
      style={[styles.sectionLabel, { color: color ?? ground.accent }, style]}
    />
  );
}

// ---------- Buttons ----------

interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'outline' | 'ghost';
  color?: string;
  textColor?: string;
  style?: ViewStyle;
  textStyle?: TextStyle;
  disabled?: boolean;
  accessibilityLabel?: string;
  /** Optional leading icon, rendered before the label. */
  icon?: React.ReactNode;
}

export function PillButton({
  label,
  onPress,
  variant = 'primary',
  color,
  textColor,
  style,
  textStyle,
  disabled,
  accessibilityLabel,
  icon,
}: ButtonProps) {
  const bg = variant === 'primary' ? (color ?? ground.accent) : 'transparent';
  const border = variant === 'outline' ? { borderWidth: 1.5, borderColor: color ?? ground.text } : null;
  const fg = textColor ?? (variant === 'primary' ? ground.white : ground.text);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.pillButton,
        { backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.85 : 1 },
        border,
        style,
      ]}
    >
      {icon ? <View style={styles.pillButtonIcon}>{icon}</View> : null}
      <RNText style={[styles.pillButtonText, { color: fg }, textStyle]}>{label}</RNText>
    </Pressable>
  );
}

// ---------- Chips ----------

export function Chip({
  label,
  active,
  onPress,
  activeColor,
  dotColor,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  activeColor?: string;
  dotColor?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      onPress={onPress}
      style={[styles.chip, active && { backgroundColor: activeColor ?? ground.accent }]}
    >
      {dotColor ? <View style={[styles.chipDot, { backgroundColor: dotColor }]} /> : null}
      <RNText style={[styles.chipText, active && { color: ground.white, fontFamily: fonts.bodySemi }]}>
        {label}
      </RNText>
    </Pressable>
  );
}

export function CategoryPill({ category, label }: { category: CategoryId; label: string }) {
  const pal = categories[category];
  return (
    <View style={[styles.categoryPill, { backgroundColor: pal.ink }]}>
      <View style={styles.categoryPillDot} />
      <RNText style={styles.categoryPillText}>{label}</RNText>
    </View>
  );
}

// ---------- Stamp ring (the brand motif: solid ring + dashed inner ring) ----------

export function StampRing({
  size = 56,
  color = ground.accent,
  filled = false,
}: {
  size?: number;
  color?: string;
  filled?: boolean;
}) {
  const r = size / 2;
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Circle cx={50} cy={50} r={46} stroke={color} strokeWidth={5} fill={filled ? color : 'none'} opacity={0.92} />
      <Circle
        cx={50}
        cy={50}
        r={36}
        stroke={filled ? ground.white : color}
        strokeWidth={2.5}
        strokeDasharray="6 5"
        fill="none"
        opacity={0.92}
      />
    </Svg>
  );
}

// ---------- Card ----------

export function Card({ children, style, tint }: { children: React.ReactNode; style?: ViewStyle; tint?: string }) {
  return <View style={[styles.card, tint ? { backgroundColor: tint } : null, style]}>{children}</View>;
}

// ---------- Dialog (bottom-sheet style confirmation) ----------

export function Dialog({
  visible,
  onClose,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.dialogBackdrop} onPress={onClose}>
        <Pressable style={styles.dialogSheet} onPress={(e) => e.stopPropagation()}>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  heading: {
    fontFamily: fonts.heading,
    fontSize: 32,
    color: ground.text,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 24,
    color: ground.text,
  },
  sectionLabel: {
    fontFamily: fonts.heading,
    fontSize: 15,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  pillButton: {
    borderRadius: radii.pill,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  pillButtonIcon: { marginRight: 8 },
  pillButtonText: {
    fontFamily: fonts.heading,
    fontSize: 17,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: ground.surfaceLight,
    borderRadius: radii.pill,
    paddingVertical: 9,
    paddingHorizontal: 16,
    minHeight: 38,
  },
  chipDot: { width: 7, height: 7, borderRadius: 4 },
  chipText: { fontFamily: fonts.body, fontSize: 15, color: ground.text },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: radii.pill,
    paddingVertical: 7,
    paddingHorizontal: 14,
    alignSelf: 'flex-start',
  },
  categoryPillDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: ground.white },
  categoryPillText: { color: ground.white, fontFamily: fonts.bodySemi, fontSize: 15 },
  card: {
    backgroundColor: ground.surfaceLight,
    borderRadius: radii.lg,
    padding: spacing.md,
  },
  dialogBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(32,30,29,0.45)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  dialogSheet: {
    backgroundColor: ground.bg,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
});
