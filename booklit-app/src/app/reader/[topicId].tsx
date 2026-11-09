import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import {
  ALargeSmall,
  ArrowLeft,
  ArrowRight,
  Bookmark,
  Bot,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Copy,
  Eraser,
  Highlighter,
  Image as ImageIcon,
  Info,
  Landmark,
  Languages,
  Lightbulb,
  List,
  ListChecks,
  NotebookPen,
  Pencil,
  PenLine,
  Rocket,
  Search,
  SlidersHorizontal,
  StickyNote,
  Trash2,
  TriangleAlert,
  Undo2,
  UserRound,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewInstance,
  type TextStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DrawingLayer, type DrawTool } from '@/components/reader/drawing-layer';
import { MarkedText, tokenize, wordsOf, type Paint, type Selection } from '@/components/reader/marked-text';
import { ReaderTable } from '@/components/reader-table';
import { StoredImage } from '@/components/stored-image';
import { flipStyle, isDirectional, Txt, withAlpha } from '@/components/ui';
import { Font, ReaderThemes, Type, type ReaderTheme } from '@/constants/theme';
import { HIGHLIGHT_COLORS, type HighlightColor, type Mark, type ReaderPrefs } from '@/data/annotations';
import { getBooklet, getSubject, getTopic, isStudioBooklet, mcqsOf, topicsOf } from '@/data/content';
import type { ContentBlock } from '@/data/types';
import { aiEdit } from '@/lib/editor';
import { useApp } from '@/store/app-store';
import { t as tt } from '@/i18n';

type Mode = 'read' | 'highlight' | 'draw';
type SheetKind = null | 'settings' | 'notes' | 'toc';

const SERIF = Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia, serif' });
const PEN_COLORS = ['ink', '#E5484D', '#493BEA', '#16A34A'] as const;
const MARGINS: Record<ReaderPrefs['margin'], number> = { narrow: 16, normal: 24, wide: 36 };

