import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, SubjectArt, Txt } from '@/components/ui';
import { Font } from '@/constants/theme';
import { booklets, getBooklet, getSubject, getTopic, mcqs, subjects, topics } from '@/data/content';
import { isSubjectUnlocked } from '@/lib/progress';
import { useApp } from '@/store/app-store';

export default function Search() {
  const app = useApp();
  const p = app.palette;
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState('');
  const s = q.trim().toLowerCase();

  const results = useMemo(() => {
    if (s.length < 2) return null;
    return {
      subjects: subjects.filter((x) => x.name.toLowerCase().includes(s)),
      booklets: booklets.filter((x) => x.title.toLowerCase().includes(s)).slice(0, 10),
      topics: topics.filter((x) => x.title.toLowerCase().includes(s)).slice(0, 15),
      mcqs: mcqs.filter((x) => x.question.toLowerCase().includes(s)).slice(0, 10),
    };
  }, [s]);

  const openSubject = (id: string, booklet?: string) =>
    isSubjectUnlocked(id, app.unlockedSubjects)
      ? router.push({ pathname: '/subject/[id]', params: booklet ? { id, booklet } : { id } })
      : router.push('/library');

  const Row = ({ icon, color, title, sub, onPress }: { icon: string; color: string; title: string; sub: string; onPress: () => void }) => (
    <Pressable onPress={onPress} style={[styles.row, { borderBottomColor: p.border }]}>
      <SubjectArt color={color} icon={icon} size={40} radius={11} />
      <View style={{ flex: 1 }}>
        <Txt weight="semibold" numberOfLines={2}>{title}</Txt>
        <Txt muted size={12.5} numberOfLines={1}>{sub}</Txt>
      </View>
      <Icon name="chevron-right" size={20} />
    </Pressable>
  );

  const total = results ? results.subjects.length + results.booklets.length + results.topics.length + results.mcqs.length : 0;

  return (
    <View style={{ flex: 1, backgroundColor: p.bg, paddingTop: insets.top + 8 }}>
      <View style={styles.top}>
        <View style={[styles.box, { backgroundColor: p.surface, borderColor: p.border }]}>
          <Icon name="magnify" />
          <TextInput
            autoFocus
            value={q}
            onChangeText={setQ}
            placeholder="Search booklets, topics, or MCQs..."
            placeholderTextColor={p.textMuted}
            style={{ flex: 1, color: p.text, fontFamily: Font.medium, fontSize: 15, paddingVertical: 12 }}
          />
          {q ? (
            <Pressable onPress={() => setQ('')} hitSlop={8}>
              <Icon name="close-circle" size={18} />
            </Pressable>
          ) : null}
        </View>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Txt weight="semibold" color={p.primary}>Cancel</Txt>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        {!results ? (
          <Txt muted style={{ textAlign: 'center', marginTop: 30 }}>Type at least 2 letters to search.</Txt>
        ) : total === 0 ? (
          <Txt muted style={{ textAlign: 'center', marginTop: 30 }}>No results for “{q}”.</Txt>
        ) : null}
        {results?.subjects.length ? <Head label="Subjects" /> : null}
        {results?.subjects.map((x) => (
          <Row key={x.id} icon={x.icon} color={x.color} title={x.name} sub={x.isFree || app.unlockedSubjects.includes(x.id) ? 'Subject' : 'Subject · Locked'} onPress={() => openSubject(x.id)} />
        ))}
        {results?.booklets.length ? <Head label="Booklets" /> : null}
        {results?.booklets.map((b) => {
          const sub = getSubject(b.subjectId)!;
          return <Row key={b.id} icon={sub.icon} color={sub.color} title={b.title} sub={sub.name} onPress={() => openSubject(sub.id, b.id)} />;
        })}
        {results?.topics.length ? <Head label="Topics" /> : null}
        {results?.topics.map((t) => {
          const b = getBooklet(t.bookletId)!;
          const sub = getSubject(b.subjectId)!;
          const open = isSubjectUnlocked(sub.id, app.unlockedSubjects);
          return (
            <Row key={t.id} icon={sub.icon} color={sub.color} title={t.title} sub={`${sub.name} · ${b.title}${open ? '' : ' · Locked'}`}
              onPress={() => (open ? router.push({ pathname: '/reader/[topicId]', params: { topicId: t.id } }) : router.push('/library'))} />
          );
        })}
        {results?.mcqs.length ? <Head label="MCQs" /> : null}
        {results?.mcqs.map((m) => {
          const t = getTopic(m.topicId)!;
          const sub = getSubject(getBooklet(t.bookletId)!.subjectId)!;
          const open = isSubjectUnlocked(sub.id, app.unlockedSubjects);
          return (
            <Row key={m.id} icon="help-circle-outline" color={sub.color} title={m.question} sub={`${m.source === 'ministry' ? 'Ministry' : 'Instructor'} · ${t.title}`}
              onPress={() => (open ? router.push({ pathname: '/quiz/[topicId]', params: { topicId: t.id, mode: m.source } }) : router.push('/library'))} />
          );
        })}
      </ScrollView>
    </View>
  );
}

function Head({ label }: { label: string }) {
  return <Txt weight="bold" muted size={13} style={{ marginTop: 16, marginBottom: 4, letterSpacing: 0.8 }}>{label.toUpperCase()}</Txt>;
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 },
  box: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
});
