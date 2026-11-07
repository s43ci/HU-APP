import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { Stack } from 'expo-router/stack';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { AppStoreProvider, useApp } from '@/store/app-store';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });
  return (
    <AppStoreProvider>
      <Root fontsLoaded={fontsLoaded} />
    </AppStoreProvider>
  );
}

function Root({ fontsLoaded }: { fontsLoaded: boolean }) {
  const { ready, isDark, palette } = useApp();
  const show = ready && fontsLoaded;

  useEffect(() => {
    if (show) SplashScreen.hideAsync().catch(() => {});
  }, [show]);

  if (!show) return null;

  const base = isDark ? DarkTheme : DefaultTheme;
  const theme = { ...base, colors: { ...base.colors, background: palette.bg, card: palette.surface, text: palette.text, primary: palette.primary, border: palette.border } };

  return (
    <ThemeProvider value={theme}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="welcome" options={{ gestureEnabled: false }} />
        <Stack.Screen name="reader/[topicId]" />
        <Stack.Screen name="quiz/[topicId]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="ai/[topicId]" options={{ presentation: 'modal' }} />
      </Stack>
    </ThemeProvider>
  );
}
