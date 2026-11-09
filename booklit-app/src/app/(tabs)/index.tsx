import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Bell, BookOpen, Bot, ChartColumn, LibraryBig, Play, Search, Sparkles, Wand2 } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { InstallApp } from '@/components/install-app';
import { ArrowCircle, Card, CircleButton, Heading, Icon, Page, ProgressBar, SectionTitle, SubjectThumb, Txt } from '@/components/ui';
import { Type } from '@/constants/theme';
import { booklets, getBooklet, getSubject, getTopic, topicsOf } from '@/data/content';
import { bookletProgress, greeting, initials, isSubjectUnlocked, startedBooklets } from '@/lib/progress';
import { useApp } from '@/store/app-store';

export default function Home() {
  const app = useApp();
  const { profile, lastRead, completedTopics, topicProgress, palette: p } = app;
  const first = profile?.name.split(' ')[0] ?? '';

  const lastTopic = lastRead ? getTopic(lastRead.topicId) : undefined;
  const lastBooklet = lastTopic ? getBooklet(lastTopic.bookletId) : undefined;
  const lastSubject = lastBooklet ? getSubject(lastBooklet.subjectId) : undefined;
  const lastPct = lastBooklet ? bookletProgress(lastBooklet.id, completedTopics, topicProgress).pct : 0;

  const started = startedBooklets(
    [...new Set(booklets.map((b) => b.subjectId))],
    completedTopics,
    topicProgress,
  );
  const suggested = booklets.filter((b) => {
    const s = getSubject(b.subjectId);
    return s && s.id !== 'uploads' && isSubjectUnlocked(s.id, app.unlockedSubjects) && s.stageId === profile?.stageId && b.order === 1;
  });
  const list = (started.length ? started : suggested).slice(0, 4);

  const nextTopicOf = (bookletId: string) => {
    const ts = topicsOf(bookletId);
    return ts.find((t) => !completedTopics.includes(t.id)) ?? ts[0];
  };
  const openReader = (topicId: string) => router.push({ pathname: '/reader/[topicId]', params: { topicId } });

  return (
    <Page>
      {/* Top row */}
      <View style={styles.top}>
        <Pressable onPress={() => router.push('/profile')} style={[styles.hello, { backgroundColor: p.surface, borderColor: p.border }]}>
          <View style={[styles.avatar, { backgroundColor: p.primarySoft }]}>
            <Txt weight="semibold" size={12} color={p.primary}>
              {initials(profile?.name ?? '')}
            </Txt>
          </View>
          <Txt weight="medium" size={Type.small}>
            {greeting()}, {first}
          </Txt>
        </Pressable>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <CircleButton icon={Sparkles} variant="primary" label="Ask AI" onPress={() => lastTopic ? router.push({ pathname: '/ai/[topicId]', params: { topicId: lastTopic.id } }) : router.push('/library')} />
          <CircleButton icon={Bell} label="Notifications" badge={app.notifications} onPress={() => router.push('/notifications')} />
        </View>
      </View>

      <View style={{ marginTop: 22 }}>
        <Heading light="Ready to" strong="study today?" />
      </View>

      {/* Search + quick actions */}
      <View style={styles.actions}>
        <Pressable onPress={() => router.push('/search')} style={[styles.search, { borderColor: p.border, backgroundColor: p.surface }]}>
          <Icon as={Search} size={17} color={p.textMuted} />
          <Txt muted size={Type.small}>Search booklets</Txt>
        </Pressable>
        {app.canUpload ? <CircleButton icon={Wand2} label="BOOKLIT Studio" onPress={() => router.push('/studio')} /> : null}
        <CircleButton icon={LibraryBig} label="Library" onPress={() => router.push('/library')} />
      </View>

      <InstallApp />

      {/* Continue card */}
      <LinearGradient colors={['#5B4CF0', '#493BEA', '#3A2FD0']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View style={styles.heroRow}>
          <View style={styles.heroIcon}>
            <Icon as={BookOpen} size={20} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Txt weight="semibold" size={Type.h2} color="#fff" numberOfLines={1}>
              {lastTopic ? lastBooklet?.title : 'Start your first booklet'}
            </Txt>
            <Txt size={Type.small} color="rgba(255,255,255,0.75)" numberOfLines={1}>
              {lastTopic ? `${lastSubject?.name} · ${lastTopic.title}` : 'Pick a subject from the library'}
            </Txt>
          </View>
        </View>
        {lastTopic ? (
          <View style={styles.heroProgress}>
            <View style={{ flex: 1 }}>
              <ProgressBar value={lastPct} color="#fff" track="rgba(255,255,255,0.22)" />
            </View>
            <Txt weight="medium" size={Type.tiny} color="rgba(255,255,255,0.85)">
              {Math.round(lastPct * 100)}%
            </Txt>
          </View>
        ) : null}
        <Pressable
          onPress={() => (lastTopic ? openReader(lastTopic.id) : router.push('/library'))}
          style={({ pressed }) => [styles.heroBtn, pressed && { opacity: 0.9 }]}>
          <Icon as={Play} size={15} color="#17172B" />
          <Txt weight="semibold" size={Type.small} color="#17172B">
            {lastTopic ? 'Continue reading' : 'Open library'}
          </Txt>
        </Pressable>
      </LinearGradient>

      {/* Tiles */}
      <View style={styles.tiles}>
        <Tile icon={LibraryBig} label="Library" onPress={() => router.push('/library')} />
        <Tile icon={Bot} label="Ask AI" active onPress={() => (lastTopic ? router.push({ pathname: '/ai/[topicId]', params: { topicId: lastTopic.id } }) : router.push('/library'))} />
        {app.canUpload ? (
          <Tile icon={Wand2} label="Studio" onPress={() => router.push('/studio')} />
        ) : (
          <Tile icon={ChartColumn} label="Progress" onPress={() => router.push('/progress')} />
        )}
      </View>

      <SectionTitle title={started.length ? 'Continue studying' : 'Suggested for you'} action="View all" onAction={() => router.push('/progress')} />
      <View style={{ gap: 10 }}>
        {list.map((b) => {
          const pr = bookletProgress(b.id, completedTopics, topicProgress);
          const s = getSubject(b.subjectId)!;
          const t = nextTopicOf(b.id);
          return (
            <Card key={b.id} style={styles.row} onPress={() => t && openReader(t.id)}>
              <SubjectThumb subjectId={s.id} size={48} radius={14} />
              <View style={{ flex: 1, gap: 3 }}>
                <Txt weight="semibold" numberOfLines={1}>{b.title}</Txt>
                <Txt muted size={Type.tiny} numberOfLines={1}>
                  {s.name} · {pr.done}/{pr.total} topics
                </Txt>
                <View style={{ marginTop: 4, width: '80%' }}>
                  <ProgressBar value={pr.pct} />
                </View>
              </View>
              <ArrowCircle onPress={() => t && openReader(t.id)} />
            </Card>
          );
        })}
      </View>
    </Page>
  );
}

function Tile({ icon, label, onPress, active }: { icon: Parameters<typeof Icon>[0]['as']; label: string; onPress: () => void; active?: boolean }) {
  const { palette: p } = useApp();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.tile, { backgroundColor: active ? p.primarySoft : p.surface }, pressed && { opacity: 0.85 }]}>
      <View style={[styles.tileIcon, { backgroundColor: active ? p.surface : p.primarySoft }]}>
        <Icon as={icon} size={19} color={p.primary} />
      </View>
      <Txt weight="medium" size={Type.small}>{label}</Txt>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hello: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 5, paddingRight: 14, paddingVertical: 5, borderRadius: 999, borderWidth: 1 },
  avatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 18 },
  search: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, paddingHorizontal: 16, borderRadius: 22, borderWidth: 1 },
  hero: { borderRadius: 24, padding: 18, marginTop: 20 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  heroProgress: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16 },
  heroBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#fff', borderRadius: 999, paddingVertical: 11, marginTop: 16 },
  tiles: { flexDirection: 'row', gap: 10, marginTop: 16, marginBottom: 24 },
  tile: { flex: 1, alignItems: 'center', gap: 10, paddingVertical: 16, borderRadius: 20 },
  tileIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 20 },
});
