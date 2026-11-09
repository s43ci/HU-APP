import { router, useLocalSearchParams } from 'expo-router';
import {
  AlignLeft,
  Eye,
  Heading as HeadingIcon,
  Image as ImageIcon,
  Info,
  Languages,
  List,
  Plus,
  Sparkles,
  SpellCheck,
  Table,
  Trash2,
  Undo2,
  WandSparkles,
  type LucideIcon,
} from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BlockEditor } from '@/components/editor/block-editor';
import { McqEditor } from '@/components/editor/mcq-editor';
import { Sheet, SheetItem } from '@/components/editor/sheet';
import { Button, CircleButton, EmptyState, Icon, TopBar, Txt } from '@/components/ui';
import { Font, Type } from '@/constants/theme';
import type { ContentBlock, ImportedBooklet, Mcq, Topic } from '@/data/types';
import { aiEdit, blockToText, convertBlock, emptyBlock, generateMcqs, newId, pickImage, type AiAction } from '@/lib/editor';
import { logError } from '@/lib/log';
import { useApp } from '@/store/app-store';
import { t as tt } from '@/i18n';

type Draft = { topic: Topic; mcqs: Mcq[] };

const BLOCK_TYPES: { type: ContentBlock['type']; label: string; icon: LucideIcon; sub: string }[] = [
  { type: 'paragraph', label: 'Paragraph', icon: AlignLeft, sub: 'Running text' },
  { type: 'heading', label: 'Heading', icon: HeadingIcon, sub: 'Sub-title inside the topic' },
  { type: 'list', label: 'List', icon: List, sub: 'Bullet points' },
  { type: 'table', label: 'Table', icon: Table, sub: 'Rows and columns' },
  { type: 'callout', label: 'Note', icon: Info, sub: 'Key point, warning or tip box' },
  { type: 'image', label: 'Figure', icon: ImageIcon, sub: 'Image from your gallery with a caption' },
];

const AI_ACTIONS: { action: AiAction; label: string; sub: string; icon: LucideIcon }[] = [
  { action: 'fix', label: 'Fix & clean', sub: 'Spelling, grammar and broken lines', icon: SpellCheck },
  { action: 'simplify', label: 'Simplify', sub: 'Clearer words, same facts', icon: WandSparkles },
  { action: 'expand', label: 'Explain more', sub: 'Add textbook context', icon: Sparkles },
  { action: 'bullets', label: 'Turn into bullet points', sub: 'Converts the block to a list', icon: List },
  { action: 'note', label: 'Make a key-point note', sub: 'Converts the block to a note box', icon: Info },
  { action: 'translate', label: 'Translate (English ⇄ Arabic)', sub: 'Keeps medical terms in English', icon: Languages },
];

/** Timestamp helper kept outside the component (only used from event handlers). */
const clock = () => Date.now();

function wordsMinutes(t: Topic) {
  const words = t.blocks.reduce((n, b) => n + blockToText(b).split(/\s+/).filter(Boolean).length, 0);
  return Math.max(1, Math.round(words / 200));
}

