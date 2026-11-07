import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type TextProps, type TextStyle, type ViewStyle } from 'react-native';

import { Font, Radius } from '@/constants/theme';
import { usePalette } from '@/store/app-store';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export function Icon({ name, size = 22, color }: { name: string; size?: number; color?: string }) {
  const p = usePalette();
  return <MaterialCommunityIcons name={name as IconName} size={size} color={color ?? p.icon} />;
}

type Weight = keyof typeof Font;
export function Txt({
  weight = 'regular',
  size = 15,
  color,
  muted,
  style,
  ...rest
}: TextProps & { weight?: Weight; size?: number; color?: string; muted?: boolean; style?: StyleProp<TextStyle> }) {
  const p = usePalette();
  return (
    <Text
      {...rest}
      style={[{ fontFamily: Font[weight], fontSize: size, color: color ?? (muted ? p.textMuted : p.text) }, style]}
    />
  );
}

export function Card({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  const p = usePalette();
  const base: StyleProp<ViewStyle> = [
    styles.card,
    { backgroundColor: p.surface, borderColor: p.border, shadowColor: p.shadow },
    style,
  ];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [base, pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] }]}>
      {children}
    </Pressable>
  );
}

export function ProgressBar({ value, color, track, height = 6 }: { value: number; color?: string; track?: string; height?: number }) {
  const p = usePalette();
  return (
    <View style={{ height, borderRadius: height, backgroundColor: track ?? p.border, overflow: 'hidden' }}>
      <View style={{ width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%`, height, borderRadius: height, backgroundColor: color ?? p.primary }} />
    </View>
  );
}

/** Square artwork tile for a subject: tinted gradient + line icon. */
export function SubjectArt({ color, icon, size = 64, radius = 14 }: { color: string; icon: string; size?: number; radius?: number }) {
  return (
    <LinearGradient
      colors={[shade(color, 0.25), color, shade(color, -0.25)]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width: size, height: size, borderRadius: radius, alignItems: 'center', justifyContent: 'center' }}>
      <MaterialCommunityIcons name={icon as IconName} size={size * 0.5} color="rgba(255,255,255,0.95)" />
    </LinearGradient>
  );
}

export function IconBadge({ name, color, bg, size = 40 }: { name: string; color?: string; bg?: string; size?: number }) {
  const p = usePalette();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2.6, backgroundColor: bg ?? p.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
      <MaterialCommunityIcons name={name as IconName} size={size * 0.52} color={color ?? p.primary} />
    </View>
  );
}

export function Button({
  label,
  icon,
  onPress,
  variant = 'primary',
  style,
}: {
  label: string;
  icon?: string;
  onPress?: () => void;
  variant?: 'primary' | 'soft' | 'ghost' | 'danger';
  style?: StyleProp<ViewStyle>;
}) {
  const p = usePalette();
  const bg = variant === 'primary' ? p.primary : variant === 'soft' ? p.primarySoft : variant === 'danger' ? p.dangerSoft : 'transparent';
  const fg = variant === 'primary' ? '#fff' : variant === 'danger' ? '#E5484D' : p.primary;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.button, { backgroundColor: bg, opacity: pressed ? 0.8 : 1 }, variant === 'ghost' && { borderWidth: 1, borderColor: p.border }, style]}>
      {icon ? <MaterialCommunityIcons name={icon as IconName} size={18} color={fg} /> : null}
      <Txt weight="semibold" color={fg}>
        {label}
      </Txt>
    </Pressable>
  );
}

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  const p = usePalette();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, { backgroundColor: active ? p.primary : p.surface, borderColor: active ? p.primary : p.border }]}>
      <Txt weight={active ? 'semibold' : 'medium'} size={14} color={active ? '#fff' : p.text}>
        {label}
      </Txt>
    </Pressable>
  );
}

export function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const p = usePalette();
  return (
    <View style={styles.sectionRow}>
      <Txt weight="bold" size={19}>
        {title}
      </Txt>
      {action ? (
        <Pressable onPress={onAction} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Txt weight="semibold" size={14} color={p.primary}>
            {action}
          </Txt>
          <MaterialCommunityIcons name="chevron-right" size={18} color={p.primary} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function EmptyState({ icon, title, text, action, onAction }: { icon: string; title: string; text: string; action?: string; onAction?: () => void }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24, gap: 10 }}>
      <IconBadge name={icon} size={64} />
      <Txt weight="bold" size={18} style={{ marginTop: 6 }}>
        {title}
      </Txt>
      <Txt muted style={{ textAlign: 'center', lineHeight: 21 }}>
        {text}
      </Txt>
      {action ? <Button label={action} onPress={onAction} style={{ marginTop: 8 }} /> : null}
    </View>
  );
}

/** Lighten (amt>0) or darken (amt<0) a hex color. */
export function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) =>
    Math.round(amt > 0 ? c + (255 - c) * amt : c * (1 + amt)),
  );
  return `#${ch.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

export function withAlpha(hex: string, a: number) {
  return `${hex}${Math.round(a * 255).toString(16).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: Radius.md,
  },
  chip: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: Radius.pill, borderWidth: 1 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
});
