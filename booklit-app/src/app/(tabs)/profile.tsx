import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Card, Icon, Txt } from '@/components/ui';
import { HeaderGradient } from '@/constants/theme';
import { stageName, subjects } from '@/data/content';
import { formatStudyTime, startedBooklets } from '@/lib/progress';
import { useApp } from '@/store/app-store';

export default function Profile() {
  const app = useApp();
  const p = app.palette;
  const prof = app.profile!;
  const booklets = startedBooklets(subjects.map((s) => s.id), app.completedTopics, app.topicProgress).length;
  const accuracy = app.quiz.answered ? Math.round((app.quiz.correct / app.quiz.answered) * 100) : 0;
  const initials = prof.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

  const rows: { icon: string; label: string; value?: string; key: string }[] = [
    { icon: 'account-edit-outline', label: 'Edit Profile', key: 'edit-profile' },
    { icon: 'lock-outline', label: 'Change Password', key: 'password' },
    { icon: 'bell-outline', label: 'Notifications', value: app.notifications ? 'On' : 'Off', key: 'notifications' },
    { icon: 'moon-waning-crescent', label: 'Appearance', value: app.appearance === 'system' ? 'System' : app.appearance === 'dark' ? 'Dark' : 'Light', key: 'appearance' },
    { icon: 'web', label: 'Language', value: app.language, key: 'language' },
    { icon: 'heart-outline', label: 'Favorites', key: 'favorites' },
    { icon: 'history', label: 'Recently Viewed', key: 'recent' },
    { icon: 'help-circle-outline', label: 'Help & Support', key: 'help' },
    { icon: 'information-outline', label: 'About Booklit', key: 'about' },
  ];

  return (
    <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
      <LinearGradient colors={['#6FA3FF', HeaderGradient[1], HeaderGradient[2], HeaderGradient[3]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <Pressable onPress={() => router.push({ pathname: '/settings/[key]', params: { key: 'edit-profile' } })} style={styles.avatar}>
          <Txt weight="extrabold" size={30} color="#5B4BE6">{initials}</Txt>
          <View style={[styles.edit, { backgroundColor: p.surface }]}>
            <Icon name="pencil" size={14} color={p.primary} />
          </View>
        </Pressable>
        <Txt weight="bold" size={24} color="#fff" style={{ marginTop: 12 }}>{prof.name}</Txt>
        {prof.email ? <Txt size={13} color="rgba(255,255,255,0.8)">{prof.email}</Txt> : null}
        <View style={styles.stage}>
          <Icon name="layers-outline" size={16} color="#fff" />
          <Txt weight="semibold" size={13} color="#fff">{stageName(prof.stageId)}</Txt>
        </View>
      </LinearGradient>

      <Card style={styles.stats}>
        <Stat icon="book-open-outline" value={`${booklets}`} label="Booklets" />
        <View style={[styles.div, { backgroundColor: p.border }]} />
        <Stat icon="check-circle-outline" value={`${accuracy}%`} label="Accuracy" />
        <View style={[styles.div, { backgroundColor: p.border }]} />
        <Stat icon="clock-outline" value={formatStudyTime(app.studySeconds)} label="Study Time" />
      </Card>

      <Card style={{ marginTop: 18, paddingHorizontal: 6 }}>
        {rows.map((r, i) => (
          <Pressable
            key={r.key}
            onPress={() => (r.key === 'favorites' ? router.push('/favorites') : router.push({ pathname: '/settings/[key]', params: { key: r.key } }))}
            style={({ pressed }) => [styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: p.border }, pressed && { opacity: 0.6 }]}>
            <Icon name={r.icon} size={22} />
            <Txt weight="semibold" size={15.5} style={{ flex: 1 }}>{r.label}</Txt>
            {r.value ? <Txt muted size={14}>{r.value}</Txt> : null}
            <Icon name="chevron-right" />
          </Pressable>
        ))}
      </Card>

      <Pressable
        onPress={() =>
          Alert.alert('Log out', 'Your local progress on this device will be cleared.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Log Out', style: 'destructive', onPress: () => { app.logOut(); router.replace('/welcome'); } },
          ])
        }
        style={[styles.logout, { backgroundColor: p.dangerSoft }]}>
        <Icon name="logout" size={22} color="#E5484D" />
        <Txt weight="bold" size={16} color="#E5484D">Log Out</Txt>
      </Pressable>
    </ScrollView>
  );
}

function Stat({ icon, value, label }: { icon: string; value: string; label: string }) {
  const { palette: p } = useApp();
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 4 }}>
      <Icon name={icon} size={24} color={p.primary} />
      <Txt weight="extrabold" size={18}>{value}</Txt>
      <Txt muted size={12}>{label}</Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', borderRadius: 26, paddingTop: 26, paddingBottom: 54 },
  avatar: { width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: 'rgba(255,255,255,0.5)' },
  edit: { position: 'absolute', right: 0, bottom: 2, width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  stage: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, marginTop: 10 },
  stats: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 12, marginTop: -34, paddingVertical: 16 },
  div: { width: 1, height: 44 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, paddingHorizontal: 12 },
  logout: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 18, paddingVertical: 16, marginTop: 18 },
});
