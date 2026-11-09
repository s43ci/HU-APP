import { Alert, Platform, Pressable, StyleSheet, View } from 'react-native';

import { Type } from '@/constants/theme';
import { t as tt } from '@/i18n';
import { api } from '@/lib/api';
import { useApp } from '@/store/app-store';
import { Txt } from '../ui';

/** Call an admin action on the server. */
export const adm = <T,>(action: string, params: Record<string, unknown> = {}) => api<T>('/api/admin', { body: { action, ...params } });

/** Yes/no question that works on phones and on the web. */
export function confirm(title: string, message = '', yes = 'Confirm', destructive = false): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(`${tt(title)}${message ? `\n\n${tt(message)}` : ''}`));
  return new Promise((resolve) =>
    Alert.alert(tt(title), message ? tt(message) : undefined, [
      { text: tt('Cancel'), style: 'cancel', onPress: () => resolve(false) },
      { text: tt(yes), style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
    ]),
  );
}

export const STAGE_SHORT: Record<string, string> = { stage1: '1st', stage2: '2nd', stage3: '3rd', stage4: '4th', stage5: '5th' };

export const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
};

export function PlanBadge({ plan }: { plan: string }) {
  const { palette: p } = useApp();
  const bg = plan === 'premium' ? p.ink : plan === 'pro' ? p.primary : p.surfaceAlt;
  const fg = plan === 'free' ? p.textMuted : plan === 'premium' ? p.onInk : '#fff';
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Txt weight="semibold" size={10.5} color={fg}>{plan === 'premium' ? 'Premium' : plan === 'pro' ? 'Pro' : 'Free'}</Txt>
    </View>
  );
}

export function Tag({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: color + '22' }]}>
      <Txt weight="semibold" size={10.5} color={color}>{label}</Txt>
    </View>
  );
}

export function Seg<T extends string>({ value, options, onChange }: { value: T; options: { key: T; label: string }[]; onChange: (v: T) => void }) {
  const { palette: p } = useApp();
  return (
    <View style={[styles.seg, { backgroundColor: p.surface }]}>
      {options.map((o) => (
        <Pressable key={o.key} onPress={() => onChange(o.key)} style={[styles.segBtn, value === o.key && { backgroundColor: p.ink }]}>
          <Txt weight="semibold" size={Type.tiny} color={value === o.key ? p.onInk : p.textMuted} numberOfLines={1}>{o.label}</Txt>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, alignSelf: 'flex-start' },
  seg: { flexDirection: 'row', borderRadius: 999, padding: 4 },
  segBtn: { flex: 1, alignItems: 'center', paddingVertical: 9, paddingHorizontal: 6, borderRadius: 999 },
});
