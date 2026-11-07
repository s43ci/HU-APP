import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';

import { AppHeader } from '@/components/app-header';
import { PillTabBar } from '@/components/pill-tab-bar';
import { useApp } from '@/store/app-store';

export default function TabsLayout() {
  const { profile, palette } = useApp();
  if (!profile) return <Redirect href="/welcome" />;

  return (
    <Tabs
      tabBar={(props) => <PillTabBar {...props} />}
      screenOptions={{ header: () => <AppHeader />, sceneStyle: { backgroundColor: palette.bg } }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="library" />
      <Tabs.Screen name="progress" />
      <Tabs.Screen name="favorites" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
