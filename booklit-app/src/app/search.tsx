import { router } from 'expo-router';
import { ArrowLeft, CircleHelp, Search as SearchIcon, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CircleButton, Icon, SubjectThumb, Txt } from '@/components/ui';
import { Font, Type } from '@/constants/theme';
import { booklets, getBooklet, getSubject, getTopic, mcqs, subjects, topics } from '@/data/content';
import { isSubjectUnlocked } from '@/lib/progress';
import { useApp } from '@/store/app-store';
import { t as tt } from '@/i18n';

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
    // contentVersion re-runs the search when uploads change
  }, [s, app.contentVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  const unlocked = (subjectId: string) => isSubjectUnlocked(subjectId, app.unlockedSubjects);
  const total = results ? results.subjects.length + results.booklets.length + results.topics.length + results.mcqs.length : 0;

  return (
    <View style={{ flex: 1, backgroundColor: p.bg, paddingTop: insets.top + 8 }}>
      <View style={styles.top}>
        <CircleButton icon={ArrowLeft} label="Back" onPress={() => router.back()} />
        <View style={[styles.box, { backgroundColor: p.surface, borderColor: p.border }]}>
          <Icon as={SearchIcon} size={17} color={p.textMuted} />
          <TextInput
            autoFocus
            value={q}
            onChangeText={setQ}
            placeholder={tt('Booklets, topics or MCQs')}
            placeholderTextColor={p.textFaint}
            style={{ flex: 1, color: p.text, fontFamily: Font.regular, fontSize: 14.5, paddingVertical: 11 }}
          />
          {q ? (
            <Pressable onPress={() => setQ('')} hitSlop={8}>
              <Icon as={X} size={16} color={p.textMuted} />
            </Pressable>
          ) : null}
        </View>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        {!results ? (
          <Txt faint size={Type.small} style={{ textAlign: 'center', marginTop: 40 }}>Type at least 2 letters.</Txt>
        ) : total === 0 ? (
          <Txt faint size={Type.small} style={{ textAlign: 'center', marginTop: 40 }}>No results for “{q}”.</Txt>
        ) : null}
        {results?.subjects.length ? <Head label="Subjects" /> : null}
        {results?.subjects.map((x) => (
          <Row key={x.id} subjectId={x.id} title={x.name} sub={unlocked(x.id) ? 'Subject' : 'Subject · Locked'}
            onPress={() => (unlocked(x.id) ? router.push({ pathname: '/subject/[id]', params: { id: x.id } }) : router.push('/library'))} />
        ))}
        {results?.booklets.length ? <Head label="Booklets" /> : null}
        {results?.booklets.map((b) => {
          const sub = getSubject(b.subjectId)!;
          return <Row key={b.id} subjectId={sub.id} title={b.title} sub={sub.name}
            onPress={() => (unlocked(sub.id) ? router.push({ pathname: '/subject/[id]', params: { id: sub.id, booklet: b.id } }) : router.push('/library'))} />;
        })}
        {results?.topics.length ? <Head label="Topics" /> : null}
        {results?.topics.map((t) => {
          const b = getBooklet(t.bookletId)!;
          const sub = getSubject(b.subjectId)!;
          return <Row key={t.id} subjectId={sub.id} title={t.title} sub={`${sub.name} · ${b.title}${unlocked(sub.id) ? '' : ' · Locked'}`}
            onPress={() => (unlocked(sub.id) ? router.push({ pathname: '/reader/[topicId]', params: { topicId: t.id } }) : router.push('/library'))} />;
        })}
        {results?.mcqs.length ? <Head label="MCQs" /> : null}
        {results?.mcqs.map((m) => {
          const t = getTopic(m.topicId)!;
          const sub = getSubject(getBooklet(t.bookletId)!.subjectId)!;
          const mode = m.source === 'generated' ? 'quiz' : m.source;
          return <Row key={m.id} icon title={m.question} sub={t.title}
            onPress={() => (unlocked(sub.id) ? router.push({ pathname: '/quiz/[topicId]', params: { topicId: t.id, mode } }) : router.push('/library'))} />;
        })}
      </ScrollView>
    </View>
  );
}

function Row({ subjectId, icon, title, sub, onPress }: { subjectId?: string; icon?: boolean; title: string; sub: string; onPress: () => void }) {
  const { palette: p } = useApp();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, { borderBottomColor: p.border }, pressed && { opacity: 0.6 }]}>
      {icon || !subjectId ? (
        <View style={[styles.qIcon, { backgroundColor: p.primarySoft }]}><Icon as={CircleHelp} size={17} color={p.primary} /></View>
      ) : (
        <SubjectThumb subjectId={subjectId} size={38} radius={12} />
      )}
      <View style={{ flex: 1 }}>
        <Txt weight="medium" numberOfLines={2}>{title}</Txt>
        <Txt faint size={Type.tiny} numberOfLines={1}>{sub}</Txt>
      </View>
    </Pressable>
  );
}

function Head({ label }: { label: string }) {
  return <Txt weight="medium" muted size={Type.tiny} style={{ marginTop: 18, marginBottom: 4, letterSpacing: 1 }}>{label.toUpperCase()}</Txt>;
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingBottom: 6 },
  box: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 999, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  qIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
});
