import { router, useLocalSearchParams } from 'expo-router';
import {
  ALargeSmall,
  ArrowLeft,
  ArrowRight,
  Bookmark,
  Bot,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Highlighter,
  Image as ImageIcon,
  Info,
  Landmark,
  Lightbulb,
  List,
  ListChecks,
  Pencil,
  Rocket,
  Search,
  SlidersHorizontal,
  TriangleAlert,
  UserRound,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewInstance,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ReaderTable } from '@/components/reader-table';
import { Txt, withAlpha } from '@/components/ui';
import { Font, ReaderThemes, Type, type ReaderTheme } from '@/constants/theme';
import { getBooklet, getSubject, getTopic, mcqsOf, topicsOf, UPLOADS_SUBJECT } from '@/data/content';
import { Image } from 'expo-image';
import type { ContentBlock } from '@/data/types';
import { useApp } from '@/store/app-store';

const HL = '#FFD84D';

export default function Reader() {
  const { topicId } = useLocalSearchParams<{ topicId: string }>();
  const topic = getTopic(topicId);
  const booklet = topic && getBooklet(topic.bookletId);
  const subject = booklet && getSubject(booklet.subjectId);
  const app = useApp();
  const p = app.palette;
  const insets = useSafeAreaInsets();
  const theme: ReaderTheme = app.readerTheme === 'auto' ? (app.isDark ? 'dark' : 'light') : app.readerTheme;
  const rt = ReaderThemes[theme];

  const scrollRef = useRef<ScrollViewInstance>(null);
  const [chrome] = useState(() => new Animated.Value(1));
  const [chromeOn, setChromeOn] = useState(true);
  const track = useRef({ lastY: 0, lastSave: 0, touchX: 0, touchY: 0, touchT: 0, blockY: [] as number[] });
  const [sheet, setSheet] = useState<null | 'edit'>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [matchIdx, setMatchIdx] = useState(0);
  const [highlightMode, setHighlightMode] = useState(false);
  const [pct, setPct] = useState(0);
  const [viewer, setViewer] = useState<string | null>(null);

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
  const highlights = app.highlights[topic.id] ?? [];
  const bookmarked = app.bookmarks.includes(topic.id);
  const q = query.trim().toLowerCase();
  const matches = q.length > 1 ? topic.blocks.map((b, i) => (blockText(b).toLowerCase().includes(q) ? i : -1)).filter((i) => i >= 0) : [];
  const counts = {
    ministry: mcqsOf(topic.id, 'ministry').length,
    instructor: mcqsOf(topic.id, 'instructor').length,
    generated: mcqsOf(topic.id, 'generated').length,
  };

  const showChrome = (on: boolean) => {
    if (on === chromeOn) return;
    setChromeOn(on);
    Animated.timing(chrome, { toValue: on ? 1 : 0, duration: 200, useNativeDriver: true }).start();
  };

  const goTopic = (id: string) => router.replace({ pathname: '/reader/[topicId]', params: { topicId: id } });

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const y = contentOffset.y;
    const t = track.current;
    if (y > t.lastY + 6 && y > 80 && !searchOpen) showChrome(false);
    else if (y < t.lastY - 12 || y < 30) showChrome(true);
    t.lastY = y;
    const max = Math.max(1, contentSize.height - layoutMeasurement.height);
    const progress = Math.min(1, y / max);
    const now = Date.now();
    if (now - t.lastSave > 1000) {
      t.lastSave = now;
      setPct(progress);
      app.saveReading(topic.id, y, progress);
    }
  };

  // Kindle-style: a quick tap on the page toggles the reading chrome.
  const onTouchStart = (e: GestureResponderEvent) => {
    const t = track.current;
    t.touchX = e.nativeEvent.pageX;
    t.touchY = e.nativeEvent.pageY;
    t.touchT = Date.now();
  };
  const onTouchEnd = (e: GestureResponderEvent) => {
    const t = track.current;
    const moved = Math.abs(e.nativeEvent.pageX - t.touchX) + Math.abs(e.nativeEvent.pageY - t.touchY);
    if (!highlightMode && moved < 8 && Date.now() - t.touchT < 250) showChrome(!chromeOn);
  };

  const jumpToMatch = (i: number) => {
    if (!matches.length) return;
    const n = (i + matches.length) % matches.length;
    setMatchIdx(n);
    const y = track.current.blockY[matches[n]];
    if (y != null) scrollRef.current?.scrollTo({ y: Math.max(0, y - 140), animated: true });
  };

  const openQuiz = (mode: 'ministry' | 'instructor' | 'quiz') => router.push({ pathname: '/quiz/[topicId]', params: { topicId: topic.id, mode } });
  const openAI = () => router.push({ pathname: '/ai/[topicId]', params: { topicId: topic.id } });
  const comingSoon = () =>
    Platform.OS === 'web' ? globalThis.alert?.('Coming soon: this feature will be available in a future update.') : Alert.alert('Coming soon', 'This feature will be available in a future update.');

  const fade = chrome;
  const slideUp = chrome.interpolate({ inputRange: [0, 1], outputRange: [-90, 0] });
  const slideDown = chrome.interpolate({ inputRange: [0, 1], outputRange: [90, 0] });

  return (
    <View style={{ flex: 1, backgroundColor: rt.bg }}>
      {/* Top chrome */}
      <Animated.View
        pointerEvents={chromeOn ? 'auto' : 'none'}
        style={[styles.top, { paddingTop: insets.top + 6, backgroundColor: rt.chrome, borderBottomColor: rt.border, opacity: fade, transform: [{ translateY: slideUp }] }]}>
        <Pressable hitSlop={10} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} style={styles.iconBtn} accessibilityLabel="Back">
          <ArrowLeft size={21} color={rt.text} strokeWidth={1.6} />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text numberOfLines={1} style={[styles.topSub, { color: rt.muted }]}>{booklet.title}</Text>
          <Text numberOfLines={1} style={[styles.topTitle, { color: rt.text }]}>{topic.title}</Text>
        </View>
        {subject.id === UPLOADS_SUBJECT.id ? (
          <Pressable hitSlop={10} onPress={() => router.push({ pathname: '/editor/topic/[topicId]', params: { topicId: topic.id } })} style={styles.iconBtn} accessibilityLabel="Edit topic">
            <Pencil size={19} color={rt.text} strokeWidth={1.6} />
          </Pressable>
        ) : null}
        <Pressable hitSlop={10} onPress={() => app.toggleBookmark(topic.id)} style={styles.iconBtn} accessibilityLabel="Bookmark">
          <Bookmark size={20} color={bookmarked ? p.primary : rt.text} fill={bookmarked ? p.primary : 'transparent'} strokeWidth={1.6} />
        </Pressable>
      </Animated.View>

      {searchOpen ? (
        <View style={[styles.search, { top: insets.top + 64, backgroundColor: rt.chrome, borderColor: rt.border }]}>
          <Search size={17} color={rt.muted} strokeWidth={1.6} />
          <TextInput
            autoFocus
            value={query}
            onChangeText={(v) => { setQuery(v); setMatchIdx(0); }}
            onSubmitEditing={() => jumpToMatch(matchIdx + 1)}
            placeholder="Search in this topic"
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
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 84, paddingHorizontal: 26, paddingBottom: insets.bottom + 120, maxWidth: 760, width: '100%', alignSelf: 'center' }}>
        <Text style={[styles.kicker, { color: p.primary }]}>
          {subject.name.toUpperCase()} · {topic.order}/{siblings.length}
        </Text>
        <Text style={[styles.title, { color: rt.text, fontSize: 24 * fs, lineHeight: 31 * fs }]}>{topic.title}</Text>
        <Text style={[styles.meta, { color: rt.muted }]}>{topic.minutes} min read</Text>

        {highlightMode ? (
          <View style={[styles.hint, { backgroundColor: withAlpha(HL, 0.22) }]}>
            <Highlighter size={16} color={rt.text} strokeWidth={1.6} />
            <Text style={[styles.hintText, { color: rt.text }]}>Tap a paragraph to highlight it. Tap again to remove.</Text>
            <Pressable hitSlop={8} onPress={() => setHighlightMode(false)}>
              <Text style={[styles.hintText, { color: p.primary, fontFamily: Font.semibold }]}>Done</Text>
            </Pressable>
          </View>
        ) : null}

        {topic.blocks.map((b, i) => {
          const isMatch = matches.includes(i);
          const isCurrent = matches[matchIdx] === i;
          const style = [
            highlights.includes(i) && { backgroundColor: withAlpha(HL, theme === 'dark' ? 0.22 : 0.38), borderRadius: 6, marginHorizontal: -8, paddingHorizontal: 8 },
            isMatch && { borderLeftWidth: 2, borderLeftColor: isCurrent ? p.primary : withAlpha(p.primary, 0.35), marginLeft: -12, paddingLeft: 10 },
          ];
          const onLayout = (e: LayoutChangeEvent) => (track.current.blockY[i] = e.nativeEvent.layout.y);
          const content = <Block block={b} fs={fs} theme={theme} accent={p.primary} title={topic.title} onOpenImage={setViewer} />;
          // Tables and figures scroll/tap on their own, so they are not wrapped in the highlight press handler.
          if (b.type === 'table' || b.type === 'image') {
            return (
              <View key={i} onLayout={onLayout} style={style}>
                {content}
              </View>
            );
          }
          return (
            <Pressable
              key={i}
              onLayout={onLayout}
              onPress={highlightMode ? () => app.toggleHighlight(topic.id, i) : undefined}
              onLongPress={() => app.toggleHighlight(topic.id, i)}
              delayLongPress={350}
              style={style}>
              {content}
            </Pressable>
          );
        })}

        {/* Practice */}
        <View style={[styles.practice, { borderTopColor: rt.border }]}>
          <Text style={[styles.practiceTitle, { color: rt.text }]}>Practice this topic</Text>
          <View style={styles.grid}>
            <Action icon={Landmark} label="Ministry MCQs" sub={`${counts.ministry} questions`} onPress={() => openQuiz('ministry')} theme={theme} />
            <Action icon={UserRound} label="Instructor MCQs" sub={`${counts.instructor} questions`} onPress={() => openQuiz('instructor')} theme={theme} />
            <Action icon={ListChecks} label="Quiz Mode" sub={counts.generated ? `${counts.generated} questions` : 'Test yourself'} onPress={() => openQuiz('quiz')} theme={theme} />
            <Action icon={SlidersHorizontal} label="Edit" sub="Reader tools" onPress={() => setSheet('edit')} theme={theme} />
            <Action icon={Bot} label="Ask AI" sub="About this topic" onPress={openAI} theme={theme} primary />
            <Action icon={Rocket} label="Coming Soon" sub="Flashcards" onPress={comingSoon} theme={theme} />
          </View>

          <Pressable
            onPress={() => {
              app.markComplete(topic.id);
              if (next) goTopic(next.id);
              else router.back();
            }}
            style={({ pressed }) => [styles.next, { backgroundColor: p.ink === '#17172B' ? '#17172B' : p.primary }, pressed && { opacity: 0.9 }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.nextSub}>{next ? 'Next topic' : 'You reached the end'}</Text>
              <Text numberOfLines={1} style={styles.nextTitle}>{next ? next.title : 'Finish booklet'}</Text>
            </View>
            <View style={styles.nextArrow}>
              <ArrowRight size={18} color="#17172B" strokeWidth={1.8} />
            </View>
          </Pressable>
        </View>
      </ScrollView>

      {/* Bottom mini bar */}
      <Animated.View
        pointerEvents={chromeOn ? 'auto' : 'none'}
        style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, 10), backgroundColor: rt.chrome, borderTopColor: rt.border, opacity: fade, transform: [{ translateY: slideDown }] }]}>
        <View style={[styles.progressTrack, { backgroundColor: rt.border }]}>
          <View style={[styles.progressFill, { width: `${Math.round(pct * 100)}%`, backgroundColor: p.primary }]} />
        </View>
        <View style={styles.bottomRow}>
          <Mini icon={ChevronLeft} label="Previous topic" disabled={!prev} onPress={() => prev && goTopic(prev.id)} color={rt.text} />
          <Mini icon={List} label="Contents" onPress={() => setSheet('edit')} color={rt.text} />
          <Mini icon={Search} label="Search" onPress={() => { setSearchOpen(true); showChrome(true); }} color={rt.text} />
          <Mini icon={ALargeSmall} label="Text" onPress={() => setSheet('edit')} color={rt.text} />
          <Mini icon={Highlighter} label="Highlight" active={highlightMode} onPress={() => setHighlightMode((v) => !v)} color={rt.text} accent={p.primary} />
          <Mini icon={ChevronRight} label="Next topic" disabled={!next} onPress={() => next && goTopic(next.id)} color={rt.text} />
        </View>
        <Text style={[styles.pageInfo, { color: rt.muted }]}>
          Topic {topic.order} of {siblings.length} · {Math.round(pct * 100)}%
        </Text>
      </Animated.View>

      {/* Full-screen image (pinch to zoom on iOS, scroll to pan) */}
      <Modal visible={!!viewer} transparent animationType="fade" onRequestClose={() => setViewer(null)}>
        <View style={styles.viewer}>
          <ScrollView maximumZoomScale={4} minimumZoomScale={1} centerContent contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
            {viewer ? <Image source={{ uri: viewer }} style={{ width: '100%', aspectRatio: 1 }} contentFit="contain" /> : null}
          </ScrollView>
          <Pressable onPress={() => setViewer(null)} style={[styles.viewerClose, { top: insets.top + 10 }]} accessibilityLabel="Close image">
            <X size={20} color="#fff" strokeWidth={1.8} />
          </Pressable>
        </View>
      </Modal>

      {/* Edit sheet */}
      <Modal visible={sheet === 'edit'} transparent animationType="slide" onRequestClose={() => setSheet(null)}>
        <Pressable style={styles.backdrop} onPress={() => setSheet(null)}>
          <Pressable style={[styles.sheet, { backgroundColor: p.surface, paddingBottom: insets.bottom + 18 }]}>
            <View style={[styles.grabber, { backgroundColor: p.border }]} />

            <Txt weight="semibold" size={Type.small} muted style={styles.label}>PAGE</Txt>
            <View style={styles.themeRow}>
              {(Object.keys(ReaderThemes) as ReaderTheme[]).map((k) => (
                <Pressable key={k} onPress={() => app.set({ readerTheme: k })} style={styles.themeItem}>
                  <View style={[styles.swatch, { backgroundColor: ReaderThemes[k].bg, borderColor: theme === k ? p.primary : p.border, borderWidth: theme === k ? 2 : 1 }]}>
                    <Text style={{ fontFamily: Font.medium, color: ReaderThemes[k].text, fontSize: 15 }}>Aa</Text>
                  </View>
                  <Txt size={Type.tiny} muted>{k[0].toUpperCase() + k.slice(1)}</Txt>
                </Pressable>
              ))}
              <View style={[styles.sizeBox, { backgroundColor: p.surfaceAlt }]}>
                <Pressable hitSlop={8} onPress={() => app.set({ fontScale: Math.max(0.85, +(fs - 0.05).toFixed(2)) })} accessibilityLabel="Smaller text">
                  <Text style={{ fontFamily: Font.medium, color: p.text, fontSize: 13 }}>A</Text>
                </Pressable>
                <Txt size={Type.tiny} muted>{Math.round(fs * 100)}%</Txt>
                <Pressable hitSlop={8} onPress={() => app.set({ fontScale: Math.min(1.4, +(fs + 0.05).toFixed(2)) })} accessibilityLabel="Larger text">
                  <Text style={{ fontFamily: Font.medium, color: p.text, fontSize: 19 }}>A</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.toolRow}>
              <Tool icon={Search} label="Search" onPress={() => { setSheet(null); setSearchOpen(true); showChrome(true); }} />
              <Tool icon={Bookmark} label={bookmarked ? 'Saved' : 'Bookmark'} active={bookmarked} onPress={() => app.toggleBookmark(topic.id)} />
              <Tool icon={Highlighter} label="Highlight" active={highlightMode} onPress={() => { setHighlightMode((v) => !v); setSheet(null); }} />
              {subject.id === UPLOADS_SUBJECT.id ? (
                <Tool icon={Pencil} label="Edit" onPress={() => { setSheet(null); router.push({ pathname: '/editor/topic/[topicId]', params: { topicId: topic.id } }); }} />
              ) : null}
            </View>

            <Txt weight="semibold" size={Type.small} muted style={styles.label}>CONTENTS</Txt>
            <ScrollView style={{ maxHeight: 260 }}>
              {siblings.map((t) => {
                const on = t.id === topic.id;
                const done = app.completedTopics.includes(t.id);
                return (
                  <Pressable key={t.id} onPress={() => { setSheet(null); if (!on) goTopic(t.id); }} style={[styles.tocRow, on && { backgroundColor: p.primarySoft }]}>
                    <Txt size={Type.small} weight="medium" color={on ? p.primary : p.textFaint} style={{ width: 22 }}>{t.order}</Txt>
                    <Txt size={Type.small} weight={on ? 'semibold' : 'regular'} color={on ? p.primary : p.text} style={{ flex: 1 }}>{t.title}</Txt>
                    {done ? <Txt size={Type.tiny} color={p.primary}>Done</Txt> : null}
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

/** Right-to-left scripts (Arabic, Persian, Kurdish, Hebrew) are laid out RTL automatically. */
const isRtl = (s: string) => /[֐-ࣿ]/.test(s.slice(0, 80));

function Block({ block: b, fs, theme, accent, title, onOpenImage }: { block: ContentBlock; fs: number; theme: ReaderTheme; accent: string; title?: string; onOpenImage?: (uri: string) => void }) {
  const rt = ReaderThemes[theme];
  const body = { fontFamily: Font.regular, color: rt.text, fontSize: 16 * fs, lineHeight: 27 * fs };
  const dir = (s: string) => (isRtl(s) ? ({ writingDirection: 'rtl', textAlign: 'right' } as const) : null);
  switch (b.type) {
    case 'heading':
      return <Text style={[{ fontFamily: Font.semibold, color: rt.text, fontSize: 18 * fs, lineHeight: 25 * fs, marginTop: 22, marginBottom: 8 }, dir(b.text)]}>{b.text}</Text>;
    case 'paragraph':
      return <Text selectable style={[body, { marginBottom: 14 }, dir(b.text)]}>{b.text}</Text>;
    case 'list':
      return (
        <View style={{ marginBottom: 14, gap: 7 }}>
          {b.items.map((it, i) => (
            <View key={i} style={{ flexDirection: isRtl(it) ? 'row-reverse' : 'row', gap: 12 }}>
              <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: accent, marginTop: 11 * fs }} />
              <Text selectable style={[body, { flex: 1 }, dir(it)]}>{it}</Text>
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
        <View style={[styles.callout, { backgroundColor: withAlpha(m.color, theme === 'dark' ? 0.14 : 0.06) }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <I size={16} color={m.color} strokeWidth={1.7} />
            <Text style={{ fontFamily: Font.semibold, color: m.color, fontSize: 13.5 * fs }}>{b.title}</Text>
          </View>
          <Text selectable style={[{ fontFamily: Font.regular, color: rt.text, fontSize: 15 * fs, lineHeight: 24 * fs }, dir(b.text)]}>{b.text}</Text>
        </View>
      );
    }
    case 'image':
      return (
        <View style={{ marginVertical: 10, marginBottom: 18 }}>
          {b.uri ? (
            <Pressable onPress={() => onOpenImage?.(b.uri!)} accessibilityLabel="Open image">
              <Image source={{ uri: b.uri }} style={[styles.photo, { borderColor: rt.border }]} contentFit="contain" transition={150} />
            </Pressable>
          ) : (
            <View style={[styles.figure, { backgroundColor: withAlpha(accent, theme === 'dark' ? 0.12 : 0.05), borderColor: rt.border }]}>
              <ImageIcon size={34} color={withAlpha(accent, 0.55)} strokeWidth={1.3} />
            </View>
          )}
          <Text style={[{ fontFamily: Font.regular, color: rt.muted, fontSize: 12.5 * fs, textAlign: 'center', marginTop: 8 }]}>{b.caption}</Text>
        </View>
      );
  }
}

function Action({ icon: I, label, sub, onPress, theme, primary }: { icon: LucideIcon; label: string; sub: string; onPress: () => void; theme: ReaderTheme; primary?: boolean }) {
  const { palette: p } = useApp();
  const rt = ReaderThemes[theme];
  const bg = primary ? p.primary : theme === 'dark' ? '#1D1D27' : theme === 'sepia' ? '#EFE6D4' : '#F4F4F8';
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.action, { backgroundColor: bg }, pressed && { opacity: 0.8 }]}>
      <I size={19} color={primary ? '#fff' : p.primary} strokeWidth={1.6} />
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ fontFamily: Font.semibold, fontSize: 13, color: primary ? '#fff' : rt.text }}>{label}</Text>
        <Text numberOfLines={1} style={{ fontFamily: Font.regular, fontSize: 11, color: primary ? 'rgba(255,255,255,0.8)' : rt.muted }}>{sub}</Text>
      </View>
    </Pressable>
  );
}

function Mini({ icon: I, label, onPress, disabled, color, active, accent }: { icon: LucideIcon; label: string; onPress: () => void; disabled?: boolean; color: string; active?: boolean; accent?: string }) {
  return (
    <Pressable disabled={disabled} onPress={onPress} hitSlop={6} style={[styles.mini, active && { backgroundColor: withAlpha(accent ?? '#493BEA', 0.12) }]} accessibilityLabel={label}>
      <I size={19} color={active ? accent : color} strokeWidth={1.5} style={{ opacity: disabled ? 0.25 : 0.85 }} />
    </Pressable>
  );
}

function Tool({ icon: I, label, onPress, active }: { icon: LucideIcon; label: string; onPress: () => void; active?: boolean }) {
  const { palette: p } = useApp();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.tool, { backgroundColor: active ? p.ink : p.surfaceAlt }, pressed && { opacity: 0.8 }]}>
      <I size={18} color={active ? p.onInk : p.icon} strokeWidth={1.6} />
      <Txt size={Type.tiny} weight="medium" color={active ? p.onInk : p.text}>{label}</Txt>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  top: { position: 'absolute', left: 0, right: 0, top: 0, zIndex: 10, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topSub: { fontFamily: Font.regular, fontSize: 11 },
  topTitle: { fontFamily: Font.semibold, fontSize: 14 },
  search: { position: 'absolute', left: 16, right: 16, zIndex: 11, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, borderRadius: 22, borderWidth: 1, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, elevation: 6 },
  searchInput: { flex: 1, fontFamily: Font.regular, fontSize: 14, paddingVertical: 11 },
  count: { fontFamily: Font.medium, fontSize: 12 },
  kicker: { fontFamily: Font.medium, fontSize: 11, letterSpacing: 1.2 },
  title: { fontFamily: Font.semibold, marginTop: 8, letterSpacing: -0.3 },
  meta: { fontFamily: Font.regular, fontSize: 12, marginTop: 6, marginBottom: 20 },
  hint: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 12, marginBottom: 14 },
  hintText: { fontFamily: Font.regular, fontSize: 12.5, flex: 1 },
  callout: { borderRadius: 14, padding: 14, marginVertical: 8, marginBottom: 16 },
  viewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.94)' },
  viewerClose: { position: 'absolute', right: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth },
  figure: { height: 150, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  practice: { marginTop: 28, paddingTop: 24, borderTopWidth: StyleSheet.hairlineWidth },
  practiceTitle: { fontFamily: Font.semibold, fontSize: 16, marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  action: { width: '48.5%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 12, borderRadius: 16 },
  next: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, paddingLeft: 20, borderRadius: 22, marginTop: 16 },
  nextSub: { fontFamily: Font.regular, fontSize: 11.5, color: 'rgba(255,255,255,0.7)' },
  nextTitle: { fontFamily: Font.semibold, fontSize: 15, color: '#fff', marginTop: 2 },
  nextArrow: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopWidth: StyleSheet.hairlineWidth },
  progressTrack: { height: 2 },
  progressFill: { height: 2 },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-around', paddingTop: 6, paddingHorizontal: 12 },
  mini: { width: 42, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  pageInfo: { fontFamily: Font.regular, fontSize: 10.5, textAlign: 'center', marginTop: 2 },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,15,30,0.35)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingTop: 12 },
  grabber: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
  label: { letterSpacing: 1, marginTop: 10, marginBottom: 10, fontSize: 11 },
  themeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  themeItem: { alignItems: 'center', gap: 6 },
  swatch: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  sizeBox: { flex: 1, height: 48, borderRadius: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18 },
  toolRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  tool: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 999 },
  tocRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 11, paddingHorizontal: 10, borderRadius: 12 },
});
