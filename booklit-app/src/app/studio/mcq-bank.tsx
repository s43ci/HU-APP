import type { DocumentPickerAsset } from 'expo-document-picker';
import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import { Check, ChevronDown, ChevronRight, CircleAlert, FileUp, Folder, ListChecks, ShieldCheck, Sparkles, Trash2 } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Sheet, SheetItem } from '@/components/editor/sheet';
import { Button, Chip, EmptyState, Heading, Icon, SubjectThumb, TopBar, Txt } from '@/components/ui';
import { Brand, Type } from '@/constants/theme';
import { bookletsOf, getBooklet, isStudioBooklet, subjects, topicsOf } from '@/data/content';
import type { Mcq } from '@/data/types';
import { newId } from '@/lib/editor';
import { ACCEPTED_TYPES, importMcqBank, MAX_UPLOAD_MB, type BankQuestion } from '@/lib/import';
import { useApp } from '@/store/app-store';

type Item = BankQuestion & { key: string };

export default function McqBank() {
  const app = useApp();
  const p = app.palette;
  const insets = useSafeAreaInsets();
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [bookletId, setBookletId] = useState<string | null>(null);
  const [source, setSource] = useState<'ministry' | 'instructor'>('ministry');
  const [file, setFile] = useState<DocumentPickerAsset | null>(null);
  const [phase, setPhase] = useState<'setup' | 'working' | 'review' | 'saved'>('setup');
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [moving, setMoving] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState(0);

  const topics = useMemo(() => (bookletId ? topicsOf(bookletId) : []), [bookletId]);

  if (!app.canUpload) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg }}>
        <TopBar title="Question bank" />
        <EmptyState icon={ShieldCheck} title="For the BOOKLIT team" text="Question banks are added by the admin in BOOKLIT Studio." />
      </View>
    );
  }

  const pick = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: ACCEPTED_TYPES, copyToCacheDirectory: true });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    if (a.size && a.size > MAX_UPLOAD_MB * 1024 * 1024) return setError(`The file is larger than ${MAX_UPLOAD_MB} MB. Split it into parts.`);
    setError(null);
    setFile(a);
  };

  const run = async () => {
    if (!file || !bookletId) return;
    setPhase('working');
    setError(null);
    try {
      const out = await importMcqBank(file, topics.map((t) => ({ id: t.id, title: t.title })));
      setItems(out.questions.map((q, i) => ({ ...q, key: `q${i}` })));
      setPhase('review');
      if (out.truncated) setError('The file was very long, so the last questions may be missing. Upload the rest as a second file.');
    } catch (e) {
      setError((e as Error).message);
      setPhase('setup');
    }
  };

  const save = () => {
    if (!bookletId) return;
    const assigned = items.filter((q) => q.topicId);
    const mcqs: Mcq[] = assigned.map((q) => ({
      id: newId(`${q.topicId}--bank-`),
      topicId: q.topicId,
      source,
      question: q.question,
      options: q.options,
      answerIndex: q.answerIndex,
      explanation: q.explanation,
    }));
    if (isStudioBooklet(bookletId)) {
      const b = app.importedBooklets.find((x) => x.id === bookletId);
      if (b) app.updateImported({ ...b, mcqs: [...b.mcqs, ...mcqs] });
    } else {
      app.addExtraMcqs(mcqs);
    }
    setSavedCount(mcqs.length);
    setPhase('saved');
  };

  const update = (key: string, patch: Partial<Item>) => setItems((list) => list.map((q) => (q.key === key ? { ...q, ...patch } : q)));
  const groups = [...topics.map((t) => ({ id: t.id, title: `${t.order}. ${t.title}` })), { id: '', title: 'Not sorted' }]
    .map((g) => ({ ...g, list: items.filter((q) => q.topicId === g.id) }))
    .filter((g) => g.list.length);
  const aiAnswers = items.filter((q) => q.answerFromAi).length;
  const unassigned = items.filter((q) => !q.topicId).length;
  const booklet = bookletId ? getBooklet(bookletId) : null;

  if (phase === 'saved') {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg }}>
        <TopBar title="Question bank" />
        <EmptyState
          icon={Check}
          title={`${savedCount} questions added`}
          text={`They now appear under ${source === 'ministry' ? 'Ministry' : 'Instructor'} MCQs in each topic of ${booklet?.title}.`}
          action="Open the booklet"
          onAction={() => booklet && router.replace({ pathname: '/subject/[id]', params: { id: booklet.subjectId, booklet: booklet.id } })}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <TopBar title="Question bank" />
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 4, paddingBottom: insets.bottom + 120 }}>
        {phase !== 'review' ? (
          <>
            <Heading light="Upload a question bank," strong="AI sorts it by topic." size={24} />
            <Txt muted size={Type.small} style={{ marginTop: 8, lineHeight: 20 }}>
              Every question is copied exactly. Answers come from the file&apos;s answer key; missing answers are worked out by AI and flagged for you to check.
            </Txt>

            <Label n={1} text="Which booklet?" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ gap: 10, paddingHorizontal: 20 }}>
              {subjects.filter((s) => bookletsOf(s.id).length).map((s) => {
                const on = subjectId === s.id;
                return (
                  <Pressable key={s.id} onPress={() => { setSubjectId(s.id); setBookletId(null); }} style={[styles.subject, { backgroundColor: p.surface, borderColor: on ? p.primary : 'transparent' }]}>
                    <SubjectThumb subjectId={s.id} size={56} radius={14} />
                    <Txt weight={on ? 'semibold' : 'medium'} size={Type.tiny} numberOfLines={2} style={{ textAlign: 'center' }} color={on ? p.primary : p.text}>{s.name}</Txt>
                  </Pressable>
                );
              })}
            </ScrollView>
            {subjectId ? (
              <View style={{ gap: 8, marginTop: 12 }}>
                {bookletsOf(subjectId).map((b) => {
                  const on = bookletId === b.id;
                  return (
                    <Pressable key={b.id} onPress={() => setBookletId(b.id)} style={[styles.booklet, { backgroundColor: p.surface, borderColor: on ? p.primary : 'transparent' }]}>
                      <Icon as={Folder} size={18} color={on ? p.primary : p.icon} />
                      <Txt weight={on ? 'semibold' : 'medium'} style={{ flex: 1 }}>{b.title}</Txt>
                      <Txt faint size={Type.tiny}>{topicsOf(b.id).length} topics</Txt>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            <Label n={2} text="What kind of questions?" />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Chip label="Ministry" active={source === 'ministry'} onPress={() => setSource('ministry')} />
              <Chip label="Instructor" active={source === 'instructor'} onPress={() => setSource('instructor')} />
            </View>

            <Label n={3} text="The question file" />
            {phase === 'working' ? (
              <View style={[styles.zone, { backgroundColor: p.surface }]}>
                <ActivityIndicator color={p.primary} />
                <Txt weight="semibold" style={{ marginTop: 12 }}>Reading and sorting the questions…</Txt>
                <Txt faint size={Type.tiny} style={{ marginTop: 4 }}>{file?.name}</Txt>
              </View>
            ) : (
              <Pressable onPress={pick} style={[styles.zone, styles.dashed, { borderColor: p.primary + '55', backgroundColor: p.surface }]}>
                <Icon as={FileUp} size={22} color={p.primary} />
                <Txt weight="semibold" style={{ marginTop: 8 }} numberOfLines={1}>{file ? file.name : 'Choose a file'}</Txt>
                <Txt faint size={Type.tiny}>PDF, Word, image or text · up to {MAX_UPLOAD_MB} MB</Txt>
              </Pressable>
            )}
          </>
        ) : (
          <>
            <Heading light="Check the" strong="sorted questions." size={24} />
            <View style={styles.stats}>
              <Stat label="Questions" value={items.length} />
              <Stat label="Topics" value={groups.filter((g) => g.id).length} />
              <Stat label="AI answers" value={aiAnswers} warn={aiAnswers > 0} />
              <Stat label="Not sorted" value={unassigned} warn={unassigned > 0} />
            </View>
            {unassigned ? (
              <Txt muted size={Type.tiny} style={{ marginBottom: 8 }}>Questions under &quot;Not sorted&quot; are skipped unless you give them a topic.</Txt>
            ) : null}
            {groups.map((g) => (
              <View key={g.id || 'none'} style={{ marginTop: 14 }}>
                <View style={styles.groupHead}>
                  <Txt weight="semibold" style={{ flex: 1 }} color={g.id ? p.text : '#D97706'}>{g.title}</Txt>
                  <Txt faint size={Type.tiny}>{g.list.length}</Txt>
                </View>
                <View style={{ gap: 6 }}>
                  {g.list.map((q) => {
                    const expanded = open === q.key;
                    return (
                      <View key={q.key} style={[styles.q, { backgroundColor: p.surface }]}>
                        <Pressable onPress={() => setOpen(expanded ? null : q.key)} style={{ flexDirection: 'row', gap: 8 }}>
                          <Txt size={Type.small} weight="medium" style={{ flex: 1, lineHeight: 19 }} numberOfLines={expanded ? undefined : 2}>{q.question}</Txt>
                          {q.answerFromAi ? <View style={[styles.badge, { backgroundColor: '#FEF3C7' }]}><Txt size={10} weight="semibold" color="#B45309">AI answer</Txt></View> : null}
                          <Icon as={expanded ? ChevronDown : ChevronRight} size={16} color={p.textFaint} />
                        </Pressable>
                        {expanded ? (
                          <View style={{ marginTop: 8, gap: 6 }}>
                            {q.options.map((o, i) => {
                              const right = q.answerIndex === i;
                              return (
                                <Pressable key={i} onPress={() => update(q.key, { answerIndex: i, answerFromAi: false })} style={[styles.opt, { borderColor: right ? Brand.success : p.border, backgroundColor: right ? Brand.success + '14' : 'transparent' }]}>
                                  <Txt size={Type.tiny} weight="semibold" color={right ? Brand.success : p.textMuted}>{String.fromCharCode(65 + i)}</Txt>
                                  <Txt size={Type.small} style={{ flex: 1 }}>{o}</Txt>
                                  {right ? <Icon as={Check} size={14} color={Brand.success} /> : null}
                                </Pressable>
                              );
                            })}
                            {q.explanation ? <Txt muted size={Type.tiny} style={{ lineHeight: 17 }}>{q.explanation}</Txt> : null}
                            <Txt faint size={10}>Tap an option to set the correct answer.</Txt>
                            <View style={{ flexDirection: 'row', gap: 8 }}>
                              <Button label="Move to topic" icon={ListChecks} variant="soft" style={{ flex: 1, paddingVertical: 10 }} onPress={() => setMoving(q.key)} />
                              <Button label="Delete" icon={Trash2} variant="danger" style={{ paddingVertical: 10 }} onPress={() => setItems((l) => l.filter((x) => x.key !== q.key))} />
                            </View>
                          </View>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              </View>
            ))}
          </>
        )}

        {error ? (
          <View style={[styles.error, { backgroundColor: p.dangerSoft }]}>
            <Icon as={CircleAlert} size={17} color="#E5484D" />
            <Txt size={Type.small} color="#B4363A" style={{ flex: 1, lineHeight: 19 }}>{error}</Txt>
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12, backgroundColor: p.bg }]}>
        {phase === 'review' ? (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button label="Start over" variant="outline" style={{ flex: 1 }} onPress={() => { setItems([]); setPhase('setup'); }} />
            <Button label={`Save ${items.length - unassigned} questions`} icon={Check} variant="primary" style={{ flex: 1.5 }} disabled={items.length - unassigned === 0} onPress={save} />
          </View>
        ) : phase === 'setup' ? (
          <Button label={!bookletId ? 'Choose a booklet' : !file ? 'Choose a file' : 'Extract & sort questions'} icon={Sparkles} variant="primary" disabled={!bookletId || !file} onPress={run} />
        ) : null}
      </View>

      <Sheet visible={!!moving} onClose={() => setMoving(null)} title="Move to topic">
        {topics.map((t) => (
          <SheetItem key={t.id} icon={ListChecks} label={`${t.order}. ${t.title}`} onPress={() => { if (moving) update(moving, { topicId: t.id }); setMoving(null); }} />
        ))}
      </Sheet>
    </View>
  );
}

function Label({ n, text }: { n: number; text: string }) {
  const { palette: p } = useApp();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 24, marginBottom: 10 }}>
      <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: p.ink, alignItems: 'center', justifyContent: 'center' }}>
        <Txt weight="semibold" size={11} color={p.onInk}>{n}</Txt>
      </View>
      <Txt weight="semibold">{text}</Txt>
    </View>
  );
}

function Stat({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  const { palette: p } = useApp();
  return (
    <View style={[styles.stat, { backgroundColor: p.surface }]}>
      <Txt weight="semibold" size={Type.h2} color={warn ? '#D97706' : p.text}>{value}</Txt>
      <Txt muted size={10.5}>{label}</Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  subject: { width: 116, alignItems: 'center', gap: 6, padding: 8, borderRadius: 18, borderWidth: 1.5 },
  booklet: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 16, borderWidth: 1.5 },
  zone: { borderRadius: 22, padding: 22, alignItems: 'center' },
  dashed: { borderWidth: 1.5, borderStyle: 'dashed' },
  stats: { flexDirection: 'row', gap: 8, marginTop: 16, marginBottom: 8 },
  stat: { flex: 1, borderRadius: 16, padding: 10, alignItems: 'center' },
  groupHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  q: { borderRadius: 16, padding: 12 },
  badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, alignSelf: 'flex-start' },
  opt: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, padding: 9 },
  error: { flexDirection: 'row', gap: 8, padding: 12, borderRadius: 16, marginTop: 16 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 10 },
});
