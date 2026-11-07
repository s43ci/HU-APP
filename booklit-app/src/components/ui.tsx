import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ArrowLeft, ArrowUpRight, Lock, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ScrollViewProps,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Font, Radius, TAB_BAR_SPACE, Type } from '@/constants/theme';
import { subjectVisual } from '@/lib/subject-visuals';
import { usePalette } from '@/store/app-store';

export type { LucideIcon };

/** Thin line icon (Iconly-style): 1.6 stroke, rounded caps. */
export function Icon({ as: As, size = 20, color, stroke = 1.6 }: { as: LucideIcon; size?: number; color?: string; stroke?: number }) {
  const p = usePalette();
  return <As size={size} color={color ?? p.icon} strokeWidth={stroke} absoluteStrokeWidth />;
}

type Weight = keyof typeof Font;
export function Txt({
  weight = 'regular',
  size = Type.body,
  color,
  muted,
  faint,
  style,
  ...rest
}: TextProps & { weight?: Weight; size?: number; color?: string; muted?: boolean; faint?: boolean; style?: StyleProp<TextStyle> }) {
  const p = usePalette();
  return (
    <Text
      {...rest}
      style={[{ fontFamily: Font[weight], fontSize: size, color: color ?? (faint ? p.textFaint : muted ? p.textMuted : p.text) }, style]}
    />
  );
}

/** Two-tone heading like "Need help / studying today?" */
export function Heading({ light, strong, size = Type.display }: { light: string; strong: string; size?: number }) {
  const p = usePalette();
  return (
    <Text style={{ fontSize: size, lineHeight: size * 1.18, letterSpacing: -0.6 }}>
      <Text style={{ fontFamily: Font.light, color: p.textMuted }}>{light} </Text>
      <Text style={{ fontFamily: Font.semibold, color: p.text }}>{strong}</Text>
    </Text>
  );
}

/** Scrollable tab page with safe-area top and room for the floating nav bar. */
export function Page({ children, contentStyle, ...rest }: ScrollViewProps & { children: ReactNode; contentStyle?: StyleProp<ViewStyle> }) {
  const insets = useSafeAreaInsets();
  const p = usePalette();
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      style={{ flex: 1, backgroundColor: p.bg }}
      contentContainerStyle={[{ paddingTop: insets.top + 10, paddingHorizontal: 20, paddingBottom: TAB_BAR_SPACE + insets.bottom }, contentStyle]}
      {...rest}>
      {children}
    </ScrollView>
  );
}

export function Card({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  const p = usePalette();
  const base: StyleProp<ViewStyle> = [styles.card, { backgroundColor: p.surface, shadowColor: p.shadow }, style];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [base, pressed && styles.pressed]}>
      {children}
    </Pressable>
  );
}

/** Round icon button (white circle). */
export function CircleButton({
  icon,
  onPress,
  size = 44,
  variant = 'surface',
  label,
  badge,
}: {
  icon: LucideIcon;
  onPress?: () => void;
  size?: number;
  variant?: 'surface' | 'ink' | 'primary' | 'soft' | 'glass';
  label: string;
  badge?: boolean;
}) {
  const p = usePalette();
  const bg = { surface: p.surface, ink: p.ink, primary: p.primary, soft: p.primarySoft, glass: 'rgba(255,255,255,0.85)' }[variant];
  const fg = { surface: p.icon, ink: p.onInk, primary: '#fff', soft: p.primary, glass: '#17172B' }[variant];
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        { width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' },
        variant === 'surface' && { shadowColor: p.shadow, shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 1 },
        pressed && styles.pressed,
      ]}>
      <Icon as={icon} size={size * 0.44} color={fg} />
      {badge ? <View style={[styles.badge, { borderColor: bg }]} /> : null}
    </Pressable>
  );
}

export function Chip({ label, active, onPress, icon }: { label: string; active?: boolean; onPress?: () => void; icon?: LucideIcon }) {
  const p = usePalette();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: active ? p.ink : p.surface, borderColor: active ? p.ink : p.border },
        pressed && styles.pressed,
      ]}>
      {icon ? <Icon as={icon} size={15} color={active ? p.onInk : p.icon} /> : null}
      <Txt weight="medium" size={Type.small} color={active ? p.onInk : p.text}>
        {label}
      </Txt>
    </Pressable>
  );
}

