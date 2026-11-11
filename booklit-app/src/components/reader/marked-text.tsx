import { useRef, useState, type ComponentRef } from 'react';
import { Platform, StyleSheet, Text, View, type GestureResponderEvent, type StyleProp, type TextStyle } from 'react-native';

import { Font } from '@/constants/theme';
import { HIGHLIGHT_COLORS, type Mark } from '@/data/annotations';
import { withAlpha } from '../ui';

/** Split text into tokens, keeping whitespace, and number the words. */
export function tokenize(text: string) {
  const tokens = text.split(/(\s+)/).filter((t) => t.length);
  let w = -1;
  return tokens.map((t) => (/^\s+$/.test(t) ? { t, w: -1 } : { t, w: ++w }));
}

export function wordsOf(text: string, start: number, end: number) {
  return tokenize(text)
    .filter((x) => x.w >= start && x.w <= end)
    .map((x) => x.t.replace(/\*\*/g, ''))
    .join(' ');
}

/**
 * Key words are marked **like this** by the AI. Which words are bold (by word number), and the
 * word without the asterisks. Word numbers stay the same, so highlights and notes keep working.
 */
export function boldWords(tokens: { t: string; w: number }[]) {
  const bold = new Set<number>();
  let on = false;
  for (const tk of tokens) {
    if (tk.w < 0) continue;
    const opens = /^[^\p{L}\p{N}]*\*\*/u.test(tk.t);
    const closes = /\*\*[^\p{L}\p{N}]*$/u.test(tk.t) && (!opens || tk.t.replace(/\*\*/, '').includes('**'));
    if (opens) on = true;
    if (on) bold.add(tk.w);
    if (closes) on = false;
  }
  return bold;
}
export const plainWord = (t: string) => t.replace(/\*\*/g, '');

export type Selection = { block: number; item?: number; a: number; b: number };

type Props = {
  text: string;
  block: number;
  item?: number;
  marks: Mark[];
  selection: Selection | null;
  selectedMarkId: string | null;
  accent: string;
  dark: boolean;
  style: StyleProp<TextStyle>;
  /** Words react to taps (selection in progress or highlight mode). */
  tapToSelect: boolean;
  onWord: (word: number, long: boolean) => void;
  onMark: (mark: Mark) => void;
  /** Highlighter pen is on: press and drag across words to highlight (or erase). */
  paint?: Paint | null;
};

export type Paint = {
  color: string;
  erase: boolean;
  onPaint: (a: number, b: number) => void;
  onErase: (a: number, b: number) => void;
};

/**
 * Paragraph text where every word can be selected, so highlights and notes cover exactly
 * the chosen phrase (not the whole block). Long-press a word to start; tap another to extend.
 */
export function MarkedText(props: Props) {
  if (props.paint) return <PaintFlow {...props} paint={props.paint} />;
  return <PlainMarked {...props} />;
}