export default function Reader() {
  const { topicId } = useLocalSearchParams<{ topicId: string }>();
  const topic = getTopic(topicId);
  const booklet = topic && getBooklet(topic.bookletId);
  const subject = booklet && getSubject(booklet.subjectId);
  const app = useApp();
  const p = app.palette;
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const theme: ReaderTheme = app.readerTheme === 'auto' ? (app.isDark ? 'dark' : 'light') : app.readerTheme;
  const rt = ReaderThemes[theme];
  const prefs = app.readerPrefs;
  const tablet = width >= 900;
  const wide = width >= 600;

  const scrollRef = useRef<ScrollViewInstance>(null);
  const [chrome] = useState(() => new Animated.Value(1));
  const [chromeOn, setChromeOn] = useState(true);
  const track = useRef({ lastY: 0, lastSave: 0, touchX: 0, touchY: 0, touchT: 0, wordTapAt: 0, blockY: [] as number[] });
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [matchIdx, setMatchIdx] = useState(0);
  const [mode, setMode] = useState<Mode>('read');
  const [sel, setSel] = useState<Selection | null>(null);
  const [selMarkId, setSelMarkId] = useState<string | null>(null);
  const [noteEditor, setNoteEditor] = useState<{ text: string } | null>(null);
  const [tool, setTool] = useState<DrawTool>({ kind: 'pen', color: 'ink' });
  const [pct, setPct] = useState(0);
  const [viewer, setViewer] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [lastColor, setLastColor] = useState<HighlightColor>('yellow');
  const [erasing, setErasing] = useState(false);
  const [translation, setTranslation] = useState<{ source: string; text: string; loading: boolean; error?: boolean } | null>(null);

  const restoreOffset = app.lastRead?.topicId === topicId ? app.lastRead.offset : 0;

  useEffect(() => {
    if (restoreOffset > 0) {
      const t = setTimeout(() => scrollRef.current?.scrollTo({ y: restoreOffset, animated: false }), 80);
      return () => clearTimeout(t);
    }
  }, [topicId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!topic) return;
    app.saveReading(topic.id, restoreOffset, 0.02);
    const iv = setInterval(() => app.addStudySeconds(15), 15000);
    return () => clearInterval(iv);
  }, [topicId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!topic || !booklet || !subject) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: p.bg }}>
        <Txt muted>Topic not found.</Txt>
      </View>
    );
  }

  const siblings = topicsOf(booklet.id);
  const idx = siblings.findIndex((t) => t.id === topic.id);
  const prev = siblings[idx - 1];
  const next = siblings[idx + 1];
  const fs = app.fontScale;
  const bookmarked = app.bookmarks.includes(topic.id);
  const q = query.trim().toLowerCase();
  const matches = q.length > 1 ? topic.blocks.map((b, i) => (blockText(b).toLowerCase().includes(q) ? i : -1)).filter((i) => i >= 0) : [];
  const counts = { ministry: mcqsOf(topic.id, 'ministry').length, instructor: mcqsOf(topic.id, 'instructor').length, generated: mcqsOf(topic.id, 'generated').length };

  // Highlights: word-level marks, plus older whole-block highlights shown as full-block marks.
  const legacy: Mark[] = (app.highlights[topic.id] ?? []).map((b) => ({ id: `legacy-${b}`, block: b, start: 0, end: 1e6, color: 'yellow', text: blockText(topic.blocks[b] ?? { type: 'paragraph', text: '' }), createdAt: 0 }));
  const marks: Mark[] = [...legacy, ...(app.marks[topic.id] ?? [])];
  const selMark = selMarkId ? marks.find((m) => m.id === selMarkId) : undefined;
  const drawings = app.drawings[topic.id] ?? [];

  // Typography from reading settings.
  const base = (tablet ? 18 : 16.5) * fs;
  const family = prefs.font === 'serif' ? SERIF : Font.regular;
  const body: TextStyle = { fontFamily: family, color: rt.text, fontSize: base, lineHeight: base * 1.55 * prefs.lineSpacing };
  const pad = MARGINS[prefs.margin] + (tablet ? 16 : 0);
  const minutesLeft = Math.max(0, Math.ceil(topic.minutes * (1 - pct)));

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  const showChrome = (on: boolean) => {
    if (on === chromeOn) return;
    setChromeOn(on);
    Animated.timing(chrome, { toValue: on ? 1 : 0, duration: 200, useNativeDriver: true }).start();
  };
  const busy = mode !== 'read' || !!sel || !!selMark;

  const goTopic = (id: string) => router.replace({ pathname: '/reader/[topicId]', params: { topicId: id } });

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const y = contentOffset.y;
    const t = track.current;
    if (!busy && !searchOpen) {
      if (y > t.lastY + 6 && y > 80) showChrome(false);
      else if (y < t.lastY - 12 || y < 30) showChrome(true);
    }
    t.lastY = y;
    const max = Math.max(1, contentSize.height - layoutMeasurement.height);
    const progress = Math.min(1, y / max);
    const now = clock();
    if (now - t.lastSave > 1000) {
      t.lastSave = now;
      setPct(progress);
      app.saveReading(topic.id, y, progress);
    }
  };

  // Kindle-style: a quick tap on the page toggles the reading bars; a tap off the words clears a selection.
  const onTouchStart = (e: GestureResponderEvent) => {
    const t = track.current;
    t.touchX = e.nativeEvent.pageX;
    t.touchY = e.nativeEvent.pageY;
    t.touchT = clock();
  };
  const onTouchEnd = (e: GestureResponderEvent) => {
    const t = track.current;
    const moved = Math.abs(e.nativeEvent.pageX - t.touchX) + Math.abs(e.nativeEvent.pageY - t.touchY);
    const quick = moved < 8 && clock() - t.touchT < 250;
    if (!quick || mode === 'draw') return;
    setTimeout(() => {
      if (clock() - track.current.wordTapAt < 300) return;
      if (sel || selMark) {
        setSel(null);
        setSelMarkId(null);
      } else if (mode === 'read') showChrome(!chromeOn);
    }, 0);
  };

  const textOf = (block: number, item?: number) => {
    const b = topic.blocks[block];
    if (!b) return '';
    if (b.type === 'list') return b.items[item ?? 0] ?? '';
    return b.type === 'heading' || b.type === 'paragraph' || b.type === 'callout' ? b.text : '';
  };

  /** Save a highlight right away in the last-used colour and select it (so colour/note/translate are one tap away). */
  const finalize = (block: number, item: number | undefined, a: number, b: number) => {
    const start = Math.min(a, b);
    const end = Math.max(a, b);
    const id = newMarkId();
    app.addMark(topic.id, { id, block, item, start, end, color: lastColor, text: wordsOf(textOf(block, item), start, end), createdAt: clock() });
    setSel(null);
    setSelMarkId(id);
  };

  /**
   * Highlighting by touch:
   * - long-press a word (or tap it in Highlight mode) to start;
   * - tap the last word: the phrase is highlighted at once;
   * - tap the same word again: the whole sentence is highlighted.
   */
  const onWord = (block: number, item: number | undefined, w: number, long: boolean) => {
    track.current.wordTapAt = clock();
    if (mode === 'draw') return;
    setSelMarkId(null);
    const same = sel && sel.block === block && (sel.item ?? -1) === (item ?? -1);
    if (!long && same && sel) {
      if (sel.a === sel.b && sel.a === w) {
        const [s0, s1] = sentenceAround(textOf(block, item), w);
        finalize(block, item, s0, s1);
      } else finalize(block, item, sel.a, w);
    } else setSel({ block, item, a: w, b: w });
    showChrome(true);
  };
  const onMark = (m: Mark) => {
    track.current.wordTapAt = clock();
    if (mode === 'draw') return;
    setSel(null);
    setSelMarkId(m.id);
    showChrome(true);
  };

  const selText = sel ? wordsOf(textOf(sel.block, sel.item), Math.min(sel.a, sel.b), Math.max(sel.a, sel.b)) : selMark?.text ?? '';

  const applyColor = (color: HighlightColor) => {
    setLastColor(color);
    if (selMark) {
      if (selMark.id.startsWith('legacy-')) {
        app.toggleHighlight(topic.id, selMark.block);
        app.addMark(topic.id, { ...selMark, id: newMarkId(), color, createdAt: clock() });
      } else app.updateMark(topic.id, selMark.id, { color });
    } else if (sel) {
      app.addMark(topic.id, { id: newMarkId(), block: sel.block, item: sel.item, start: Math.min(sel.a, sel.b), end: Math.max(sel.a, sel.b), color, text: selText, createdAt: clock() });
    }
    setSel(null);
    setSelMarkId(null);
  };
  const removeSelMark = () => {
    if (!selMark) return;
    if (selMark.id.startsWith('legacy-')) app.toggleHighlight(topic.id, selMark.block);
    else app.removeMark(topic.id, selMark.id);
    setSelMarkId(null);
  };
  /** Remove highlighting from words a..b of one paragraph (highlights are trimmed or split). */
  const eraseRange = (block: number, item: number | undefined, a: number, b: number, keepColor?: HighlightColor) => {
    marks
      .filter((m) => m.block === block && (m.item ?? -1) === (item ?? -1) && m.start <= b && m.end >= a && m.color !== keepColor)
      .forEach((m) => {
        if (m.id.startsWith('legacy-')) return app.toggleHighlight(topic.id, block);
        const left = m.start < a;
        const right = m.end > b;
        if (!left && !right) app.removeMark(topic.id, m.id);
        else if (left && right) {
          app.updateMark(topic.id, m.id, { end: a - 1, text: wordsOf(textOf(block, item), m.start, a - 1) });
          app.addMark(topic.id, { id: newMarkId(), block, item, start: b + 1, end: m.end, color: m.color, text: wordsOf(textOf(block, item), b + 1, m.end), createdAt: clock() });
        } else if (left) app.updateMark(topic.id, m.id, { end: a - 1, text: wordsOf(textOf(block, item), m.start, a - 1) });
        else app.updateMark(topic.id, m.id, { start: b + 1, text: wordsOf(textOf(block, item), b + 1, m.end) });
      });
  };

  /** Highlighter pen stroke over words a..b: joins touching highlights of the same colour, replaces other colours. */
  const paintRange = (block: number, item: number | undefined, a: number, b: number) => {
    let lo = a;
    let hi = b;
    let note: string | undefined;
    const same = marks.filter((m) => !m.id.startsWith('legacy-') && m.block === block && (m.item ?? -1) === (item ?? -1) && m.color === lastColor && m.start <= b + 1 && m.end >= a - 1);
    same.forEach((m) => {
      lo = Math.min(lo, m.start);
      hi = Math.max(hi, m.end);
      note ??= m.note;
      app.removeMark(topic.id, m.id);
    });
    eraseRange(block, item, lo, hi, lastColor);
    app.addMark(topic.id, { id: newMarkId(), block, item, start: lo, end: hi, color: lastColor, note, text: wordsOf(textOf(block, item), lo, hi), createdAt: clock() });
  };

  const paintFor = (block: number, item: number | undefined): Paint | null =>
    mode === 'highlight' && !selMark
      ? {
          color: HIGHLIGHT_COLORS[lastColor],
          erase: erasing,
          onPaint: (a, b) => paintRange(block, item, a, b),
          onErase: (a, b) => eraseRange(block, item, a, b),
        }
      : null;

  const saveNote = (text: string) => {
    const note = text.trim();
    if (selMark && !selMark.id.startsWith('legacy-')) app.updateMark(topic.id, selMark.id, { note: note || undefined });
    else if (sel || selMark) {
      const src = sel ?? { block: selMark!.block, item: selMark!.item, a: selMark!.start, b: Math.min(selMark!.end, 1e5) };
      if (selMark) app.toggleHighlight(topic.id, selMark.block);
      app.addMark(topic.id, { id: newMarkId(), block: src.block, item: src.item, start: Math.min(src.a, src.b), end: Math.max(src.a, src.b), color: selMark?.color ?? 'yellow', note: note || undefined, text: selText, createdAt: clock() });
    }
    setNoteEditor(null);
    setSel(null);
    setSelMarkId(null);
    if (note) flash('Note saved');
  };
  const copySel = async () => {
    await Clipboard.setStringAsync(selText);
    flash('Copied');
    setSel(null);
    setSelMarkId(null);
  };
  const translateSel = async () => {
    const text = selText;
    setTranslation({ source: text, text: '', loading: true });
    try {
      const out = await aiEdit('translate', text, topic.title);
      setTranslation({ source: text, text: out.text ?? '', loading: false });
    } catch (e) {
      setTranslation({ source: text, text: (e as Error).message, loading: false, error: true });
    }
  };
  const askSel = () => {
    const text = selText;
    setSel(null);
    setSelMarkId(null);
    router.push({ pathname: '/ai/[topicId]', params: { topicId: topic.id, q: text } });
  };

  const jumpToBlock = (i: number) => {
    const y = track.current.blockY[i];
    if (y != null) scrollRef.current?.scrollTo({ y: Math.max(0, y - 140), animated: true });
  };
  const jumpToMatch = (i: number) => {
    if (!matches.length) return;
    const n = (i + matches.length) % matches.length;
    setMatchIdx(n);
    jumpToBlock(matches[n]);
  };

  const openQuiz = (m: 'ministry' | 'instructor' | 'quiz') => router.push({ pathname: '/quiz/[topicId]', params: { topicId: topic.id, mode: m } });
  const openAI = () => router.push({ pathname: '/ai/[topicId]', params: { topicId: topic.id } });
  const comingSoon = () =>
    Platform.OS === 'web' ? globalThis.alert?.(tt('Coming soon: this feature will be available in a future update.')) : Alert.alert(tt('Coming soon'), tt('This feature will be available in a future update.'));

  const setMode2 = (m: Mode) => {
    setMode((cur) => (cur === m ? 'read' : m));
    setSel(null);
    setSelMarkId(null);
    showChrome(true);
  };

  const inkColor = (c: string) => (c === 'ink' ? rt.text : c);
  const editable = isStudioBooklet(booklet.id) && app.canEdit;
  const slideUp = chrome.interpolate({ inputRange: [0, 1], outputRange: [-90, 0] });
  const slideDown = chrome.interpolate({ inputRange: [0, 1], outputRange: [120, 0] });
  const notesCount = marks.length;

  return (
    <View style={{ flex: 1, backgroundColor: rt.bg, flexDirection: 'row' }}>
      {/* Tablet: contents always visible on the side */}
      {tablet ? (
        <View style={[styles.side, { paddingTop: insets.top + 70, borderRightColor: rt.border, backgroundColor: rt.chrome }]}>
          <Text style={[styles.sideTitle, { color: rt.muted }]}>{booklet.title.toUpperCase()}</Text>
          <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
            <Toc compact topics={siblings} current={topic.id} done={app.completedTopics} theme={theme} accent={p.primary} onPick={(id) => { setSheet(null); if (id !== topic.id) goTopic(id); }} />
          </ScrollView>
        </View>
      ) : null}

      <View style={{ flex: 1 }}>
        {/* Top bar */}
        <Animated.View
          pointerEvents={chromeOn ? 'auto' : 'none'}
          style={[styles.top, { paddingTop: insets.top + 6, backgroundColor: rt.chrome, borderBottomColor: rt.border, opacity: chrome, transform: [{ translateY: slideUp }] }]}>
          <Pressable hitSlop={10} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} style={styles.iconBtn} accessibilityLabel="Back">
            <ArrowLeft size={21} color={rt.text} strokeWidth={1.6} style={flipStyle} />
          </Pressable>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text numberOfLines={1} style={[styles.topSub, { color: rt.muted }]}>{subject.name} · {booklet.title}</Text>
            <Text numberOfLines={1} style={[styles.topTitle, { color: rt.text }]}>{topic.title}</Text>
          </View>
          {editable ? (
            <Pressable hitSlop={10} onPress={() => router.push({ pathname: '/editor/topic/[topicId]', params: { topicId: topic.id } })} style={styles.iconBtn} accessibilityLabel="Edit topic">
              <Pencil size={19} color={rt.text} strokeWidth={1.6} />
            </Pressable>
          ) : null}
          <Pressable hitSlop={10} onPress={() => app.toggleBookmark(topic.id)} style={styles.iconBtn} accessibilityLabel="Bookmark">
            <Bookmark size={20} color={bookmarked ? p.primary : rt.text} fill={bookmarked ? p.primary : 'transparent'} strokeWidth={1.6} />
          </Pressable>
          <View style={[styles.topProgress, { backgroundColor: rt.border }]}>
            <View style={{ width: `${Math.round(pct * 100)}%`, height: 2, backgroundColor: p.primary }} />
          </View>
        </Animated.View>

        {searchOpen ? (
          <View style={[styles.search, { top: insets.top + 66, backgroundColor: rt.chrome, borderColor: rt.border }]}>
            <Search size={17} color={rt.muted} strokeWidth={1.6} />
            <TextInput
              autoFocus
              value={query}
              onChangeText={(v) => { setQuery(v); setMatchIdx(0); }}
              onSubmitEditing={() => jumpToMatch(matchIdx + 1)}
              placeholder={tt('Search in this topic')}
              placeholderTextColor={rt.muted}
              style={[styles.searchInput, { color: rt.text }]}
            />
            {q.length > 1 ? <Text style={[styles.count, { color: rt.muted }]}>{matches.length ? `${matchIdx + 1}/${matches.length}` : '0'}</Text> : null}
            <Pressable hitSlop={8} onPress={() => jumpToMatch(matchIdx - 1)}><ChevronUp size={18} color={rt.text} strokeWidth={1.6} /></Pressable>
            <Pressable hitSlop={8} onPress={() => jumpToMatch(matchIdx + 1)}><ChevronDown size={18} color={rt.text} strokeWidth={1.6} /></Pressable>
            <Pressable hitSlop={8} onPress={() => { setSearchOpen(false); setQuery(''); }}><X size={18} color={rt.text} strokeWidth={1.6} /></Pressable>
          </View>
        ) : null}

        <ScrollView
          ref={scrollRef}
          onScroll={onScroll}
          scrollEventThrottle={32}
          scrollEnabled={mode !== 'draw'}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: insets.top + 86, paddingBottom: insets.bottom + 170 }}>
          <View style={{ maxWidth: tablet ? 760 : 720, width: '100%', alignSelf: 'center', paddingHorizontal: pad }}>
            <DrawingLayer strokes={drawings} active={mode === 'draw'} tool={tool} onChange={(list) => app.setDrawing(topic.id, list)} resolveColor={inkColor} />

            <Text style={[styles.kicker, { color: p.primary }]}>
              {subject.name.toUpperCase()} · {topic.order}/{siblings.length}
            </Text>
            <Text style={[styles.title, { color: rt.text, fontSize: (tablet ? 30 : 25) * fs, lineHeight: (tablet ? 38 : 32) * fs, fontFamily: prefs.font === 'serif' ? SERIF : Font.semibold }]}>{topic.title}</Text>
            <Text style={[styles.meta, { color: rt.muted }]}>{tt(`${topic.minutes} min read`)}{marks.length ? ` · ${tt(`${marks.length} highlights`)}` : ''}</Text>

            {mode === 'highlight' && !sel && !selMark ? (
              <View style={[styles.hint, { backgroundColor: withAlpha(erasing ? '#E5484D' : HIGHLIGHT_COLORS[lastColor], 0.22) }]}>
                <Highlighter size={16} color={rt.text} strokeWidth={1.6} />
                <Text style={[styles.hintText, { color: rt.text }]}>{tt(erasing ? 'Drag over a highlight to erase it.' : 'Press on the text and drag to highlight. Highlights are saved automatically.')}</Text>
              </View>
            ) : null}

            {topic.blocks.map((b, i) => {
              const isMatch = matches.includes(i);
              const isCurrent = matches[matchIdx] === i;
              const onLayout = (e: LayoutChangeEvent) => (track.current.blockY[i] = e.nativeEvent.layout.y);
              return (
                <View
                  key={i}
                  onLayout={onLayout}
                  style={isMatch ? { borderLeftWidth: 2, borderLeftColor: isCurrent ? p.primary : withAlpha(p.primary, 0.35), marginLeft: -12, paddingLeft: 10 } : null}>
                  <Block
                    block={b}
                    index={i}
                    body={body}
                    family={family}
                    fs={fs}
                    theme={theme}
                    accent={p.primary}
                    title={topic.title}
                    marks={marks}
                    sel={sel}
                    selMarkId={selMarkId}
                    tapToSelect={!!sel}
                    paintFor={paintFor}
                    onWord={onWord}
                    onMark={onMark}
                    onOpenImage={setViewer}
                  />
                </View>
              );
            })}

            {/* Practice */}
            <View style={[styles.practice, { borderTopColor: rt.border }]}>
              <Text style={[styles.practiceTitle, { color: rt.text }]}>{tt('Practice this topic')}</Text>
              <View style={styles.grid}>
                <Action w={wide} icon={Landmark} label="Ministry MCQs" sub={`${counts.ministry} questions`} onPress={() => openQuiz('ministry')} theme={theme} />
                <Action w={wide} icon={UserRound} label="Instructor MCQs" sub={`${counts.instructor} questions`} onPress={() => openQuiz('instructor')} theme={theme} />
                <Action w={wide} icon={ListChecks} label="Quiz Mode" sub="Test yourself" onPress={() => openQuiz('quiz')} theme={theme} />
                <Action w={wide} icon={SlidersHorizontal} label="Edit" sub="Reader tools" onPress={() => setSheet('settings')} theme={theme} />
                <Action w={wide} icon={Bot} label="Ask AI" sub="About this topic" onPress={openAI} theme={theme} primary />
                <Action w={wide} icon={Rocket} label="Coming Soon" sub="Flashcards" onPress={comingSoon} theme={theme} />
              </View>

              <Pressable
                onPress={() => {
                  app.markComplete(topic.id);
                  if (next) goTopic(next.id);
                  else router.back();
                }}
                style={({ pressed }) => [styles.next, { backgroundColor: app.isDark ? p.primary : '#17172B' }, pressed && { opacity: 0.9 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.nextSub}>{tt(next ? 'Next topic' : 'You reached the end')}</Text>
                  <Text numberOfLines={1} style={styles.nextTitle}>{next ? next.title : tt('Finish booklet')}</Text>
                </View>
                <View style={styles.nextArrow}>
                  <ArrowRight size={18} color="#17172B" strokeWidth={1.8} style={flipStyle} />
                </View>
              </Pressable>
            </View>
          </View>
        </ScrollView>

        {/* Selection toolbar */}
        {sel || selMark ? (
          <View style={[styles.selBar, { bottom: insets.bottom + 92, backgroundColor: theme === 'dark' ? '#25252F' : '#17172B' }]}>
            <Text numberOfLines={1} style={styles.selText}>“{selText}”</Text>
            <View style={styles.selRow}>
              {(Object.keys(HIGHLIGHT_COLORS) as HighlightColor[]).map((c) => (
                <Pressable key={c} onPress={() => applyColor(c)} hitSlop={4} accessibilityLabel={`Highlight ${c}`} style={[styles.swatch, { backgroundColor: HIGHLIGHT_COLORS[c], borderWidth: selMark?.color === c ? 2 : 0, borderColor: '#fff' }]} />
              ))}
              <View style={styles.selDivider} />
              <SelBtn icon={StickyNote} label={selMark?.note ? 'Edit note' : 'Note'} onPress={() => setNoteEditor({ text: selMark?.note ?? '' })} />
              <SelBtn icon={Copy} label="Copy" onPress={copySel} />
              <SelBtn icon={Languages} label="Translate" onPress={translateSel} />
              <SelBtn icon={Bot} label="Ask AI" onPress={askSel} />
              {selMark ? <SelBtn icon={Trash2} label="Remove" onPress={removeSelMark} /> : null}
              <SelBtn icon={X} label="Close" onPress={() => { setSel(null); setSelMarkId(null); }} />
            </View>
            {sel ? <Text style={styles.selHint}>{tt('Tap another word to select up to it · or use the highlighter pen to drag')}</Text> : selMark?.note ? <Text numberOfLines={2} style={styles.selHint}>✎ {selMark.note}</Text> : null}
          </View>
        ) : null}

        {/* Bottom: drawing tools or the small reading bar */}
        <Animated.View
          pointerEvents={chromeOn || busy ? 'auto' : 'none'}
          style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, 10), backgroundColor: rt.chrome, borderTopColor: rt.border, opacity: busy ? 1 : chrome, transform: [{ translateY: busy ? 0 : slideDown }] }]}>
          {mode === 'highlight' ? (
            <View style={styles.drawRow}>
              {(Object.keys(HIGHLIGHT_COLORS) as HighlightColor[]).map((c) => {
                const on = !erasing && lastColor === c;
                return (
                  <Pressable key={c} onPress={() => { setLastColor(c); setErasing(false); }} style={[styles.penDot, { borderColor: on ? p.primary : 'transparent' }]} accessibilityLabel={`Highlight ${c}`}>
                    <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: HIGHLIGHT_COLORS[c] }} />
                  </Pressable>
                );
              })}
              <Mini icon={Eraser} label="Eraser" active={erasing} onPress={() => setErasing(!erasing)} color={rt.text} accent={p.primary} />
              <Pressable onPress={() => { setMode2('highlight'); setErasing(false); }} style={[styles.done, { backgroundColor: p.primary }]}>
                <Text style={styles.doneText}>{tt('Done')}</Text>
              </Pressable>
            </View>
          ) : mode === 'draw' ? (
            <View style={styles.drawRow}>
              {PEN_COLORS.map((c) => {
                const on = tool.kind === 'pen' && tool.color === c;
                return (
                  <Pressable key={c} onPress={() => setTool({ kind: 'pen', color: c })} style={[styles.penDot, { borderColor: on ? p.primary : 'transparent' }]} accessibilityLabel="Pen colour">
                    <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: inkColor(c) }} />
                  </Pressable>
                );
              })}
              <Mini icon={Highlighter} label="Marker" active={tool.kind === 'marker'} onPress={() => setTool({ kind: 'marker', color: HIGHLIGHT_COLORS.yellow })} color={rt.text} accent={p.primary} />
              <Mini icon={Eraser} label="Eraser" active={tool.kind === 'eraser'} onPress={() => setTool({ kind: 'eraser', color: '' })} color={rt.text} accent={p.primary} />
              <Mini icon={Undo2} label="Undo stroke" disabled={!drawings.length} onPress={() => app.setDrawing(topic.id, drawings.slice(0, -1))} color={rt.text} />
              <Mini icon={Trash2} label="Clear drawing" disabled={!drawings.length} onPress={() => app.setDrawing(topic.id, [])} color={rt.text} />
              <Pressable onPress={() => setMode2('draw')} style={[styles.done, { backgroundColor: p.primary }]}>
                <Text style={styles.doneText}>{tt('Done')}</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.bottomRow}>
                <Mini icon={ChevronLeft} label="Previous topic" disabled={!prev} onPress={() => prev && goTopic(prev.id)} color={rt.text} />
                {!tablet ? <Mini icon={List} label="Contents" onPress={() => setSheet('toc')} color={rt.text} /> : null}
                <Mini icon={Search} label="Search" onPress={() => { setSearchOpen(true); showChrome(true); }} color={rt.text} />
                <Mini icon={ALargeSmall} label="Reading settings" onPress={() => setSheet('settings')} color={rt.text} />
                <Mini icon={Highlighter} label="Highlight" onPress={() => setMode2('highlight')} color={rt.text} accent={p.primary} />
                <Mini icon={PenLine} label="Draw" onPress={() => setMode2('draw')} color={rt.text} accent={p.primary} />
                <Mini icon={NotebookPen} label="Notes & highlights" onPress={() => setSheet('notes')} color={rt.text} badge={notesCount} accent={p.primary} />
                <Mini icon={ChevronRight} label="Next topic" disabled={!next} onPress={() => next && goTopic(next.id)} color={rt.text} />
              </View>
              <Text style={[styles.pageInfo, { color: rt.muted }]}>
                {tt(`Topic ${topic.order} of ${siblings.length}`)} · {Math.round(pct * 100)}%{minutesLeft ? ` · ${tt(`${minutesLeft} min left`)}` : ''}
              </Text>
            </>
          )}
        </Animated.View>
      </View>

      {toast ? (
        <View pointerEvents="none" style={[styles.toast, { top: insets.top + 80 }]}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}

      {/* Image viewer */}
      <Modal visible={!!viewer} transparent animationType="fade" onRequestClose={() => setViewer(null)} supportedOrientations={['portrait', 'landscape']}>
        <View style={styles.viewer}>
          <ScrollView maximumZoomScale={4} minimumZoomScale={1} centerContent contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
            {viewer ? <StoredImage uri={viewer} style={{ width: '100%', aspectRatio: 1 }} contentFit="contain" /> : null}
          </ScrollView>
          <Pressable onPress={() => setViewer(null)} style={[styles.viewerClose, { top: insets.top + 10 }]} accessibilityLabel="Close image">
            <X size={20} color="#fff" strokeWidth={1.8} />
          </Pressable>
        </View>
      </Modal>

      {/* Translation */}
      <Modal visible={!!translation} transparent animationType="fade" onRequestClose={() => setTranslation(null)}>
        <Pressable style={styles.noteBackdrop} onPress={() => setTranslation(null)}>
          <Pressable style={[styles.noteCard, { backgroundColor: p.surface }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Languages size={18} color={p.primary} strokeWidth={1.6} />
              <Txt weight="semibold" size={Type.h2}>Translation</Txt>
            </View>
            <Text numberOfLines={4} style={[styles.noteQuote, { color: p.textMuted, borderLeftColor: p.primary }]}>{translation?.source}</Text>
            {translation?.loading ? (
              <Txt muted>Translating…</Txt>
            ) : (
              <Text selectable style={{ fontFamily: Font.regular, fontSize: 16, lineHeight: 26, color: translation?.error ? '#E5484D' : p.text, writingDirection: /[\u0600-\u06FF]/.test(translation?.text ?? '') ? 'rtl' : 'auto' }}>
                {translation?.text}
              </Text>
            )}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable onPress={() => setTranslation(null)} style={[styles.noteBtn, { borderColor: p.border, borderWidth: 1 }]}>
                <Txt weight="medium">Close</Txt>
              </Pressable>
              {translation && !translation.loading && !translation.error && selMark ? (
                <Pressable
                  onPress={() => {
                    if (selMark && !selMark.id.startsWith('legacy-')) app.updateMark(topic.id, selMark.id, { note: translation.text });
                    setTranslation(null);
                    setSelMarkId(null);
                    flash('Saved as note');
                  }}
                  style={[styles.noteBtn, { backgroundColor: p.primary, flex: 1.4 }]}>
                  <Txt weight="semibold" color="#fff">Save as note</Txt>
                </Pressable>
              ) : null}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Note editor */}
      <Modal visible={!!noteEditor} transparent animationType="fade" onRequestClose={() => setNoteEditor(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.noteBackdrop}>
          <View style={[styles.noteCard, { backgroundColor: p.surface }]}>
            <Txt weight="semibold" size={Type.h2}>Note</Txt>
            <Text numberOfLines={3} style={[styles.noteQuote, { color: p.textMuted, borderLeftColor: p.primary }]}>{selText}</Text>
            <TextInput
              autoFocus
              multiline
              value={noteEditor?.text ?? ''}
              onChangeText={(t) => setNoteEditor({ text: t })}
              placeholder={tt('Write your note…')}
              placeholderTextColor={p.textFaint}
              style={[styles.noteInput, { color: p.text, borderColor: p.border, fontFamily: Font.regular }]}
            />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable onPress={() => setNoteEditor(null)} style={[styles.noteBtn, { borderColor: p.border, borderWidth: 1 }]}>
                <Txt weight="medium">Cancel</Txt>
              </Pressable>
              <Pressable onPress={() => saveNote(noteEditor?.text ?? '')} style={[styles.noteBtn, { backgroundColor: p.primary, flex: 1.4 }]}>
                <Txt weight="semibold" color="#fff">Save note</Txt>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Sheets */}
      <Modal visible={!!sheet} transparent animationType="slide" onRequestClose={() => setSheet(null)} supportedOrientations={['portrait', 'landscape']}>
        <Pressable style={styles.backdrop} onPress={() => setSheet(null)}>
          <Pressable style={[styles.sheet, { backgroundColor: p.surface, paddingBottom: insets.bottom + 18, maxWidth: 640, width: '100%', alignSelf: 'center' }]}>
            <View style={[styles.grabber, { backgroundColor: p.border }]} />
            {sheet === 'settings' ? (
              <ScrollView style={{ maxHeight: 560 }}>
                <Txt weight="semibold" size={11} muted style={styles.label}>PAGE</Txt>
                <View style={styles.themeRow}>
                  {(['auto', 'light', 'sepia', 'dark'] as const).map((k) => {
                    const th = k === 'auto' ? ReaderThemes[app.isDark ? 'dark' : 'light'] : ReaderThemes[k];
                    const on = app.readerTheme === k;
                    return (
                      <Pressable key={k} onPress={() => app.set({ readerTheme: k })} style={styles.themeItem}>
                        <View style={[styles.swatchBig, { backgroundColor: th.bg, borderColor: on ? p.primary : p.border, borderWidth: on ? 2 : 1 }]}>
                          <Text style={{ fontFamily: Font.medium, color: th.text, fontSize: 15 }}>Aa</Text>
                        </View>
                        <Txt size={Type.tiny} muted>{k === 'auto' ? 'Auto' : k[0].toUpperCase() + k.slice(1)}</Txt>
                      </Pressable>
                    );
                  })}
                </View>

                <Txt weight="semibold" size={11} muted style={styles.label}>TEXT</Txt>
                <View style={[styles.sizeBox, { backgroundColor: p.surfaceAlt }]}>
                  <Pressable hitSlop={8} onPress={() => app.set({ fontScale: Math.max(0.85, +(fs - 0.05).toFixed(2)) })} accessibilityLabel="Smaller text">
                    <Text style={{ fontFamily: Font.medium, color: p.text, fontSize: 13 }}>A</Text>
                  </Pressable>
                  <Txt size={Type.tiny} muted>{Math.round(fs * 100)}%</Txt>
                  <Pressable hitSlop={8} onPress={() => app.set({ fontScale: Math.min(1.5, +(fs + 0.05).toFixed(2)) })} accessibilityLabel="Larger text">
                    <Text style={{ fontFamily: Font.medium, color: p.text, fontSize: 20 }}>A</Text>
                  </Pressable>
                </View>
                <Seg label="Font" value={prefs.font} options={[['sans', 'Sans'], ['serif', 'Serif']]} onChange={(v) => app.setReaderPrefs({ font: v as ReaderPrefs['font'] })} />
                <Seg label="Line spacing" value={String(prefs.lineSpacing)} options={[['1', 'Compact'], ['1.15', 'Normal'], ['1.3', 'Relaxed']]} onChange={(v) => app.setReaderPrefs({ lineSpacing: Number(v) as ReaderPrefs['lineSpacing'] })} />
                <Seg label="Margins" value={prefs.margin} options={[['narrow', 'Narrow'], ['normal', 'Normal'], ['wide', 'Wide']]} onChange={(v) => app.setReaderPrefs({ margin: v as ReaderPrefs['margin'] })} />

                <View style={styles.toolRow}>
                  <Tool icon={Search} label="Search" onPress={() => { setSheet(null); setSearchOpen(true); showChrome(true); }} />
                  <Tool icon={Bookmark} label={bookmarked ? 'Saved' : 'Bookmark'} active={bookmarked} onPress={() => app.toggleBookmark(topic.id)} />
                  {editable ? <Tool icon={Pencil} label="Edit" onPress={() => { setSheet(null); router.push({ pathname: '/editor/topic/[topicId]', params: { topicId: topic.id } }); }} /> : null}
                </View>
                <Txt weight="semibold" size={11} muted style={styles.label}>CONTENTS</Txt>
                <Toc topics={siblings} current={topic.id} done={app.completedTopics} theme={theme} accent={p.primary} onPick={(id) => { setSheet(null); if (id !== topic.id) goTopic(id); }} />
              </ScrollView>
            ) : sheet === 'toc' ? (
              <>
                <Txt weight="semibold" size={Type.h2} style={{ marginBottom: 8 }}>{booklet.title}</Txt>
                <ScrollView style={{ maxHeight: 460 }}>
                  <Toc topics={siblings} current={topic.id} done={app.completedTopics} theme={theme} accent={p.primary} onPick={(id) => { setSheet(null); if (id !== topic.id) goTopic(id); }} />
                </ScrollView>
              </>
            ) : sheet === 'notes' ? (
              <>
                <Txt weight="semibold" size={Type.h2} style={{ marginBottom: 4 }}>Notes & highlights</Txt>
                <Txt faint size={Type.tiny} style={{ marginBottom: 10 }}>Long-press any word in the text to highlight a phrase or add a note.</Txt>
                <ScrollView style={{ maxHeight: 460 }}>
                  {!marks.length && !drawings.length ? <Txt muted size={Type.small}>Nothing yet in this topic.</Txt> : null}
                  {marks.map((m) => (
                    <Pressable key={m.id} onPress={() => { setSheet(null); setTimeout(() => jumpToBlock(m.block), 250); }} style={[styles.noteRow, { borderBottomColor: p.border }]}>
                      <View style={[styles.noteDot, { backgroundColor: HIGHLIGHT_COLORS[m.color] }]} />
                      <View style={{ flex: 1 }}>
                        <Txt size={Type.small} numberOfLines={3}>“{m.text}”</Txt>
                        {m.note ? <Txt size={Type.tiny} color={p.primary} style={{ marginTop: 4 }}>✎ {m.note}</Txt> : null}
                      </View>
                      <Pressable hitSlop={8} onPress={() => (m.id.startsWith('legacy-') ? app.toggleHighlight(topic.id, m.block) : app.removeMark(topic.id, m.id))} accessibilityLabel="Delete highlight">
                        <Trash2 size={16} color={p.textFaint} strokeWidth={1.6} />
                      </Pressable>
                    </Pressable>
                  ))}
                  {drawings.length ? (
                    <View style={[styles.noteRow, { borderBottomColor: p.border }]}>
                      <PenLine size={16} color={p.primary} strokeWidth={1.6} />
                      <Txt size={Type.small} style={{ flex: 1 }}>{drawings.length} drawing strokes on this page</Txt>
                      <Pressable hitSlop={8} onPress={() => app.setDrawing(topic.id, [])}>
                        <Txt size={Type.tiny} color="#E5484D">Clear</Txt>
                      </Pressable>
                    </View>
                  ) : null}
                </ScrollView>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

/** Timestamps for event handlers (kept outside render). */
const clock = () => Date.now();

/** Word range [start, end] of the sentence that contains word w. */
function sentenceAround(text: string, w: number): [number, number] {
  const words = tokenize(text).filter((t) => t.w >= 0);
  const ends = (k: number) => /[.!?؟؛:]["')\]]*$/.test(words[k]?.t ?? '');
  let a = w;
  while (a > 0 && !ends(a - 1)) a--;
  let b = w;
  while (b < words.length - 1 && !ends(b)) b++;
  return [a, b];
}

const newMarkId = () => `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

function blockText(b: ContentBlock) {
  switch (b.type) {
    case 'list':
      return b.items.join(' ');
    case 'table':
      return [...b.headers, ...b.rows.flat()].join(' ');
    case 'callout':
      return `${b.title} ${b.text}`;
    case 'image':
      return b.caption;
    default:
      return b.text;
  }
}

/** Right-to-left scripts (Arabic, Persian, Kurdish, Hebrew) are laid out RTL automatically. */
const isRtl = (s: string) => /[֐-ࣿ]/.test(s.slice(0, 80));

type BlockProps = {
  block: ContentBlock;
  index: number;
  body: TextStyle;
  family: string | undefined;
  fs: number;
  theme: ReaderTheme;
  accent: string;
  title: string;
  marks: Mark[];
  sel: Selection | null;
  selMarkId: string | null;
  tapToSelect: boolean;
  onWord: (block: number, item: number | undefined, w: number, long: boolean) => void;
  onMark: (m: Mark) => void;
  onOpenImage: (uri: string) => void;
  paintFor: (block: number, item: number | undefined) => Paint | null;
};

function Block({ block: b, index, body, family, fs, theme, accent, title, marks, sel, selMarkId, tapToSelect, onWord, onMark, onOpenImage, paintFor }: BlockProps) {
  const rt = ReaderThemes[theme];
  const dir = (s: string) => (isRtl(s) ? ({ writingDirection: 'rtl', textAlign: 'right' } as const) : null);
  const text = (t: string, style: TextStyle | (TextStyle | null)[], item?: number) => (
    <MarkedText
      text={t}
      block={index}
      item={item}
      marks={marks}
      selection={sel}
      selectedMarkId={selMarkId}
      accent={accent}
      dark={theme === 'dark'}
      style={style}
      tapToSelect={tapToSelect}
      onWord={(w, long) => onWord(index, item, w, long)}
      onMark={onMark}
      paint={paintFor(index, item)}
    />
  );
  switch (b.type) {
    case 'heading':
      return text(b.text, [{ fontFamily: Font.semibold, color: rt.text, fontSize: (body.fontSize ?? 16) * 1.12, lineHeight: (body.fontSize ?? 16) * 1.5, marginTop: 24, marginBottom: 8 }, dir(b.text)]);
    case 'paragraph':
      return text(b.text, [body, { marginBottom: 16 }, dir(b.text)]);
    case 'list':
      return (
        <View style={{ marginBottom: 16, gap: 8 }}>
          {b.items.map((it, i) => (
            <View key={i} style={{ flexDirection: isRtl(it) ? 'row-reverse' : 'row', gap: 12 }}>
              <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: accent, marginTop: (body.lineHeight ?? 26) / 2 - 2 }} />
              <View style={{ flex: 1 }}>{text(it, [body, dir(it)], i)}</View>
            </View>
          ))}
        </View>
      );
    case 'table':
      return <ReaderTable headers={b.headers} rows={b.rows} theme={theme} accent={accent} fs={fs} title={title} />;
    case 'callout': {
      const meta: Record<string, { icon: LucideIcon; color: string }> = {
        key: { icon: Info, color: accent },
        warning: { icon: TriangleAlert, color: '#D9480F' },
        tip: { icon: Lightbulb, color: '#16A34A' },
      };
      const m = meta[b.tone] ?? meta.key;
      const I = m.icon;
      return (
        <View style={[styles.callout, { backgroundColor: withAlpha(m.color, theme === 'dark' ? 0.14 : 0.06), borderLeftColor: m.color }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <I size={16} color={m.color} strokeWidth={1.7} />
            <Text style={{ fontFamily: Font.semibold, color: m.color, fontSize: 13.5 * fs }}>{b.title}</Text>
          </View>
          {text(b.text, [{ fontFamily: family, color: rt.text, fontSize: (body.fontSize ?? 16) * 0.94, lineHeight: (body.lineHeight ?? 26) * 0.94 }, dir(b.text)])}
        </View>
      );
    }
    case 'image':
      return (
        <View style={{ marginVertical: 10, marginBottom: 20 }}>
          {b.uri ? (
            <Pressable onPress={() => onOpenImage(b.uri!)} accessibilityLabel="Open image">
              <StoredImage uri={b.uri} style={[styles.photo, { borderColor: rt.border }]} contentFit="contain" transition={150} />
            </Pressable>
          ) : (
            <View style={[styles.figure, { backgroundColor: withAlpha(accent, theme === 'dark' ? 0.12 : 0.05), borderColor: rt.border }]}>
              <ImageIcon size={34} color={withAlpha(accent, 0.55)} strokeWidth={1.3} />
            </View>
          )}
          {b.caption ? <Text style={{ fontFamily: Font.regular, color: rt.muted, fontSize: 12.5 * fs, textAlign: 'center', marginTop: 8, lineHeight: 18 * fs }}>{b.caption}</Text> : null}
        </View>
      );
  }
}

function Toc({ topics, current, done, theme, accent, onPick, compact }: { topics: { id: string; order: number; title: string }[]; current: string; done: string[]; theme: ReaderTheme; accent: string; onPick: (id: string) => void; compact?: boolean }) {
  const rt = ReaderThemes[theme];
  return (
    <View>
      {topics.map((t) => {
        const on = t.id === current;
        return (
          <Pressable key={t.id} onPress={() => onPick(t.id)} style={[styles.tocRow, on && { backgroundColor: withAlpha(accent, theme === 'dark' ? 0.25 : 0.1) }]}>
            <Text style={[styles.tocNum, { color: on ? accent : rt.muted }]}>{t.order}</Text>
            <Text numberOfLines={compact ? 2 : 3} style={[styles.tocText, { color: on ? accent : rt.text, fontFamily: on ? Font.semibold : Font.regular }]}>{t.title}</Text>
            {done.includes(t.id) ? <Check size={14} color={accent} strokeWidth={2} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

function Action({ icon: I, label, sub, onPress, theme, primary, w }: { icon: LucideIcon; label: string; sub: string; onPress: () => void; theme: ReaderTheme; primary?: boolean; w: boolean }) {
  const { palette: p } = useApp();
  const rt = ReaderThemes[theme];
  const bg = primary ? p.primary : theme === 'dark' ? '#1D1D27' : theme === 'sepia' ? '#EFE6D4' : '#F4F4F8';
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.action, { width: w ? '31.8%' : '48.5%', backgroundColor: bg }, pressed && { opacity: 0.8 }]}>
      <I size={19} color={primary ? '#fff' : p.primary} strokeWidth={1.6} />
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ fontFamily: Font.semibold, fontSize: 13, color: primary ? '#fff' : rt.text }}>{tt(label)}</Text>
        <Text numberOfLines={1} style={{ fontFamily: Font.regular, fontSize: 11, color: primary ? 'rgba(255,255,255,0.8)' : rt.muted }}>{tt(sub)}</Text>
      </View>
    </Pressable>
  );
}

function Mini({ icon: I, label, onPress, disabled, color, active, accent, badge }: { icon: LucideIcon; label: string; onPress: () => void; disabled?: boolean; color: string; active?: boolean; accent?: string; badge?: number }) {
  return (
    <Pressable disabled={disabled} onPress={onPress} hitSlop={4} style={[styles.mini, active && { backgroundColor: withAlpha(accent ?? '#493BEA', 0.14) }]} accessibilityLabel={tt(label)}>
      <I size={19} color={active ? accent : color} strokeWidth={1.5} style={[{ opacity: disabled ? 0.25 : 0.85 }, isDirectional(I) ? flipStyle : null]} />
      {badge ? (
        <View style={[styles.badge, { backgroundColor: accent }]}>
          <Text style={styles.badgeText}>{badge > 99 ? '99' : badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function SelBtn({ icon: I, label, onPress }: { icon: LucideIcon; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={4} style={styles.selBtn} accessibilityLabel={tt(label)}>
      <I size={17} color="#fff" strokeWidth={1.6} />
      <Text style={styles.selBtnText}>{tt(label)}</Text>
    </Pressable>
  );
}

function Tool({ icon: I, label, onPress, active }: { icon: LucideIcon; label: string; onPress: () => void; active?: boolean }) {
  const { palette: p } = useApp();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.tool, { backgroundColor: active ? p.ink : p.surfaceAlt }, pressed && { opacity: 0.8 }]}>
      <I size={17} color={active ? p.onInk : p.icon} strokeWidth={1.6} />
      <Txt size={Type.tiny} weight="medium" color={active ? p.onInk : p.text}>{label}</Txt>
    </Pressable>
  );
}

function Seg({ label, value, options, onChange }: { label: string; value: string; options: [string, string][]; onChange: (v: string) => void }) {
  const { palette: p } = useApp();
  return (
    <View style={styles.segRow}>
      <Txt size={Type.small} style={{ width: 96 }}>{label}</Txt>
      <View style={[styles.seg, { backgroundColor: p.surfaceAlt }]}>
        {options.map(([v, l]) => {
          const on = v === value;
          return (
            <Pressable key={v} onPress={() => onChange(v)} style={[styles.segItem, on && { backgroundColor: p.surface }]}>
              <Txt size={Type.tiny} weight={on ? 'semibold' : 'regular'} color={on ? p.text : p.textMuted}>{l}</Txt>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  side: { width: 260, borderRightWidth: StyleSheet.hairlineWidth, paddingHorizontal: 10 },
  sideTitle: { fontFamily: Font.semibold, fontSize: 11, letterSpacing: 1, marginBottom: 8, marginLeft: 10 },
  top: { position: 'absolute', left: 0, right: 0, top: 0, zIndex: 10, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  topProgress: { position: 'absolute', left: 0, right: 0, bottom: -1, height: 2 },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topSub: { fontFamily: Font.regular, fontSize: 11 },
  topTitle: { fontFamily: Font.semibold, fontSize: 14 },
  search: { position: 'absolute', left: 16, right: 16, zIndex: 11, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, borderRadius: 22, borderWidth: 1, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, elevation: 6 },
  searchInput: { flex: 1, fontFamily: Font.regular, fontSize: 14, paddingVertical: 11 },
  count: { fontFamily: Font.medium, fontSize: 12 },
  kicker: { fontFamily: Font.medium, fontSize: 11, letterSpacing: 1.2 },
  title: { marginTop: 8, letterSpacing: -0.3 },
  meta: { fontFamily: Font.regular, fontSize: 12, marginTop: 6, marginBottom: 22 },
  hint: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 12, marginBottom: 14 },
  hintText: { fontFamily: Font.regular, fontSize: 12.5, flex: 1 },
  callout: { borderRadius: 14, borderLeftWidth: 3, padding: 14, marginVertical: 8, marginBottom: 18 },
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth },
  figure: { height: 150, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  practice: { marginTop: 30, paddingTop: 24, borderTopWidth: StyleSheet.hairlineWidth },
  practiceTitle: { fontFamily: Font.semibold, fontSize: 16, marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 12, borderRadius: 16 },
  next: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, paddingLeft: 20, borderRadius: 22, marginTop: 16 },
  nextSub: { fontFamily: Font.regular, fontSize: 11.5, color: 'rgba(255,255,255,0.7)' },
  nextTitle: { fontFamily: Font.semibold, fontSize: 15, color: '#fff', marginTop: 2 },
  nextArrow: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  selBar: { position: 'absolute', left: 12, right: 12, zIndex: 20, borderRadius: 22, padding: 12, gap: 8, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 16, elevation: 12, maxWidth: 640, alignSelf: 'center' },
  selText: { fontFamily: Font.medium, fontSize: 12.5, color: 'rgba(255,255,255,0.85)' },
  selRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  swatch: { width: 26, height: 26, borderRadius: 13 },
  selDivider: { width: StyleSheet.hairlineWidth, height: 26, backgroundColor: 'rgba(255,255,255,0.25)', marginHorizontal: 2 },
  selBtn: { alignItems: 'center', paddingHorizontal: 6, gap: 2 },
  selBtnText: { fontFamily: Font.medium, fontSize: 10, color: 'rgba(255,255,255,0.85)' },
  selHint: { fontFamily: Font.regular, fontSize: 11, color: 'rgba(255,255,255,0.6)' },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 6 },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 8 },
  drawRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 4 },
  penDot: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  done: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999 },
  doneText: { fontFamily: Font.semibold, fontSize: 13, color: '#fff' },
  mini: { width: 40, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 2, right: 2, minWidth: 15, height: 15, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeText: { fontFamily: Font.semibold, fontSize: 9, color: '#fff' },
  pageInfo: { fontFamily: Font.regular, fontSize: 10.5, textAlign: 'center', marginTop: 2 },
  toast: { position: 'absolute', alignSelf: 'center', left: 0, right: 0, alignItems: 'center', zIndex: 30 },
  toastText: { backgroundColor: 'rgba(23,23,43,0.92)', color: '#fff', fontFamily: Font.medium, fontSize: 13, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999, overflow: 'hidden' },
  viewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.94)' },
  viewerClose: { position: 'absolute', right: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  noteBackdrop: { flex: 1, backgroundColor: 'rgba(15,15,30,0.4)', justifyContent: 'center', padding: 20 },
  noteCard: { borderRadius: 26, padding: 20, gap: 12, maxWidth: 520, width: '100%', alignSelf: 'center' },
  noteQuote: { fontFamily: Font.regular, fontSize: 13, borderLeftWidth: 3, paddingLeft: 10, lineHeight: 19 },
  noteInput: { borderWidth: 1, borderRadius: 16, padding: 12, minHeight: 110, textAlignVertical: 'top', fontSize: 15 },
  noteBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 13, borderRadius: 999 },
  noteRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  noteDot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,15,30,0.35)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingTop: 12 },
  grabber: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
  label: { letterSpacing: 1, marginTop: 14, marginBottom: 10 },
  themeRow: { flexDirection: 'row', gap: 14 },
  themeItem: { alignItems: 'center', gap: 6 },
  swatchBig: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  sizeBox: { height: 46, borderRadius: 23, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 6 },
  segRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  seg: { flex: 1, flexDirection: 'row', borderRadius: 999, padding: 3 },
  segItem: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 999 },
  toolRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  tool: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 999 },
  tocRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 11, paddingHorizontal: 10, borderRadius: 12 },
  tocNum: { fontFamily: Font.medium, fontSize: 12.5, width: 22 },
  tocText: { flex: 1, fontSize: 13.5, lineHeight: 19 },
});
