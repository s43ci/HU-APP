import { Redirect } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Overview } from '@/components/admin/overview';
import { Pricing } from '@/components/admin/pricing';
import { Requests } from '@/components/admin/requests';
import { Staff } from '@/components/admin/staff';
import { Students } from '@/components/admin/students';
import { Subjects } from '@/components/admin/subjects';
import { Universities } from '@/components/admin/universities';
import { AiSettings } from '@/components/admin/ai-settings';
import { Usage } from '@/components/admin/usage';
import { Chip, TopBar, Txt } from '@/components/ui';
import { Type } from '@/constants/theme';
import { useApp } from '@/store/app-store';

type Tab = 'overview' | 'usage' | 'requests' | 'students' | 'pricing' | 'subjects' | 'universities' | 'ai' | 'staff';

/** Admin & moderator dashboard. Each section shows only for the permissions this account has. */
export default function AdminDashboard() {
  const app = useApp();
  const p = app.palette;
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [tab, setTab] = useState<Tab>('overview');

  if (!app.isStaff) return <Redirect href="/" />;

  const tabs: { key: Tab; label: string; show: boolean }[] = [
    { key: 'overview', label: 'Overview', show: true },
    { key: 'usage', label: 'Usage', show: app.can('stats') },
    { key: 'requests', label: 'Requests', show: app.can('requests') },
    { key: 'students', label: 'Students', show: app.can('students') },
    { key: 'pricing', label: 'Prices', show: true },
    { key: 'subjects', label: 'Subjects', show: true },
    { key: 'universities', label: 'Universities', show: true },
    { key: 'ai', label: 'AI settings', show: app.canUpload },
    { key: 'staff', label: 'Moderators', show: app.isAdmin },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <TopBar title="Admin dashboard" />
      <View style={{ paddingHorizontal: 20 }}>
        <Txt muted size={Type.tiny}>
          {app.account?.name} · {app.isAdmin ? 'Admin' : 'Moderator'}
        </Txt>
      </View>
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {tabs
            .filter((t) => t.show)
            .map((t) => (
              <Chip key={t.key} label={t.label} active={tab === t.key} onPress={() => setTab(t.key)} />
            ))}
        </ScrollView>
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 4, paddingBottom: insets.bottom + 40, width: '100%', maxWidth: Math.min(width, 760), alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
        {tab === 'overview' ? <Overview go={(t) => setTab(t as Tab)} /> : null}
        {tab === 'usage' ? <Usage /> : null}
        {tab === 'requests' ? <Requests /> : null}
        {tab === 'students' ? <Students /> : null}
        {tab === 'pricing' ? <Pricing /> : null}
        {tab === 'subjects' ? <Subjects /> : null}
        {tab === 'universities' ? <Universities /> : null}
        {tab === 'ai' ? <AiSettings /> : null}
        {tab === 'staff' ? <Staff /> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: { gap: 8, paddingHorizontal: 20, paddingVertical: 14 },
});