function PlainMarked({ text, block, item, marks, selection, selectedMarkId, accent, dark, style, tapToSelect, onWord, onMark }: Props) {
  const tokens = tokenize(text);
  const bold = boldWords(tokens);
  const mine = marks.filter((m) => m.block === block && (m.item ?? -1) === (item ?? -1));
  const markAt = (w: number) => {
    for (let i = mine.length - 1; i >= 0; i--) if (w >= mine[i].start && w <= mine[i].end) return mine[i];
    return undefined;
  };
  const sel = selection && selection.block === block && (selection.item ?? -1) === (item ?? -1) ? selection : null;
  const selLo = sel ? Math.min(sel.a, sel.b) : -1;
  const selHi = sel ? Math.max(sel.a, sel.b) : -1;
  const alpha = dark ? 0.35 : 0.5;

  return (
    <Text style={style}>
      {tokens.map((tk, k) => {
        // Whitespace takes the background of the words on both sides when they share it.
        const prev = tk.w >= 0 ? tk.w : (tokens[k - 1]?.w ?? -1);
        const next = tk.w >= 0 ? tk.w : (tokens[k + 1]?.w ?? -1);
        const inSel = !!sel && prev >= 0 && next >= 0 && prev >= selLo && next <= selHi;
        const mPrev = prev >= 0 ? markAt(prev) : undefined;
        const mNext = next >= 0 ? markAt(next) : undefined;
        const m = mPrev && mNext && mPrev.id === mNext.id ? mPrev : undefined;
        const isSelectedMark = m && m.id === selectedMarkId;
        const bg = inSel ? withAlpha(accent, 0.28) : m ? withAlpha(HIGHLIGHT_COLORS[m.color], isSelectedMark ? Math.min(1, alpha + 0.3) : alpha) : undefined;
        const noteAfter = tk.w >= 0 && m?.note && m.end === tk.w;
        if (tk.w < 0) return bg ? <Text key={k} style={{ backgroundColor: bg }}>{tk.t}</Text> : tk.t;
        return (
          <Text
            key={k}
            suppressHighlighting
            onPress={m && !sel ? () => onMark(m) : tapToSelect ? () => onWord(tk.w, false) : undefined}
            onLongPress={() => (m && !sel ? onMark(m) : onWord(tk.w, true))}
            style={[bg ? { backgroundColor: bg } : null, bold.has(tk.w) ? { fontFamily: Font.semibold } : null, isSelectedMark ? { textDecorationLine: 'underline', textDecorationColor: accent } : null]}>
            {plainWord(tk.t)}
            {noteAfter ? <Text style={{ color: accent, fontSize: 11 }}>{' ✎'}</Text> : null}
          </Text>
        );
      })}
    </Text>
  );
}

type Rect = { x: number; y: number; w: number; h: number };

const LAYOUT_KEYS = ['margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight', 'marginStart', 'marginEnd', 'marginVertical', 'marginHorizontal'] as const;

/**
 * Highlighter pen: the paragraph is laid out word by word so the finger position maps to a word.
 * Press on the text and drag: the words under the finger are highlighted live, and saved on release.
 * With the eraser on, dragging removes highlights instead. Dragging outside the text still scrolls.
 */