export default function TopicEditor() {
  const { topicId } = useLocalSearchParams<{ topicId: string }>();
  const app = useApp();
  const p = app.palette;
  const insets = useSafeAreaInsets();
  const booklet = app.importedBooklets.find((b) => b.topics.some((t) => t.id === topicId));

  const [draft, setDraft] = useState<Draft | null>(() =>
    booklet ? { topic: booklet.topics.find((t) => t.id === topicId)!, mcqs: booklet.mcqs.filter((q) => q.topicId === topicId) } : null,
  );
  const [tab, setTab] = useState<'content' | 'questions'>('content');
  const [sheet, setSheet] = useState<null | { kind: 'insert'; at: number } | { kind: 'more'; index: number } | { kind: 'ai'; index: number }>(null);
  const [busyBlock, setBusyBlock] = useState<number | null>(null);
  const [genBusy, setGenBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [historyLen, setHistoryLen] = useState(0);

  const ref = useRef({ history: [] as Draft[], lastKey: '', lastAt: 0, timer: null as ReturnType<typeof setTimeout> | null, pending: null as Draft | null, booklet: booklet as ImportedBooklet | undefined, update: app.updateImported });

  useEffect(() => {
    ref.current.booklet = booklet;
    ref.current.update = app.updateImported;
  });

  const flush = () => {
    const r = ref.current;
    if (r.timer) clearTimeout(r.timer);
    r.timer = null;
    const d = r.pending;
    const b = r.booklet;
    if (!d || !b) return;
    r.pending = null;
    const topic = { ...d.topic, minutes: wordsMinutes(d.topic) };
    r.update({ ...b, topics: b.topics.map((t) => (t.id === topic.id ? topic : t)), mcqs: [...b.mcqs.filter((q) => q.topicId !== topic.id), ...d.mcqs] });
    setSavedAt(clock());
  };

  // Save whatever is pending when leaving the screen.
  useEffect(() => () => flush(), []);

  if (!app.canEdit) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg }}>
        <TopBar title="Edit topic" />
        <EmptyState icon={Info} title="Editing is part of Premium" text="Upgrade to Premium to change the design of booklets." />
      </View>
    );
  }

  if (!booklet || !draft) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg }}>
        <TopBar title="Edit topic" />
        <EmptyState icon={Info} title="Topic not found" text="Only booklets you uploaded or created can be edited." />
      </View>
    );
  }

  /** Apply a change. Typing in the same field is grouped into one undo step. */
  const commit = (next: Draft, key = 'x') => {
    const r = ref.current;
    const now = clock();
    if (key !== r.lastKey || now - r.lastAt > 1500) {
      r.history = [...r.history.slice(-49), draft];
      setHistoryLen(r.history.length);
    }
    r.lastKey = key;
    r.lastAt = now;
    setDraft(next);
    r.pending = next;
    if (r.timer) clearTimeout(r.timer);
    r.timer = setTimeout(flush, 600);
  };

  const undo = () => {
    const r = ref.current;
    const prev = r.history.pop();
    setHistoryLen(r.history.length);
    if (!prev) return;
    r.lastKey = '';
    setDraft(prev);
    r.pending = prev;
    flush();
  };

  const blocks = draft.topic.blocks;
  const setBlocks = (next: ContentBlock[], key?: string) => commit({ ...draft, topic: { ...draft.topic, blocks: next } }, key);
  const setBlock = (i: number, b: ContentBlock, key?: string) => setBlocks(blocks.map((x, k) => (k === i ? b : x)), key);
  const insertBlock = (at: number, b: ContentBlock) => setBlocks([...blocks.slice(0, at), b, ...blocks.slice(at)]);
  const moveBlock = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= blocks.length) return;
    const next = [...blocks];
    [next[i], next[j]] = [next[j], next[i]];
    setBlocks(next);
  };

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3500);
  };

  const runAi = async (i: number, action: AiAction) => {
    setSheet(null);
    const b = blocks[i];
    const text = blockToText(b).trim();
    if (!text) return flash('Write something in this block first.');
    setBusyBlock(i);
    try {
      const out = await aiEdit(action, text, draft.topic.title);
      let next: ContentBlock;
      if (action === 'bullets') next = { type: 'list', items: out.items ?? [] };
      else if (action === 'note') next = { type: 'callout', tone: 'key', title: 'Key point', text: out.text ?? '' };
      else if (b.type === 'list') next = { ...b, items: (out.text ?? '').split('\n').map((s) => s.replace(/^\s*[•\-*\d.)]+\s*/, '').trim()).filter(Boolean) };
      else if (b.type === 'heading' || b.type === 'paragraph' || b.type === 'callout') next = { ...b, text: out.text ?? '' };
      else next = b;
      setBlock(i, next);
      flash('Done. Tap Undo to go back.');
    } catch (e) {
      logError('editor-ai', e, { action });
      flash((e as Error).message);
    } finally {
      setBusyBlock(null);
    }
  };

  const addImage = async (i: number, source: 'library' | 'camera') => {
    try {
      const uri = await pickImage(source, booklet.id);
      if (!uri) return;
      const b = blocks[i];
      if (b.type === 'image') setBlock(i, { ...b, uri });
    } catch (e) {
      logError('editor-image', e);
      flash(source === 'camera' ? 'Could not open the camera. Check the permission in Settings.' : 'Could not open your photos. Check the permission in Settings.');
    }
  };

  const generate = async () => {
    setGenBusy(true);
    try {
      const qs = await generateMcqs(draft.topic, draft.mcqs, 5);
      commit({ ...draft, mcqs: [...draft.mcqs, ...qs] });
      flash(`${qs.length} questions added.`);
    } catch (e) {
      flash((e as Error).message);
    } finally {
      setGenBusy(false);
    }
  };

  const setMcq = (i: number, q: Mcq) => commit({ ...draft, mcqs: draft.mcqs.map((x, k) => (k === i ? q : x)) }, `q${i}`);

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: p.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <TopBar
        title="Edit topic"
        onBack={() => {
          flush();
          router.back();
        }}
        right={
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <CircleButton icon={Undo2} label="Undo" size={40} onPress={undo} variant={historyLen ? 'surface' : 'soft'} />
            <CircleButton
              icon={Eye}
              label="Preview"
              size={40}
              variant="ink"
              onPress={() => {
                flush();
                router.push({ pathname: '/reader/[topicId]', params: { topicId: draft.topic.id } });
              }}
            />
          </View>
        }
      />

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 120 }} keyboardShouldPersistTaps="handled">
        <Txt faint size={Type.tiny} numberOfLines={1}>
          {booklet.title} · {savedAt ? 'Saved' : 'Changes save automatically'}
        </Txt>
        <TextInput
          value={draft.topic.title}
          onChangeText={(title) => commit({ ...draft, topic: { ...draft.topic, title } }, 'title')}
          placeholder={tt('Topic title')}
          placeholderTextColor={p.textFaint}
          style={[styles.title, { color: p.text, fontFamily: Font.semibold }]}
          multiline
        />

        <View style={[styles.segment, { backgroundColor: p.surface }]}>
          {(['content', 'questions'] as const).map((k) => {
            const on = tab === k;
            return (
              <Pressable key={k} onPress={() => setTab(k)} style={[styles.seg, on && { backgroundColor: p.ink }]}>
                <Txt weight="medium" size={Type.small} color={on ? p.onInk : p.textMuted}>
                  {k === 'content' ? `Content · ${blocks.length}` : `Questions · ${draft.mcqs.length}`}
                </Txt>
              </Pressable>
            );
          })}
        </View>

        {tab === 'content' ? (
          <View style={{ gap: 4 }}>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 6 }}>
              <Button label="Add text" icon={Plus} variant="soft" style={{ flex: 1, paddingVertical: 11 }} onPress={() => insertBlock(blocks.length, emptyBlock('paragraph'))} />
              <Button label="Add image" icon={ImageIcon} variant="soft" style={{ flex: 1, paddingVertical: 11 }} onPress={() => insertBlock(blocks.length, emptyBlock('image'))} />
            </View>
            <InsertButton onPress={() => setSheet({ kind: 'insert', at: 0 })} />
            {blocks.map((b, i) => (
              <View key={i} style={{ gap: 4 }}>
                <BlockEditor
                  block={b}
                  index={i}
                  count={blocks.length}
                  busy={busyBlock === i}
                  onChange={(nb) => setBlock(i, nb, `b${i}`)}
                  onMove={(d) => moveBlock(i, d)}
                  onDuplicate={() => insertBlock(i + 1, JSON.parse(JSON.stringify(b)))}
                  onDelete={() => setBlocks(blocks.filter((_, k) => k !== i))}
                  onMore={() => setSheet({ kind: 'more', index: i })}
                  onAi={() => setSheet({ kind: 'ai', index: i })}
                  onPickImage={(src) => addImage(i, src)}
                />
                <InsertButton onPress={() => setSheet({ kind: 'insert', at: i + 1 })} />
              </View>
            ))}
            {!blocks.length ? <Button label="Add the first block" icon={Plus} variant="soft" onPress={() => setSheet({ kind: 'insert', at: 0 })} /> : null}
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            <Pressable onPress={generate} disabled={genBusy} style={({ pressed }) => [styles.gen, { backgroundColor: p.primary }, pressed && { opacity: 0.85 }]}>
              {genBusy ? <ActivityIndicator color="#fff" /> : <Icon as={Sparkles} size={18} color="#fff" />}
              <View style={{ flex: 1 }}>
                <Txt weight="semibold" color="#fff">{genBusy ? 'Writing questions…' : 'Generate 5 questions with AI'}</Txt>
                <Txt size={Type.tiny} color="rgba(255,255,255,0.8)">Based on this topic&apos;s content, without repeats</Txt>
              </View>
            </Pressable>
            {draft.mcqs.map((q, i) => (
              <McqEditor key={q.id} q={q} index={i} onChange={(nq) => setMcq(i, nq)} onDelete={() => commit({ ...draft, mcqs: draft.mcqs.filter((_, k) => k !== i) })} />
            ))}
            <Button
              label="Add a question"
              icon={Plus}
              variant="outline"
              onPress={() =>
                commit({
                  ...draft,
                  mcqs: [...draft.mcqs, { id: newId(`${draft.topic.id}--q`), topicId: draft.topic.id, source: 'generated', question: '', options: ['', '', '', ''], answerIndex: 0, explanation: '' }],
                })
              }
            />
          </View>
        )}
      </ScrollView>

      {notice ? (
        <View style={[styles.toast, { bottom: insets.bottom + 20, backgroundColor: p.ink }]}>
          <Txt size={Type.small} color={p.onInk}>{notice}</Txt>
        </View>
      ) : null}

      {/* Insert block */}
      <Sheet visible={sheet?.kind === 'insert'} onClose={() => setSheet(null)} title="Add a block">
        {BLOCK_TYPES.map((t) => (
          <SheetItem
            key={t.type}
            icon={t.icon}
            label={t.label}
            sub={t.sub}
            onPress={() => {
              if (sheet?.kind === 'insert') insertBlock(sheet.at, emptyBlock(t.type));
              setSheet(null);
            }}
          />
        ))}
      </Sheet>

      {/* Change type / delete */}
      <Sheet visible={sheet?.kind === 'more'} onClose={() => setSheet(null)} title="Block options">
        <Txt faint size={Type.tiny} style={{ marginBottom: 4 }}>Change to</Txt>
        {BLOCK_TYPES.map((t) => (
          <SheetItem
            key={t.type}
            icon={t.icon}
            label={t.label}
            onPress={() => {
              if (sheet?.kind === 'more') setBlock(sheet.index, convertBlock(blocks[sheet.index], t.type));
              setSheet(null);
            }}
          />
        ))}
        <SheetItem
          icon={Trash2}
          label="Delete block"
          danger
          onPress={() => {
            if (sheet?.kind === 'more') setBlocks(blocks.filter((_, k) => k !== sheet.index));
            setSheet(null);
          }}
        />
      </Sheet>

      {/* AI tools */}
      <Sheet visible={sheet?.kind === 'ai'} onClose={() => setSheet(null)} title="AI tools">
        {AI_ACTIONS.map((a) => (
          <SheetItem key={a.action} icon={a.icon} label={a.label} sub={a.sub} onPress={() => sheet?.kind === 'ai' && runAi(sheet.index, a.action)} />
        ))}
      </Sheet>
    </KeyboardAvoidingView>
  );
}

function InsertButton({ onPress }: { onPress: () => void }) {
  const { palette: p } = useApp();
  return (
    <Pressable onPress={onPress} hitSlop={4} style={styles.insert} accessibilityLabel="Insert block">
      <View style={[styles.insertLine, { backgroundColor: p.border }]} />
      <View style={[styles.insertDot, { backgroundColor: p.surface, borderColor: p.border }]}>
        <Icon as={Plus} size={13} color={p.textMuted} />
      </View>
      <View style={[styles.insertLine, { backgroundColor: p.border }]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, lineHeight: 29, paddingVertical: 6, marginTop: 2 },
  segment: { flexDirection: 'row', borderRadius: 999, padding: 4, marginTop: 12, marginBottom: 10 },
  seg: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 999 },
  insert: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 24 },
  insertLine: { flex: 1, height: StyleSheet.hairlineWidth },
  insertDot: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  gen: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 20 },
  toast: { position: 'absolute', alignSelf: 'center', paddingHorizontal: 18, paddingVertical: 11, borderRadius: 999 },
});
