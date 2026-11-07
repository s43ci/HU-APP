import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Font, HeaderGradient } from '@/constants/theme';
import { useApp } from '@/store/app-store';
import { Txt } from './ui';

/** Fixed top header used on every main tab (gradient, logo, notifications, search, theme). */
export function AppHeader() {
  const insets = useSafeAreaInsets();
  const { isDark, toggleTheme, notifications } = useApp();

  return (
    <LinearGradient
      colors={HeaderGradient}
      start={{ x: 0, y: 0.2 }}
      end={{ x: 1, y: 0.9 }}
      style={[styles.wrap, { paddingTop: insets.top + 8 }]}>
      <View style={styles.row}>
        <GlassButton icon="bell-outline" dot={notifications} onPress={() => router.push('/notifications')} label="Notifications" />
        <View style={styles.brand}>
          <View style={styles.logoTile}>
            <Image source={require('@/assets/images/logo-mark.png')} style={styles.logo} contentFit="cover" />
          </View>
          <Txt style={styles.brandText} color="#fff">
            Booklit
          </Txt>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <GlassButton icon="magnify" onPress={() => router.push('/search')} label="Search" />
          <GlassButton icon={isDark ? 'white-balance-sunny' : 'moon-waning-crescent'} onPress={toggleTheme} label="Toggle theme" />
        </View>
      </View>
    </LinearGradient>
  );
}

function GlassButton({ icon, onPress, dot, label }: { icon: string; onPress: () => void; dot?: boolean; label: string }) {
  return (
    <Pressable
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.glass, pressed && { backgroundColor: 'rgba(255,255,255,0.3)' }]}>
      <MaterialCommunityIcons name={icon as never} size={22} color="#fff" />
      {dot ? <View style={styles.dot} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    paddingHorizontal: 16,
    paddingBottom: 16,
    shadowColor: '#5B4BEA',
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
    zIndex: 10,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  logoTile: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: '#FBFDFC',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  logo: { width: 38, height: 38 },
  brandText: { fontFamily: Font.bold, fontSize: 24, letterSpacing: -0.3 },
  glass: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    position: 'absolute',
    top: 7,
    right: 8,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#FF5C93',
    borderWidth: 1.5,
    borderColor: '#5B4BE6',
  },
});