function PaintFlow({ text, block, item, marks, dark, style, onMark, paint, selection, accent }: Props & { paint: Paint }) {
  const tokens = tokenize(text).filter((t) => t.w >= 0);
  const bold = boldWords(tokens);
  const mine = marks.filter((m) => m.block === block && (m.item ?? -1) === (item ?? -1));
  const markAt = (w: number) => {
    for (let i = mine.length - 1; i >= 0; i--) if (w >= mine[i].start && w <= mine[i].end) return mine[i];
    return undefined;
  };
  const [drag, setDrag] = useState<{ a: number; b: number } | null>(null);
  const box = useRef<ComponentRef<typeof View>>(null);
  const g = useRef({ rects: [] as Rect[], ox: 0, oy: 0, ready: false, a: -1, b: -1, sx: 0, sy: 0, moved: false });

  const flat = StyleSheet.flatten(style) ?? {};
  const outer: Record<string, unknown> = {};
  const inner: Record<string, unknown> = {};
  Object.entries(flat).forEach(([k, v]) => ((LAYOUT_KEYS as readonly string[]).includes(k) ? (outer[k] = v) : k === 'textAlign' || k === 'writingDirection' ? null : (inner[k] = v)));
  const rtl = /[\u0590-\u08FF]/.test(text.slice(0, 60));
  const alpha = dark ? 0.35 : 0.5;
  const space = Math.round(((flat.fontSize as number | undefined) ?? 16) * 0.28);

  const hit = (px: number, py: number) => {
    const r = g.current.rects;
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < r.length; i++) {
      const q = r[i];
      if (!q) continue;
      const dy = py < q.y ? q.y - py : py > q.y + q.h ? py - (q.y + q.h) : 0;
      const dx = px < q.x ? q.x - px : px > q.x + q.w ? px - (q.x + q.w) : 0;
      const d = dy * 4 + dx; // same line first, then nearest along the line
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  };

  const at = (e: GestureResponderEvent) => hit(e.nativeEvent.pageX - g.current.ox, e.nativeEvent.pageY - g.current.oy);

  const grant = (e: GestureResponderEvent) => {
    const st = g.current;
    st.ready = false;
    st.moved = false;
    st.sx = e.nativeEvent.pageX;
    st.sy = e.nativeEvent.pageY;
    const { pageX, pageY } = e.nativeEvent;
    box.current?.measureInWindow((x, y) => {
      st.ox = x;
      st.oy = y;
      st.ready = true;
      const w = hit(pageX - x, pageY - y);
      st.a = w;
      st.b = w;
    });
  };
  const move = (e: GestureResponderEvent) => {
    const st = g.current;
    if (!st.ready || st.a < 0) return;
    if (Math.abs(e.nativeEvent.pageX - st.sx) + Math.abs(e.nativeEvent.pageY - st.sy) > 6) st.moved = true;
    const w = at(e);
    if (w >= 0 && w !== st.b) {
      st.b = w;
      setDrag({ a: st.a, b: w });
    } else if (st.moved && !drag) setDrag({ a: st.a, b: st.b });
  };
  const release = () => {
    const st = g.current;
    const a = Math.min(st.a, st.b);
    const b = Math.max(st.a, st.b);
    setDrag(null);
    if (a < 0) return;
    if (!st.moved) {
      // A tap on a highlight opens it (colour, note, remove); a tap on plain text highlights that word.
      const m = markAt(a);
      if (m && !paint.erase) return onMark(m);
    }
    if (paint.erase) paint.onErase(a, b);
    else paint.onPaint(a, b);
  };

  const sel = selection && selection.block === block && (selection.item ?? -1) === (item ?? -1) ? selection : null;
  const lo = drag ? Math.min(drag.a, drag.b) : -1;
  const hi = drag ? Math.max(drag.a, drag.b) : -1;
  const bgOf = (w: number) => {
    if (drag && w >= lo && w <= hi) return paint.erase ? 'rgba(229,72,77,0.18)' : withAlpha(paint.color, alpha + 0.1);
    if (sel && w >= Math.min(sel.a, sel.b) && w <= Math.max(sel.a, sel.b)) return withAlpha(accent, 0.28);
    const m = markAt(w);
    return m ? withAlpha(HIGHLIGHT_COLORS[m.color], alpha) : undefined;
  };

  return (
    <View
      ref={box}
      style={[outer, styles.flow, { direction: rtl ? 'rtl' : 'ltr' }, Platform.OS === 'web' ? ({ touchAction: 'none', cursor: 'text' } as object) : null]}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={grant}
      onResponderMove={move}
      onResponderRelease={release}
      onResponderTerminate={() => setDrag(null)}>
      {tokens.map((tk, i) => {
        const bg = bgOf(tk.w);
        const nextBg = i < tokens.length - 1 ? bgOf(tokens[i + 1].w) : undefined;
        const last = i === tokens.length - 1;
        // The gap after a word is part of the highlight only when the next word shares it, so a phrase reads as one band.
        const joined = !!bg && bg === nextBg;
        return (
          <View
            key={i}
            onLayout={(e) => {
              const l = e.nativeEvent.layout;
              g.current.rects[tk.w] = { x: l.x, y: l.y, w: l.width, h: l.height };
            }}
            style={[{ backgroundColor: bg, borderRadius: 3 }, last ? null : joined ? { paddingEnd: space, borderTopEndRadius: 0, borderBottomEndRadius: 0 } : { marginEnd: space }, i > 0 && bg && bgOf(tokens[i - 1].w) === bg ? { borderTopStartRadius: 0, borderBottomStartRadius: 0 } : null]}>
            <Text style={[inner, bold.has(tk.w) ? { fontFamily: Font.semibold } : null]}>{plainWord(tk.t)}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  flow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start' },
});