export function Button({
  label,
  icon,
  onPress,
  variant = 'ink',
  style,
  disabled,
}: {
  label: string;
  icon?: LucideIcon;
  onPress?: () => void;
  variant?: 'ink' | 'primary' | 'soft' | 'outline' | 'danger' | 'white';
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}) {
  const p = usePalette();
  const bg = { ink: p.ink, primary: p.primary, soft: p.primarySoft, outline: 'transparent', danger: p.dangerSoft, white: '#FFFFFF' }[variant];
  const fg = { ink: p.onInk, primary: '#fff', soft: p.primary, outline: p.text, danger: '#E5484D', white: '#17172B' }[variant];
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg },
        variant === 'outline' && { borderWidth: 1, borderColor: p.border },
        (pressed || disabled) && { opacity: disabled ? 0.45 : 0.85 },
        style,
      ]}>
      {icon ? <Icon as={icon} size={17} color={fg} /> : null}
      <Txt weight="semibold" size={Type.body} color={fg}>
        {label}
      </Txt>
    </Pressable>
  );
}

export function ProgressBar({ value, color, track, height = 4 }: { value: number; color?: string; track?: string; height?: number }) {
  const p = usePalette();
  return (
    <View style={{ height, borderRadius: height, backgroundColor: track ?? p.surfaceAlt, overflow: 'hidden' }}>
      <View style={{ width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%`, height, borderRadius: height, backgroundColor: color ?? p.primary }} />
    </View>
  );
}

export function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionRow}>
      <Txt weight="semibold" size={Type.h2}>
        {title}
      </Txt>
      {action ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Txt weight="medium" size={Type.small} muted>
            {action}
          </Txt>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Subject artwork: Gemini image when available, otherwise a calm tinted tile with a thin icon. */
export function SubjectThumb({ subjectId, size, width, height, radius = 16, locked }: { subjectId: string; size?: number; width?: number | `${number}%`; height?: number; radius?: number; locked?: boolean }) {
  const p = usePalette();
  const v = subjectVisual(subjectId);
  const w = width ?? size ?? 56;
  const h = height ?? size ?? 56;
  const iconSize = Math.min(typeof w === 'number' ? w : h, h) * 0.36;
  return (
    <View style={{ width: w, height: h, borderRadius: radius, overflow: 'hidden', backgroundColor: p.primarySoft }}>
      {v.image ? (
        <Image source={v.image} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
      ) : (
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
          <Icon as={v.icon} size={iconSize} color={p.primary} stroke={1.4} />
        </View>
      )}
      {locked ? (
        <View style={styles.lock}>
          <Lock size={12} color="#17172B" strokeWidth={2} />
        </View>
      ) : null}
    </View>
  );
}

export function ArrowCircle({ onPress, variant = 'surface', size = 36 }: { onPress?: () => void; variant?: 'surface' | 'ink' | 'primary'; size?: number }) {
  return <CircleButton icon={ArrowUpRight} onPress={onPress} size={size} variant={variant} label="Open" />;
}

/** Top bar for inner screens: round back button, centred title, optional right slot. */
export function TopBar({ title, right, onBack }: { title?: string; right?: ReactNode; onBack?: () => void }) {
  const insets = useSafeAreaInsets();
  const p = usePalette();
  return (
    <View style={[styles.topBar, { paddingTop: insets.top + 8, backgroundColor: p.bg, zIndex: 5 }]}>
      <CircleButton icon={ArrowLeft} label="Back" onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')))} />
      <View style={{ flex: 1, alignItems: 'center', paddingHorizontal: 8 }}>
        {title ? (
          <Txt weight="semibold" size={Type.h2 - 1} numberOfLines={1}>
            {title}
          </Txt>
        ) : null}
      </View>
      <View style={{ minWidth: 44, alignItems: 'flex-end' }}>{right}</View>
    </View>
  );
}

export function EmptyState({ icon, title, text, action, onAction }: { icon: LucideIcon; title: string; text: string; action?: string; onAction?: () => void }) {
  const p = usePalette();
  return (
    <View style={{ alignItems: 'center', paddingVertical: 44, paddingHorizontal: 24, gap: 8 }}>
      <View style={[styles.emptyIcon, { backgroundColor: p.primarySoft }]}>
        <Icon as={icon} size={28} color={p.primary} />
      </View>
      <Txt weight="semibold" size={Type.h2} style={{ marginTop: 8 }}>
        {title}
      </Txt>
      <Txt muted size={Type.small} style={{ textAlign: 'center', lineHeight: 20 }}>
        {text}
      </Txt>
      {action ? <Button label={action} onPress={onAction} style={{ marginTop: 10 }} /> : null}
    </View>
  );
}

export function withAlpha(hex: string, a: number) {
  return `${hex}${Math.round(a * 255).toString(16).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    shadowOpacity: 0.05,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 1,
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.985 }] },
  badge: { position: 'absolute', top: 10, right: 11, width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF5C93', borderWidth: 1.5 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 9, borderRadius: Radius.pill, borderWidth: 1 },
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 14, borderRadius: Radius.pill },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  lock: { position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 10 },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
});
