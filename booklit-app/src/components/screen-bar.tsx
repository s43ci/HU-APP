import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useApp } from '@/store/app-store';
import { Icon, Txt } from './ui';

/** Simple top bar for inner (stack) screens: back, centred title, optional right action. */
export function ScreenBar({ title, right }: { title: string; right?: ReactNode }) {
  const insets = useSafeAreaInsets();
  const { palette: p } = useApp();
  return (
    <View style={[styles.bar, { paddingTop: insets.top + 6, backgroundColor: p.surface, borderBottomColor: p.border }]}>
      <Pressable hitSlop={10} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} style={styles.side} accessibilityLabel="Back">
        <Icon name="chevron-left" size={30} color={p.text} />
      </Pressable>
      <Txt weight="bold" size={18} numberOfLines={1} style={{ flex: 1, textAlign: 'center' }}>
        {title}
      </Txt>
      <View style={[styles.side, { alignItems: 'flex-end' }]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  side: { width: 48 },
});
