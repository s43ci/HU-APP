import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Card, Icon, ProgressBar, SectionTitle, SubjectArt, Txt, shade } from '@/components/ui';
import { booklets, getBooklet, getSubject, getTopic, subjects, topicsOf } from '@/data/content';
import { bookletProgress, greeting, startedBooklets } from '@/lib/progress';
import { useApp } from '@/store/app-store';

export default function Home() {
  const { profile, lastRead, completedTopics, topicProgress, palette: p } = useApp();

  const lastTopic = lastRead ? getTopic(lastRead.topicId) : undefined;
  const lastBooklet = lastTopic ? getBooklet(lastTopic.bookletId) : undefined;
  const lastSubject = lastBooklet ? getSubject(lastBooklet.subjectId) : undefined;
  const lastPct = lastBooklet ? bookletProgress(lastBooklet.id, completedTopics, topicProgress).pct : 0;

  const started = startedBooklets(subjects.map((s) => s.id), completedTopics, topicProgress);
  const studying = (started.length ? started : suggested(profile?.stageId)).slice(0, 5);

  const firstTopic = (bookletId: string) => {
    const ts = topicsOf(bookletId);
    return ts.find((t) => !completedTopics.includes(t.id)) ?? ts[0];
  };

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Txt muted size={16}>
        {greeting()},
      </Txt>
      <Txt weight="extrabold" size={30} style={{ marginTop: 2, letterSpacing: -0.5 }}>
        {profile?.name}
      </Txt>

      <Pressable onPress={() => router.push('/search')} style={[styles.search, { backgroundColor: p.surface, borderColor: p.border }]}>
        <Icon name="magnify" size={22} />
        <Txt muted>Search for booklets, topics, or MCQs...</Txt>
      </Pressable>

      {/* Continue reading */}
      <Pressable
        onPress={() =>
          lastTopic
            ? router.push({ pathname: '/reader/[topicId]', params: { topicId: lastTopic.id } })
            : router.push('/library')
        }>
        <LinearGradient
          colors={lastSubject ? [shade(lastSubject.color, -0.35), lastSubject.color, shade(lastSubject.color, 0.25)] : ['#3B2C9E', '#493BEA', '#8C6CF5']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}>
          <MaterialCommunityIcons
            name={(lastSubject?.icon ?? 'book-open-page-variant-outline') as never}
            size={150}
            color="rgba(255,255,255,0.16)"
            style={styles.heroArt}
          />
          <Txt weight="semibold" size={12} color="rgba(255,255,255,0.8)" style={{ letterSpacing: 1.2 }}>
            {lastTopic ? 'CONTINUE READING' : 'START READING'}
          </Txt>
          <Txt weight="bold" size={21} color="#fff" style={{ marginTop: 8 }}>
            {lastSubject?.name ?? 'Pick your first booklet'}
          </Txt>
          <Txt weight="bold" size={21} color="#fff" numberOfLines={1}>
            {lastTopic ? lastBooklet?.title : 'Browse the library'}
          </Txt>
          {lastTopic ? (
            <View style={styles.heroProgress}>
              <View style={{ flex: 1 }}>
                <ProgressBar value={lastPct} color="#fff" track="rgba(255,255,255,0.25)" />
              </View>
              <Txt weight="semibold" size={13} color="#fff">
                {Math.round(lastPct * 100)}%
              </Txt>
            </View>
          ) : null}
          <View style={styles.heroBtn}>
            <MaterialCommunityIcons name="play" size={18} color={p.primary} />
            <Txt weight="semibold" color="#17172B">
              {lastTopic ? 'Continue' : 'Open Library'}
            </Txt>
          </View>
        </LinearGradient>
      </Pressable>

      {/* Shortcuts */}
      <View style={styles.shortcuts}>
        {[
          { label: 'All Booklets', icon: 'layers-outline', stage: 'all' },
          { label: 'Fifth Stage', icon: 'school-outline', stage: 'stage5' },
          { label: 'Fourth Stage', icon: 'book-open-variant', stage: 'stage4' },
          { label: 'Categories', icon: 'view-grid-outline', stage: 'all' },
        ].map((s) => (
          <Pressable
            key={s.label}
            onPress={() => router.push({ pathname: '/library', params: { stage: s.stage } })}
            style={({ pressed }) => [styles.shortcut, { backgroundColor: p.primarySoft, opacity: pressed ? 0.8 : 1 }]}>
            <Icon name={s.icon} size={26} color={p.primary} />
            <Txt weight="semibold" size={12} style={{ textAlign: 'center' }} numberOfLines={1}>
              {s.label}
            </Txt>
          </Pressable>
        ))}
      </View>

      <SectionTitle title={started.length ? 'Continue Studying' : 'Suggested for You'} action="View All" onAction={() => router.push('/progress')} />
      <Card style={{ paddingHorizontal: 14 }}>
        {studying.map((b, i) => {
          const s = getSubject(b.subjectId)!;
          const pr = bookletProgress(b.id, completedTopics, topicProgress);
          const t = firstTopic(b.id);
          return (
            <Pressable
              key={b.id}
              onPress={() => router.push({ pathname: '/reader/[topicId]', params: { topicId: t.id } })}
              style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: p.border }]}>
              <SubjectArt color={s.color} icon={s.icon} size={56} />
              <View style={{ flex: 1 }}>
                <Txt weight="bold" size={16} numberOfLines={1}>
                  {s.name}
                </Txt>
                <Txt muted size={13} numberOfLines={1}>
                  {b.title}
                </Txt>
              </View>
              <View style={{ width: 88, gap: 6 }}>
                <Txt weight="semibold" size={13}>
                  {Math.round(pr.pct * 100)}%
                </Txt>
                <ProgressBar value={pr.pct} />
              </View>
              <Icon name="chevron-right" />
            </Pressable>
          );
        })}
      </Card>
    </ScrollView>
  );
}

function suggested(stageId?: string) {
  return booklets.filter((b) => {
    const s = getSubject(b.subjectId);
    return s && s.isFree && (!stageId || s.stageId === stageId) && b.order === 1;
  });
}

const styles = StyleSheet.create({
  content: { padding: 18, paddingBottom: 32 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 13, marginTop: 16 },
  hero: { borderRadius: 24, padding: 20, marginTop: 18, overflow: 'hidden', minHeight: 190 },
  heroArt: { position: 'absolute', right: -12, bottom: -18 },
  heroProgress: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14, width: '70%' },
  heroBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: '#fff', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999, marginTop: 16 },
  shortcuts: { flexDirection: 'row', gap: 10, marginVertical: 20 },
  shortcut: { flex: 1, alignItems: 'center', gap: 8, paddingVertical: 16, borderRadius: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
});
