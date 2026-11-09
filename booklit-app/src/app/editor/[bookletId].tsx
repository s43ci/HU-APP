import { router, useLocalSearchParams } from 'expo-router';
import { ArrowDown, ArrowUp, ChevronRight, Eye, FileText, Plus, Sparkles, Trash2, X } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Card, CircleButton, EmptyState, Icon, TopBar, Txt } from '@/components/ui';
import { Font, Type } from '@/constants/theme';
import { UPLOADS_SUBJECT } from '@/data/content';
import type { ImportedBooklet, Topic } from '@/data/types';
import { generateMcqs, newId } from '@/lib/editor';
import { unpublishBooklet } from '@/lib/publish';
import { logError } from '@/lib/log';
import { PublishCard } from '@/components/publish-card';
import { useApp } from '@/store/app-store';
import { t as tt } from '@/i18n';

export default function BookletEditor() {
  const { bookletId } = useLocalSearchParams<{ bookletId: string }>();
  const app = useApp();
  const p = app.palette;
  const insets = useSafeAreaInsets();
  const booklet = app.findBooklet(bookletId);
  const [genState, setGenState] = useState<{ done: number; total: number } | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (!app.canEdit) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg }}>
        <TopBar title="Edit booklet" />
        <EmptyState icon={FileText} title="Editing is part of Premium" text="Upgrade to Premium to change the design of booklets." />
      </View>
    );
  }

  if (!booklet) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg }}>
        <TopBar title="Edit booklet" />
        <EmptyState icon={FileText} title="Booklet not found" text="It may have been deleted." />
      </View>
    );
  }

  const save = (b: ImportedBooklet) => app.updateImported(b);
  const renumber = (topics: Topic[]) => topics.map((t, i) => ({ ...t, order: i + 1 }));

  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= booklet.topics.length) return;
    const topics = [...booklet.topics];
    [topics[i], topics[j]] = [topics[j], topics[i]];
    save({ ...booklet, topics: renumber(topics) });
  };

  const removeTopic = (t: Topic) => {
    const doIt = () =>
      save({ ...booklet, topics: renumber(booklet.topics.filter((x) => x.id !== t.id)), mcqs: booklet.mcqs.filter((q) => q.topicId !== t.id) });
    if (Platform.OS === 'web') return doIt();
    Alert.alert(tt('Delete this topic?'), t.title, [
      { text: tt('Cancel'), style: 'cancel' },
      { text: tt('Delete'), style: 'destructive', onPress: doIt },
    ]);
  };

  const addTopic = () => {
    const t: Topic = { id: newId(`${booklet.id}--t`), bookletId: booklet.id, title: 'New topic', order: booklet.topics.length + 1, minutes: 1, blocks: [{ type: 'paragraph', text: '' }] };
    save({ ...booklet, topics: [...booklet.topics, t] });
    router.push({ pathname: '/editor/topic/[topicId]', params: { topicId: t.id } });
  };

  const deleteBooklet = () => {
    const doIt = async () => {
      // A published booklet is removed for students too.
      if (app.published.booklets.some((x) => x.id === booklet.id)) await unpublishBooklet(booklet.id).catch((e) => logError('publish', e, { step: 'unpublish' }));
      app.removeImported(booklet.id);
      void app.sync();
      router.replace('/library');
    };
    if (Platform.OS === 'web') return void (window.confirm(tt('Delete this booklet?')) && doIt());
    Alert.alert(tt('Delete this booklet?'), tt('All its topics and questions will be removed.'), [
      { text: tt('Cancel'), style: 'cancel' },
      { text: tt('Delete'), style: 'destructive', onPress: () => void doIt() },
    ]);
  };

  /** Write 3 extra questions for every topic that has fewer than 3. */
  const generateAll = async () => {
    const targets = booklet.topics.filter((t) => booklet.mcqs.filter((q) => q.topicId === t.id).length < 3);
    if (!targets.length) return setMessage('Every topic already has at least 3 questions.');
    setGenState({ done: 0, total: targets.length });
    let mcqs = [...booklet.mcqs];
    let failed = 0;
    for (const [k, t] of targets.entries()) {
      try {
        const qs = await generateMcqs(t, mcqs.filter((q) => q.topicId === t.id), 3);
        mcqs = [...mcqs, ...qs];
      } catch (e) {
        failed++;
        logError('editor-mcq', e, { topic: t.id });
      }
      setGenState({ done: k + 1, total: targets.length });
    }
    save({ ...booklet, mcqs });
    setGenState(null);
    setMessage(failed ? `Done, but ${failed} topic(s) failed. See the error log.` : 'Questions added to every topic.');
  };

  const totalQ = booklet.mcqs.length;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: p.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <TopBar
        title="Edit booklet"
        right={
          <CircleButton
            icon={Eye}
            label="Preview"
            size={40}
            variant="ink"
            onPress={() => router.push({ pathname: '/subject/[id]', params: { id: booklet.subjectId ?? UPLOADS_SUBJECT.id, booklet: booklet.id } })}
          />
        }
      />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled">
        {booklet.subjectId && booklet.subjectId !== UPLOADS_SUBJECT.id ? <PublishCard booklet={booklet} /> : null}
        <Txt faint size={Type.tiny}>Booklet title</Txt>
        <TextInput
          value={booklet.title}
          onChangeText={(title) => save({ ...booklet, title })}
          placeholder={tt('Booklet title')}
          placeholderTextColor={p.textFaint}
          multiline
          style={[styles.title, { color: p.text, fontFamily: Font.semibold }]}
        />
        <Txt muted size={Type.tiny}>
          {booklet.fileName} · {booklet.language} · {booklet.topics.length} topics · {totalQ} questions
        </Txt>

        <Pressable onPress={generateAll} disabled={!!genState} style={({ pressed }) => [styles.gen, { backgroundColor: p.primarySoft }, pressed && { opacity: 0.85 }]}>
          {genState ? <ActivityIndicator color={p.primary} /> : <Icon as={Sparkles} size={18} color={p.primary} />}
          <View style={{ flex: 1 }}>
            <Txt weight="semibold" color={p.primary}>
              {genState ? `Writing questions… ${genState.done}/${genState.total}` : 'Fill in missing questions with AI'}
            </Txt>
            <Txt size={Type.tiny} muted>Adds 3 questions to every topic that has fewer than 3</Txt>
          </View>
        </Pressable>
        {message ? (
          <Pressable onPress={() => setMessage(null)} style={[styles.msg, { backgroundColor: p.surface }]}>
            <Txt size={Type.small} style={{ flex: 1 }}>{message}</Txt>
            <Icon as={X} size={15} color={p.textFaint} />
          </Pressable>
        ) : null}

        <Txt weight="semibold" size={Type.h2} style={{ marginTop: 22, marginBottom: 10 }}>Topics</Txt>
        <View style={{ gap: 8 }}>
          {booklet.topics.map((t, i) => {
            const q = booklet.mcqs.filter((x) => x.topicId === t.id).length;
            return (
              <Card key={t.id} style={styles.topic} onPress={() => router.push({ pathname: '/editor/topic/[topicId]', params: { topicId: t.id } })}>
                <View style={[styles.num, { backgroundColor: p.primarySoft }]}>
                  <Txt weight="medium" size={Type.tiny} color={p.primary}>{i + 1}</Txt>
                </View>
                <View style={{ flex: 1 }}>
                  <Txt weight="medium" numberOfLines={2}>{t.title || 'Untitled topic'}</Txt>
                  <Txt faint size={Type.tiny}>{t.blocks.length} blocks · {q} questions</Txt>
                </View>
                <Pressable hitSlop={6} disabled={i === 0} onPress={() => move(i, -1)} style={styles.tool} accessibilityLabel="Move up">
                  <Icon as={ArrowUp} size={16} color={i === 0 ? p.border : p.icon} />
                </Pressable>
                <Pressable hitSlop={6} disabled={i === booklet.topics.length - 1} onPress={() => move(i, 1)} style={styles.tool} accessibilityLabel="Move down">
                  <Icon as={ArrowDown} size={16} color={i === booklet.topics.length - 1 ? p.border : p.icon} />
                </Pressable>
                <Pressable hitSlop={6} onPress={() => removeTopic(t)} style={styles.tool} accessibilityLabel="Delete topic">
                  <Icon as={Trash2} size={16} color="#E5484D" />
                </Pressable>
                <Icon as={ChevronRight} size={16} color={p.textFaint} />
              </Card>
            );
          })}
        </View>
        <Button label="Add topic" icon={Plus} variant="outline" style={{ marginTop: 12 }} onPress={addTopic} />
        {app.canUpload ? <Button label="Delete booklet" icon={Trash2} variant="danger" style={{ marginTop: 28 }} onPress={deleteBooklet} /> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, lineHeight: 29, paddingVertical: 4 },
  gen: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 20, marginTop: 16 },
  msg: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 14, marginTop: 8 },
  topic: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 12, borderRadius: 18 },
  num: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 4 },
  tool: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
});
