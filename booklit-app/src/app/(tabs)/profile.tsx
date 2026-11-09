import { router } from 'expo-router';
import {
  Bell,
  LayoutDashboard,
  FileUp,
  Bug,
  Crown,
  Wand2,
  BookOpen,
  ChevronsRight,
  Clock,
  Globe,
  Heart,
  Info,
  KeyRound,
  LifeBuoy,
  ListChecks,
  LogOut,
  Moon,
  Pencil,
  RotateCcw,
  ShieldCheck,
  Flame,
  Target,
  type LucideIcon,
} from 'lucide-react-native';
import { Alert, Platform, Pressable, StyleSheet, View } from 'react-native';

import { Card, Icon, Page, Txt, TabHeader } from '@/components/ui';
import { Type } from '@/constants/theme';
import { stageName, subjects } from '@/data/content';
import { formatStudyTime, initials, startedBooklets } from '@/lib/progress';
import { InstallApp } from '@/components/install-app';
import { useApp } from '@/store/app-store';
import { t as tt } from '@/i18n';

export default function Profile() {
  const app = useApp();
  const p = app.palette;
  const prof = app.profile!;
  const booklets = startedBooklets(subjects.map((s) => s.id), app.completedTopics, app.topicProgress).length;
  const accuracy = app.quiz.answered ? Math.round((app.quiz.correct / app.quiz.answered) * 100) : 0;
  const open = (key: string) => router.push({ pathname: '/settings/[key]', params: { key } });

  const planLabel = app.isAdmin ? 'Admin' : app.isStaff ? 'Moderator' : app.account?.plan === 'premium' ? 'Premium plan' : app.account?.plan === 'pro' ? 'Pro plan' : 'Free plan';
  const rows: { icon: LucideIcon; label: string; sub: string; onPress: () => void }[] = [
    ...(app.isStaff ? [{ icon: LayoutDashboard, label: 'Admin dashboard', sub: 'Students, requests, prices and staff', onPress: () => router.push('/admin') }] : []),
    { icon: Crown, label: app.isStaff ? 'Account' : 'Subscription', sub: planLabel, onPress: () => open('account') },
    ...(app.canUpload ? [{ icon: Wand2, label: 'BOOKLIT Studio', sub: 'Upload, design and question banks', onPress: () => router.push('/studio') }] : []),
    ...(app.canAddFiles && !app.canUpload ? [{ icon: FileUp, label: 'My files', sub: 'Turn your own PDFs into booklets', onPress: () => router.push('/import') }] : []),
    { icon: Pencil, label: 'Edit profile', sub: 'Name, email and stage', onPress: () => open('edit-profile') },
    { icon: Heart, label: 'Saved', sub: 'Your booklets and topics', onPress: () => router.push('/favorites') },
    { icon: RotateCcw, label: 'Recently viewed', sub: 'Pick up where you left off', onPress: () => open('recent') },
    { icon: Bell, label: 'Notifications', sub: app.notifications ? 'On' : 'Off', onPress: () => open('notifications') },
    { icon: Moon, label: 'Appearance', sub: app.appearance === 'system' ? 'System' : app.appearance === 'dark' ? 'Dark' : 'Light', onPress: () => open('appearance') },
    { icon: Globe, label: 'Language', sub: app.language, onPress: () => open('language') },
    { icon: KeyRound, label: 'Change password', sub: 'Account security', onPress: () => open('password') },
    { icon: Bug, label: 'Error log', sub: 'Share problems with the BOOKLIT team', onPress: () => router.push('/error-log') },
    { icon: LifeBuoy, label: 'Help & support', sub: 'Talk to the BOOKLIT team', onPress: () => open('help') },
    { icon: Info, label: 'About Booklit', sub: 'Version 1.0.0', onPress: () => open('about') },
  ];

  const logOut = () => {
    const doIt = () => {
      app.logOut();
      router.replace('/welcome');
    };
    if (Platform.OS === 'web') return doIt();
    Alert.alert(tt('Log out'), tt('Your progress on this device will be cleared.'), [
      { text: tt('Cancel'), style: 'cancel' },
      { text: tt('Log out'), style: 'destructive', onPress: doIt },
    ]);
  };

  return (
    <Page>
      <TabHeader title="Profile" />

      {/* Identity + key stats */}
      <View style={styles.idRow}>
        <Card style={styles.idCard} onPress={() => open('edit-profile')}>
          <View style={[styles.avatar, { backgroundColor: p.primarySoft }]}>
            <Txt weight="semibold" size={24} color={p.primary}>{initials(prof.name)}</Txt>
          </View>
          <Txt weight="semibold" size={Type.h2} style={{ marginTop: 12 }} numberOfLines={1}>{prof.name}</Txt>
          <View style={[styles.stage, { backgroundColor: p.primarySoft }]}>
            <Icon as={ShieldCheck} size={12} color={p.primary} />
            <Txt weight="medium" size={Type.tiny} color={p.primary}>{stageName(prof.stageId)}</Txt>
          </View>
          <Txt faint size={Type.tiny} style={{ marginTop: 8 }}>Keep learning, keep growing.</Txt>
        </Card>
        <View style={{ flex: 1, gap: 10 }}>
          <StatBox icon={Clock} value={formatStudyTime(app.studySeconds)} label="Study time" />
          <StatBox icon={ListChecks} value={`${app.quiz.answered}`} label="Questions" />
        </View>
      </View>

      <Card style={styles.triple}>
        <Triple icon={Target} value={`${accuracy}%`} label="Accuracy" />
        <View style={[styles.div, { backgroundColor: p.border }]} />
        <Triple icon={BookOpen} value={`${booklets}`} label="Booklets" />
        <View style={[styles.div, { backgroundColor: p.border }]} />
        <Triple icon={Flame} value={`${app.streak}`} label="Day streak" />
      </Card>

      <View style={{ height: 18 }} />
      <InstallApp compact />
      <View style={{ gap: 8 }}>
        {rows.map((r) => (
          <Card key={r.label} style={styles.row} onPress={r.onPress}>
            <View style={[styles.rowIcon, { backgroundColor: p.primarySoft }]}>
              <Icon as={r.icon} size={17} color={p.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Txt weight="medium">{r.label}</Txt>
              <Txt faint size={Type.tiny} numberOfLines={1}>{r.sub}</Txt>
            </View>
            <Icon as={ChevronsRight} size={18} color={p.textFaint} />
          </Card>
        ))}
      </View>

      <Pressable onPress={logOut} style={({ pressed }) => [styles.logout, { backgroundColor: p.dangerSoft }, pressed && { opacity: 0.8 }]}>
        <Icon as={LogOut} size={18} color="#E5484D" />
        <Txt weight="semibold" color="#E5484D">Log out</Txt>
      </Pressable>
    </Page>
  );
}

function StatBox({ icon, value, label }: { icon: LucideIcon; value: string; label: string }) {
  const { palette: p } = useApp();
  return (
    <Card style={styles.statBox}>
      <View style={[styles.statIcon, { backgroundColor: p.primarySoft }]}>
        <Icon as={icon} size={15} color={p.primary} />
      </View>
      <View>
        <Txt weight="semibold" size={Type.h2}>{value}</Txt>
        <Txt muted size={Type.tiny}>{label}</Txt>
      </View>
    </Card>
  );
}

function Triple({ icon, value, label }: { icon: LucideIcon; value: string; label: string }) {
  const { palette: p } = useApp();
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 4 }}>
      <View style={[styles.statIcon, { backgroundColor: p.primarySoft }]}>
        <Icon as={icon} size={15} color={p.primary} />
      </View>
      <Txt muted size={Type.tiny}>{label}</Txt>
      <Txt weight="semibold" size={Type.h2}>{value}</Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  idRow: { flexDirection: 'row', gap: 10, marginTop: 20 },
  idCard: { flex: 1.25, padding: 16, borderRadius: 24 },
  avatar: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  stage: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, marginTop: 6 },
  statBox: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 22 },
  statIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  triple: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, marginTop: 10, borderRadius: 24 },
  div: { width: StyleSheet.hairlineWidth, height: 46 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 20 },
  rowIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  logout: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 999, paddingVertical: 15, marginTop: 18 },
});
