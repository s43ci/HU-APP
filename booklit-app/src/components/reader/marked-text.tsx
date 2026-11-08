import { Text, type StyleProp, type TextStyle } from 'react-native';

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
    .map((x) => x.t)
    .join(' ');
}

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
};

/**
 * Paragraph text where every word can be selected, so highlights and notes cover exactly
 * the chosen phrase (not the whole block). Long-press a word to start; tap another to extend.
 */
export function MarkedText({ text, block, item, marks, selection, selectedMarkId, accent, dark, style, tapToSelect, onWord, onMark }: Props) {
  const tokens = tokenize(text);
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
            style={[bg ? { backgroundColor: bg } : null, isSelectedMark ? { textDecorationLine: 'underline', textDecorationColor: accent } : null]}>
            {tk.t}
            {noteAfter ? <Text style={{ color: accent, fontSize: 11 }}>{' ✎'}</Text> : null}
          </Text>
        );
      })}
    </Text>
  );
}
