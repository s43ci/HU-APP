import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewInstance,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, Txt, withAlpha } from '@/components/ui';
import { Font } from '@/constants/theme';
import { getBooklet, getSubject, getTopic, mcqsOf, topicsOf } from '@/data/content';
import type { ContentBlock } from '@/data/types';
import { useApp } from '@/store/app-store';

export default function Reader() {
  const { topicId } = useLocalSearchParams<{ topicId: string }>();
  const topic = getTopic(topicId);
  const booklet = topic && getBooklet(topic.bookletId);
  const subject = booklet && getSubject(booklet.subjectId);
  const app = useApp();
  const p = app.palette;
  const insets = useSafeAreaInsets();

  const scrollRef = useRef<ScrollViewInstance>(null);
  const [topBar] = useState(() => new Animated.Value(1));
  const [topBarY] = useState(() => topBar.interpolate({ inputRange: [0, 1], outputRange: [-100, 0] }));
  const lastY = useRef(0);
  const lastSave = useRef(0);
  const [editOpen, setEditOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [highlightMode, setHighlightMode] = useState(false);

  // Restore last position for this topic.
  const restoreOffset = app.lastRead?.topicId === topicId ? app.lastRead.offset : 0;
  useEffect(() => {
    if (restoreOffset > 0) {
      const t = setTimeout(() => scrollRef.current?.scrollTo({ y: restoreOffset, animated: false }), 60);
      return () => clearTimeout(t);
    }
  }, [topicId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Record that the student opened this topic + count study time.
  useEffect(() => {
    if (!topic) return;
    app.saveReading(topic.id, restoreOffset, 0.02);
    const iv = setInterval(() => app.addStudySeconds(15), 15000);
    return () => clearInterval(iv);
  }, [topicId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!topic || !booklet || !subject) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: p.bg }}>
        <Txt>Topic not found.</Txt>
      </View>
    );
  }

  const siblings = topicsOf(booklet.id);
  const idx = siblings.findIndex((t) => t.id === topic.id);
  const prev = siblings[idx - 1];
  const next = siblings[idx + 1];
  const accent = subject.color;
  const fs = app.fontScale;
  const highlights = app.highlights[topic.id] ?? [];
  const bookmarked = app.bookmarks.includes(topic.id);
  const ministry = mcqsOf(topic.id, 'ministry').length;
  const instructor = mcqsOf(topic.id, 'instructor').length;

  const goTopic = (id: string) => router.replace({ pathname: '/reader/[topicId]', params: { topicId: id } });

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const y = contentOffset.y;
    // Hide the top bar while reading down, show it when scrolling up.
    const goingDown = y > lastY.current + 4 && y > 60;
    const goingUp = y < lastY.current - 4 || y < 40;
    if (goingDown) Animated.timing(topBar, { toValue: 0, duration: 180, useNativeDriver: true }).start();
    else if (goingUp) Animated.timing(topBar, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    lastY.current = y;

    const now = Date.now();
    if (now - lastSave.current > 1200) {
      lastSave.current = now;
      const max = Math.max(1, contentSize.height - layoutMeasurement.height);
      app.saveReading(topic.id, y, Math.min(1, y / max));
    }
  };

  const openQuiz = (mode: 'ministry' | 'instructor' | 'quiz') =>
    router.push({ pathname: '/quiz/[topicId]', params: { topicId: topic.id, mode } });
  const openAI = () => router.push({ pathname: '/ai/[topicId]', params: { topicId: topic.id } });

  const q = query.trim().toLowerCase();

  return (
    <View style={{ flex: 1, backgroundColor: p.surface }}>
      {/* Auto-hiding minimal top bar */}
      <Animated.View
        style={[
          styles.top,
          {
            paddingTop: insets.top + 4,
            backgroundColor: p.surface,
            borderBottomColor: p.border,
            opacity: topBar,
            transform: [{ translateY: topBarY }],
          },
        ]}>
        <Pressable hitSlop={10} onPress={() => router.back()} accessibilityLabel="Back">
          <Icon name="chevron-left" size={30} color={p.text} />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Txt muted size={12} numberOfLines={1}>
            {subject.name} · {booklet.title}
          </Txt>
          <Txt weight="bold" size={15} numberOfLines={1}>
            {topic.order}. {topic.title}
          </Txt>
        </View>
        <Pressable hitSlop={10} onPress={() => app.toggleBookmark(topic.id)} accessibilityLabel="Bookmark">
          <Icon name={bookmarked ? 'bookmark' : 'bookmark-outline'} size={24} color={bookmarked ? accent : p.icon} />
        </Pressable>
      </Animated.View>

      {searchOpen ? (
        <View style={[styles.searchBar, { top: insets.top + 64, backgroundColor: p.surface, borderColor: p.border }]}>
          <Icon name="magnify" />
          <TextInput
            autoFocus
            value={query}
            onChangeText={setQuery}
            placeholder="Search in this topic"
            placeholderTextColor={p.textMuted}
            style={{ flex: 1, color: p.text, fontFamily: Font.medium, fontSize: 15, paddingVertical: 8 }}
          />
          <Pressable hitSlop={10} onPress={() => { setSearchOpen(false); setQuery(''); }}>
            <Icon name="close" />
          </Pressable>
        </View>
      ) : null}

      <ScrollView
        ref={scrollRef}
        onScroll={onScroll}
        scrollEventThrottle={32}
        contentContainerStyle={{ paddingTop: insets.top + 80, paddingHorizontal: 22, paddingBottom: 140 }}>
        <Txt weight="semibold" size={12} color={accent} style={{ letterSpacing: 1.2 }}>
          TOPIC {topic.order} OF {siblings.length} · {topic.minutes} MIN
        </Txt>
        <Txt weight="extrabold" size={28 * fs} style={{ marginTop: 6, marginBottom: 14, lineHeight: 36 * fs }}>
          {topic.title}
        </Txt>
        {highlightMode ? (
          <View style={[styles.hint, { backgroundColor: withAlpha('#FFD43B', 0.25) }]}>
            <Icon name="marker" size={18} color="#B08900" />
            <Txt size={13} style={{ flex: 1 }}>
              Highlight mode: tap a paragraph to highlight it, tap again to remove.
            </Txt>
            <Pressable onPress={() => setHighlightMode(false)}>
              <Txt weight="semibold" size={13} color={p.primary}>Done</Txt>
            </Pressable>
          </View>
        ) : null}

        {topic.blocks.map((b, i) => (
          <Pressable
            key={i}
            disabled={!highlightMode}
            onPress={() => app.toggleHighlight(topic.id, i)}
            onLongPress={() => app.toggleHighlight(topic.id, i)}
            style={[
              highlights.includes(i) && { backgroundColor: withAlpha('#FFD43B', 0.3), borderRadius: 8, marginHorizontal: -6, paddingHorizontal: 6 },
              q && blockText(b).toLowerCase().includes(q) && { borderLeftWidth: 3, borderLeftColor: accent, paddingLeft: 8 },
            ]}>
            <Block block={b} accent={accent} fs={fs} />
          </Pressable>
        ))}

        {/* Practice section under the topic */}
        <View style={[styles.practice, { borderTopColor: p.border }]}>
          <Txt weight="bold" size={18} style={{ marginBottom: 12 }}>
            Practice this topic
          </Txt>
          <View style={styles.practiceGrid}>
            <PracticeBtn icon="bank-outline" label="Ministry MCQs" sub={`${ministry} questions`} onPress={() => openQuiz('ministry')} />
            <PracticeBtn icon="account-tie-outline" label="Instructor MCQs" sub={`${instructor} questions`} onPress={() => openQuiz('instructor')} />
            <PracticeBtn icon="timer-outline" label="Quiz Mode" sub="Test yourself" onPress={() => openQuiz('quiz')} />
            <PracticeBtn icon="robot-happy-outline" label="Ask AI" sub="About this subject" onPress={openAI} highlight />
            <PracticeBtn icon="tune-variant" label="Edit" sub="Reader tools" onPress={() => setEditOpen(true)} />
            <PracticeBtn
              icon="rocket-launch-outline"
              label="Coming Soon"
              sub="Flashcards"
              onPress={() => Alert.alert('Coming soon', 'This feature will be available in a future update.')}
            />
          </View>

          {next ? (
            <Pressable onPress={() => { app.markComplete(topic.id); goTopic(next.id); }} style={[styles.next, { backgroundColor: accent }]}>
              <View style={{ flex: 1 }}>
                <Txt size={12} color="rgba(255,255,255,0.8)">Next topic</Txt>
                <Txt weight="bold" size={16} color="#fff" numberOfLines={1}>{next.title}</Txt>
              </View>
              <MaterialCommunityIcons name="arrow-right" size={24} color="#fff" />
            </Pressable>
          ) : (
            <Pressable onPress={() => { app.markComplete(topic.id); router.back(); }} style={[styles.next, { backgroundColor: accent }]}>
              <Txt weight="bold" size={16} color="#fff" style={{ flex: 1 }}>Finish booklet</Txt>
              <MaterialCommunityIcons name="check-circle-outline" size={24} color="#fff" />
            </Pressable>
          )}
        </View>
      </ScrollView>

      {/* Small fixed bottom bar */}
      <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, 10), backgroundColor: p.surface, borderTopColor: p.border }]}>
        <BarBtn icon="chevron-left" label="Prev" disabled={!prev} onPress={() => prev && goTopic(prev.id)} />
        <BarBtn icon="format-list-bulleted" label="Contents" onPress={() => setEditOpen(true)} />
        <BarBtn icon="robot-happy-outline" label="Ask AI" onPress={openAI} color={p.primary} />
        <BarBtn icon="format-size" label="Edit" onPress={() => setEditOpen(true)} />
        <BarBtn icon="chevron-right" label="Next" disabled={!next} onPress={() => next && goTopic(next.id)} />
      </View>

      {/* Edit sheet: contents, search, text size, bookmark, highlight */}
      <Modal visible={editOpen} transparent animationType="slide" onRequestClose={() => setEditOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setEditOpen(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: p.surface, paddingBottom: insets.bottom + 18 }]}>
            <View style={[styles.grabber, { backgroundColor: p.border }]} />
            <View style={styles.toolsRow}>
              <Tool icon="magnify" label="Search" onPress={() => { setEditOpen(false); setSearchOpen(true); }} />
              <Tool icon={bookmarked ? 'bookmark' : 'bookmark-outline'} label={bookmarked ? 'Saved' : 'Bookmark'} active={bookmarked} onPress={() => app.toggleBookmark(topic.id)} />
              <Tool icon="marker" label="Highlight" active={highlightMode} onPress={() => { setHighlightMode((v) => !v); setEditOpen(false); }} />
              <Tool icon="check-circle-outline" label="Done" active={app.completedTopics.includes(topic.id)} onPress={() => app.markComplete(topic.id)} />
            </View>

            <View style={[styles.sizeRow, { backgroundColor: p.surfaceAlt }]}>
              <Pressable hitSlop={8} onPress={() => app.set({ fontScale: Math.max(0.85, +(fs - 0.1).toFixed(2)) })}>
                <Txt weight="bold" size={15}>A−</Txt>
              </Pressable>
              <Txt muted size={13}>Text size {Math.round(fs * 100)}%</Txt>
              <Pressable hitSlop={8} onPress={() => app.set({ fontScale: Math.min(1.5, +(fs + 0.1).toFixed(2)) })}>
                <Txt weight="bold" size={20}>A+</Txt>
              </Pressable>
            </View>

            <Txt weight="bold" size={16} style={{ marginTop: 16, marginBottom: 6 }}>
              Contents · {booklet.title}
            </Txt>
            <ScrollView style={{ maxHeight: 280 }}>
              {siblings.map((t) => {
                const on = t.id === topic.id;
                const done = app.completedTopics.includes(t.id);
                return (
                  <Pressable
                    key={t.id}
                    onPress={() => { setEditOpen(false); if (!on) goTopic(t.id); }}
                    style={[styles.tocRow, on && { backgroundColor: p.primarySoft }]}>
                    <Txt weight="semibold" color={on ? p.primary : p.textMuted} style={{ width: 24 }}>{t.order}</Txt>
                    <Txt weight={on ? 'bold' : 'medium'} style={{ flex: 1 }} color={on ? p.primary : p.text}>{t.title}</Txt>
                    {done ? <Icon name="check-circle" size={18} color={accent} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

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

function Block({ block: b, accent, fs }: { block: ContentBlock; accent: string; fs: number }) {
  const { palette: p } = useApp();
  const body = { fontSize: 16.5 * fs, lineHeight: 27 * fs };
  switch (b.type) {
    case 'heading':
      return (
        <Txt weight="bold" size={20 * fs} color={accent} style={{ marginTop: 18, marginBottom: 8 }}>
          {b.text}
        </Txt>
      );
    case 'paragraph':
      return <Txt style={[body, { marginBottom: 12 }]}>{b.text}</Txt>;
    case 'list':
      return (
        <View style={{ marginBottom: 12, gap: 6 }}>
          {b.items.map((it, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 10 }}>
              <View style={[styles.bullet, { backgroundColor: accent, marginTop: 10 * fs }]} />
              <Txt style={[body, { flex: 1 }]}>{it}</Txt>
            </View>
          ))}
        </View>
      );
    case 'table':
      return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
          <View style={[styles.table, { borderColor: p.border }]}>
            <View style={[styles.tr, { backgroundColor: withAlpha(accent, 0.12) }]}>
              {b.headers.map((h, i) => (
                <Txt key={i} weight="bold" size={14 * fs} color={accent} style={[styles.td, i === 0 && styles.tdFirst]}>
                  {h}
                </Txt>
              ))}
            </View>
            {b.rows.map((r, ri) => (
              <View key={ri} style={[styles.tr, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: p.border }]}>
                {r.map((c, ci) => (
                  <Txt key={ci} weight={ci === 0 ? 'semibold' : 'regular'} size={14 * fs} style={[styles.td, ci === 0 && styles.tdFirst, { lineHeight: 20 * fs }]}>
                    {c}
                  </Txt>
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
      );
    case 'callout': {
      const icon = b.tone === 'warning' ? 'alert-outline' : b.tone === 'tip' ? 'lightbulb-on-outline' : 'key-variant';
      const c = b.tone === 'warning' ? '#D9480F' : b.tone === 'tip' ? '#1F9D63' : accent;
      return (
        <View style={[styles.callout, { backgroundColor: withAlpha(c, 0.09), borderLeftColor: c }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <MaterialCommunityIcons name={icon} size={18} color={c} />
            <Txt weight="bold" color={c}>{b.title}</Txt>
          </View>
          <Txt style={{ fontSize: 15.5 * fs, lineHeight: 24 * fs }}>{b.text}</Txt>
        </View>
      );
    }
    case 'image':
      return (
        <View style={{ marginBottom: 14 }}>
          <View style={[styles.figure, { backgroundColor: withAlpha(accent, 0.08), borderColor: withAlpha(accent, 0.25) }]}>
            <MaterialCommunityIcons name={b.icon as never} size={84} color={withAlpha(accent, 0.7)} />
          </View>
          <Txt muted size={13} style={{ textAlign: 'center', marginTop: 6, fontStyle: 'italic' }}>
            {b.caption}
          </Txt>
        </View>
      );
  }
}

function PracticeBtn({ icon, label, sub, onPress, highlight }: { icon: string; label: string; sub: string; onPress: () => void; highlight?: boolean }) {
  const { palette: p } = useApp();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.pBtn,
        { backgroundColor: highlight ? p.primary : p.primarySoft, opacity: pressed ? 0.8 : 1 },
      ]}>
      <Icon name={icon} size={22} color={highlight ? '#fff' : p.primary} />
      <Txt weight="bold" size={14} color={highlight ? '#fff' : p.text} numberOfLines={1}>{label}</Txt>
      <Txt size={11.5} color={highlight ? 'rgba(255,255,255,0.8)' : p.textMuted} numberOfLines={1}>{sub}</Txt>
    </Pressable>
  );
}

function BarBtn({ icon, label, onPress, disabled, color }: { icon: string; label: string; onPress: () => void; disabled?: boolean; color?: string }) {
  const { palette: p } = useApp();
  const c = disabled ? p.border : (color ?? p.icon);
  return (
    <Pressable disabled={disabled} onPress={onPress} style={styles.barBtn} accessibilityLabel={label}>
      <Icon name={icon} size={22} color={c} />
      <Txt size={10.5} weight="medium" color={c}>{label}</Txt>
    </Pressable>
  );
}

function Tool({ icon, label, onPress, active }: { icon: string; label: string; onPress: () => void; active?: boolean }) {
  const { palette: p } = useApp();
  return (
    <Pressable onPress={onPress} style={[styles.tool, { backgroundColor: active ? p.primary : p.primarySoft }]}>
      <Icon name={icon} size={22} color={active ? '#fff' : p.primary} />
      <Txt size={12} weight="semibold" color={active ? '#fff' : p.text}>{label}</Txt>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  top: {
    position: 'absolute', left: 0, right: 0, top: 0, zIndex: 10,
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchBar: {
    position: 'absolute', left: 14, right: 14, zIndex: 11, flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, borderRadius: 14, borderWidth: 1,
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 6,
  },
  hint: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 12, marginBottom: 12 },
  bullet: { width: 7, height: 7, borderRadius: 4 },
  table: { borderWidth: 1, borderRadius: 12, overflow: 'hidden', minWidth: 320 },
  tr: { flexDirection: 'row' },
  td: { width: 200, padding: 10 },
  tdFirst: { width: 110 },
  callout: { borderLeftWidth: 4, borderRadius: 12, padding: 14, marginVertical: 8 },
  figure: { height: 170, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  practice: { marginTop: 26, paddingTop: 22, borderTopWidth: StyleSheet.hairlineWidth },
  practiceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  pBtn: { width: '47%', flexGrow: 1, borderRadius: 16, padding: 12, gap: 4 },
  next: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 18, marginTop: 18 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8 },
  barBtn: { flex: 1, alignItems: 'center', gap: 2 },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,15,35,0.4)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 18 },
  grabber: { width: 44, height: 5, borderRadius: 3, alignSelf: 'center', marginBottom: 14 },
  toolsRow: { flexDirection: 'row', gap: 8 },
  tool: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 12, borderRadius: 14 },
  sizeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, paddingHorizontal: 18, borderRadius: 14, marginTop: 12 },
  tocRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 11, paddingHorizontal: 10, borderRadius: 10 },
});
