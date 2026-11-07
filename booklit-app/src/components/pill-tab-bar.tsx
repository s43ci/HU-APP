import * as Haptics from 'expo-haptics';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { ChartColumn, Heart, House, LibraryBig, UserRound, type LucideIcon } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Animated, PanResponder, Platform, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { Font } from '@/constants/theme';
import { useApp } from '@/store/app-store';

const TABS: Record<string, { label: string; icon: LucideIcon }> = {
  index: { label: 'Home', icon: House },
  library: { label: 'Library', icon: LibraryBig },
  progress: { label: 'Progress', icon: ChartColumn },
  favorites: { label: 'Favorites', icon: Heart },
  profile: { label: 'Profile', icon: UserRound },
};

const PAD = 6;

/**
 * Floating dark pill navigation. The white highlight can be dragged across the bar:
 * icon + label colours cross-fade with the highlight position, and on release it
 * snaps to the nearest tab and opens it. Tapping a tab slides the highlight there.
 */
export function PillTabBar({ state, navigateToTab, insets }: BottomTabBarProps) {
  const { palette: p, isDark } = useApp();
  const routes = state.routes.filter((r) => TABS[r.name]);
  const count = routes.length;

  const [itemW, setItemW] = useState(0);
  const [x] = useState(() => new Animated.Value(0));
  const [scale] = useState(() => new Animated.Value(1));
  const live = useRef({ x: 0, start: 0, w: 0, index: state.index, routes, navigateToTab });

  useEffect(() => {
    live.current.routes = routes;
    live.current.navigateToTab = navigateToTab;
  });

  useEffect(() => {
    const id = x.addListener(({ value }) => (live.current.x = value));
    return () => x.removeListener(id);
  }, [x]);

  // Follow navigation that happens elsewhere (e.g. "View all" links).
  useEffect(() => {
    live.current.index = state.index;
    if (itemW) Animated.spring(x, { toValue: state.index * itemW, useNativeDriver: false, damping: 18, stiffness: 180 }).start();
  }, [state.index, itemW, x]);

  const go = (i: number) => {
    const r = live.current.routes[i];
    if (!r) return;
    Animated.spring(x, { toValue: i * live.current.w, useNativeDriver: false, damping: 18, stiffness: 180 }).start();
    if (i !== live.current.index) {
      if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
      live.current.navigateToTab(r.key);
    }
  };

  // Refs are only read inside the gesture callbacks, never during render.
  // eslint-disable-next-line react-hooks/refs
  const [pan] = useState(() =>
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderGrant: () => {
        x.stopAnimation();
        live.current.start = live.current.x;
        Animated.spring(scale, { toValue: 1.06, useNativeDriver: false }).start();
      },
      onPanResponderMove: (_, g) => {
        const max = (live.current.routes.length - 1) * live.current.w;
        x.setValue(Math.max(0, Math.min(max, live.current.start + g.dx)));
      },
      onPanResponderRelease: () => {
        Animated.spring(scale, { toValue: 1, useNativeDriver: false }).start();
        const w = live.current.w || 1;
        go(Math.round(live.current.x / w));
      },
      onPanResponderTerminate: () => {
        Animated.spring(scale, { toValue: 1, useNativeDriver: false }).start();
        go(live.current.index);
      },
    }),
  );

  const onLayout = (e: LayoutChangeEvent) => {
    const w = (e.nativeEvent.layout.width - PAD * 2) / count;
    live.current.w = w;
    x.setValue(state.index * w);
    setItemW(w);
  };

  const inactive = isDark ? '#7E7E98' : '#9A9AB0';
  const activeFg = '#17172B';

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: Math.max(insets.bottom, 12) }]}>
      <View
        onLayout={onLayout}
        {...pan.panHandlers}
        style={[styles.bar, { backgroundColor: p.navBar, shadowColor: '#17172B' }]}>
        {itemW ? (
          <Animated.View
            pointerEvents="none"
            style={[styles.indicator, { width: itemW, transform: [{ translateX: x }, { scale }] }]}
          />
        ) : null}
        {routes.map((route, i) => {
          const tab = TABS[route.name];
          const on = itemW
            ? x.interpolate({ inputRange: [(i - 1) * itemW, i * itemW, (i + 1) * itemW], outputRange: [0, 1, 0], extrapolate: 'clamp' })
            : new Animated.Value(i === state.index ? 1 : 0);
          const off = Animated.subtract(1, on);
          const Ico = tab.icon;
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: state.index === i }}
              accessibilityLabel={tab.label}
              onPress={() => go(i)}
              style={styles.item}>
              <View>
                <Animated.View style={{ opacity: off }}>
                  <Ico size={21} color={inactive} strokeWidth={1.6} absoluteStrokeWidth />
                </Animated.View>
                <Animated.View style={[StyleSheet.absoluteFill, { opacity: on }]}>
                  <Ico size={21} color={activeFg} strokeWidth={1.9} absoluteStrokeWidth />
                </Animated.View>
              </View>
              <View>
                <Animated.Text style={[styles.label, { color: inactive, opacity: off }]}>
                  {tab.label}
                </Animated.Text>
                <Animated.Text style={[styles.label, styles.labelActive, { color: activeFg, opacity: on }]}>
                  {tab.label}
                </Animated.Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16 },
  bar: {
    flexDirection: 'row',
    borderRadius: 28,
    padding: PAD,
    shadowOpacity: 0.28,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 14,
  },
  indicator: {
    position: 'absolute',
    top: PAD,
    bottom: PAD,
    left: PAD,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, paddingVertical: 9 },
  // Same font for both layers so the cross-fading labels have identical widths.
  label: { fontFamily: Font.semibold, fontSize: 11, textAlign: 'center' },
  labelActive: { position: 'absolute', left: 0, right: 0 },
});
