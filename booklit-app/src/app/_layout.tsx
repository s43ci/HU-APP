import {
  PlusJakartaSans_300Light,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import { Alexandria_600SemiBold, Alexandria_700Bold } from '@expo-google-fonts/alexandria';
import { IBMPlexSansArabic_300Light, IBMPlexSansArabic_400Regular, IBMPlexSansArabic_500Medium } from '@expo-google-fonts/ibm-plex-sans-arabic';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { Stack } from 'expo-router/stack';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { AppErrorBoundary } from '@/components/error-boundary';
import { installGlobalHandlers } from '@/lib/log';
import { AppStoreProvider, useApp } from '@/store/app-store';

installGlobalHandlers();

/** Any screen that throws while rendering shows this instead of crashing (and is logged). */
export const ErrorBoundary = AppErrorBoundary;

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_300Light,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    // Arabic
    IBMPlexSansArabic_300Light,
    IBMPlexSansArabic_400Regular,
    IBMPlexSansArabic_500Medium,
    Alexandria_600SemiBold,
    Alexandria_700Bold,
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
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="welcome" options={{ gestureEnabled: false }} />
        <Stack.Screen name="reader/[topicId]" />
        <Stack.Screen name="quiz/[topicId]" />
        <Stack.Screen name="ai/[topicId]" />
        <Stack.Screen name="import" />
      </Stack>
    </ThemeProvider>
  );
}
