import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, StyleSheet, View } from 'react-native';

import { usePalette } from '@/store/app-store';
import { Txt } from './ui';

const TABS: Record<string, { label: string; icon: string; active: string }> = {
  index: { label: 'Home', icon: 'home-outline', active: 'home' },
  library: { label: 'Library', icon: 'view-agenda-outline', active: 'view-agenda' },
  progress: { label: 'Progress', icon: 'chart-bar', active: 'chart-bar' },
  favorites: { label: 'Favorites', icon: 'heart-outline', active: 'heart' },
  profile: { label: 'Profile', icon: 'account-outline', active: 'account' },
};

/** Fixed floating pill navigation bar. Active tab = violet icon + label on a lavender pill. */
export function PillTabBar({ state, navigateToTab, insets }: BottomTabBarProps) {
  const p = usePalette();
  return (
    <View style={[styles.outer, { paddingBottom: Math.max(insets.bottom, 10), backgroundColor: p.bg }]}>
      <View style={[styles.bar, { backgroundColor: p.surface, shadowColor: p.shadow, borderColor: p.border }]}>
        {state.routes.map((route, i) => {
          const tab = TABS[route.name];
          if (!tab) return null;
          const focused = state.index === i;
          const color = focused ? p.primary : p.icon;
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={tab.label}
              onPress={() => navigateToTab(route.key)}
              style={[styles.item, focused && { backgroundColor: p.primarySoft }]}>
              <MaterialCommunityIcons name={(focused ? tab.active : tab.icon) as never} size={25} color={color} />
              <Txt weight={focused ? 'bold' : 'medium'} size={11.5} color={color} numberOfLines={1}>
                {tab.label}
              </Txt>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { paddingHorizontal: 12, paddingTop: 6 },
  bar: {
    flexDirection: 'row',
    borderRadius: 30,
    padding: 7,
    borderWidth: StyleSheet.hairlineWidth,
    shadowOpacity: 0.16,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, paddingVertical: 9, borderRadius: 22 },
});
