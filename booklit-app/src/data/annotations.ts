/** Reader annotations and account types. */

/** Account type. Admin: upload + design. Premium: can edit booklet design. Pro: reading only. */
export type Role = 'pro' | 'premium' | 'admin';

export const HIGHLIGHT_COLORS = {
  yellow: '#FFD84D',
  green: '#7BE0A3',
  blue: '#8EC5FF',
  pink: '#FF9EC7',
} as const;
export type HighlightColor = keyof typeof HIGHLIGHT_COLORS;

/**
 * A highlight over part of a block, measured in words (inclusive).
 * `item` is the list item index for list blocks.
 */
export type Mark = {
  id: string;
  block: number;
  item?: number;
  start: number;
  end: number;
  color: HighlightColor;
  note?: string;
  text: string;
  createdAt: number;
};

/** Freehand pen stroke. x is a fraction of the page width (survives rotation), y is in pixels. */
export type Stroke = { id: string; color: string; width: number; opacity: number; points: [number, number][] };

export type ReaderPrefs = {
  font: 'sans' | 'serif';
  lineSpacing: 1 | 1.15 | 1.3;
  margin: 'narrow' | 'normal' | 'wide';
};

export const DEFAULT_READER_PREFS: ReaderPrefs = { font: 'sans', lineSpacing: 1.15, margin: 'normal' };
