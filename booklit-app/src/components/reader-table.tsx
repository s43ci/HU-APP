import { ChevronsLeftRight, Maximize2, X } from 'lucide-react-native';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Font, ReaderThemes, type ReaderTheme } from '@/constants/theme';
import { t as tt } from '@/i18n';
import { withAlpha } from './ui';

type Props = { headers: string[]; rows: string[][]; theme: ReaderTheme; accent: string; fs: number; title?: string };

const isRtl = (s: string) => /[֐-ࣿ]/.test(s.slice(0, 40));

/** Relative weight of each column from its longest cell (so long columns get more room). */
function weights(headers: string[], rows: string[][]) {
  const cols = Math.max(headers.length, ...rows.map((r) => r.length));
  return Array.from({ length: cols }, (_, c) => {
    const longest = Math.max((headers[c] ?? '').length, ...rows.map((r) => (r[c] ?? '').length));
    return Math.min(60, Math.max(6, longest));
  });
}

/**
 * Reader table:
 * - narrow tables fit the page width (text wraps inside cells, no sideways scrolling);
 * - wide tables scroll sideways with a visible hint;
 * - every table can be opened full screen, where it scrolls both ways with a sticky header.
 */
export function ReaderTable({ headers, rows, theme, accent, fs, title }: Props) {
  const { width } = useWindowDimensions();
  const [full, setFull] = useState(false);
  const rt = ReaderThemes[theme];
  const w = weights(headers, rows);
  const available = Math.min(width, 760) - 52;
  const total = w.reduce((a, b) => a + b, 0);
  const minCol = 84 * fs;
  const fits = w.length <= 4 && available / w.length >= minCol;
  const colWidths = fits
    ? w.map((x) => Math.max(minCol, (x / total) * available))
    : w.map((x) => Math.min(260, Math.max(120, x * 7.2)) * fs);
  // When fitting, scale so the columns fill the page exactly.
  const scale = fits ? available / colWidths.reduce((a, b) => a + b, 0) : 1;
  const widths = colWidths.map((x) => x * scale);

  const hasHeader = headers.some((h) => h.trim());
  // English tables stay left-to-right even inside the Arabic interface (and vice versa).
  const tableDir = isRtl([...headers, ...(rows[0] ?? [])].join(' ')) ? 'rtl' : 'ltr';
  const grid = (cellWidths: number[], big = false) => (
    <View style={[styles.table, { borderColor: rt.border, direction: tableDir }]}>
      {hasHeader ? <Row cells={headers} widths={cellWidths} header theme={theme} accent={accent} fs={big ? Math.max(fs, 1) : fs} /> : null}
      {rows.map((r, i) => (
        <Row key={i} cells={r} widths={cellWidths} theme={theme} accent={accent} fs={big ? Math.max(fs, 1) : fs} zebra={i % 2 === 1} />
      ))}
    </View>
  );

  return (
    <View style={{ marginVertical: 8, marginBottom: 18 }}>
      <View style={styles.toolbar}>
        {!fits ? (
          <View style={styles.hint}>
            <ChevronsLeftRight size={14} color={rt.muted} strokeWidth={1.6} />
            <Text style={[styles.hintText, { color: rt.muted }]}>{tt('Swipe to see all')} {w.length} {tt('columns')}</Text>
          </View>
        ) : (
          <View />
        )}
        <Pressable onPress={() => setFull(true)} hitSlop={8} style={[styles.expand, { backgroundColor: withAlpha(accent, 0.1) }]} accessibilityLabel={tt('Open table full screen')}>
          <Maximize2 size={13} color={accent} strokeWidth={1.8} />
          <Text style={[styles.expandText, { color: accent }]}>{tt('Full screen')}</Text>
        </Pressable>
      </View>

      {fits ? (
        grid(widths)
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator persistentScrollbar nestedScrollEnabled contentContainerStyle={{ paddingRight: 8 }}>
          {grid(widths)}
        </ScrollView>
      )}

      <FullTable visible={full} onClose={() => setFull(false)} title={title} theme={theme} accent={accent} headers={headers} rows={rows} weights={w} />
    </View>
  );
}

function Row({ cells, widths, header, zebra, theme, accent, fs }: { cells: string[]; widths: number[]; header?: boolean; zebra?: boolean; theme: ReaderTheme; accent: string; fs: number }) {
  const rt = ReaderThemes[theme];
  const bg = header ? withAlpha(accent, theme === 'dark' ? 0.2 : 0.08) : zebra ? withAlpha(rt.text, theme === 'dark' ? 0.04 : 0.025) : 'transparent';
  return (
    <View style={[styles.tr, { backgroundColor: bg }, !header && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: rt.border }]}>
      {widths.map((wd, c) => {
        const text = cells[c] ?? '';
        return (
          <Text
            key={c}
            selectable
            style={[
              styles.td,
              { width: wd, color: rt.text, fontSize: 13 * fs, lineHeight: 19 * fs, fontFamily: header ? Font.semibold : c === 0 ? Font.medium : Font.regular },
              c > 0 && { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: rt.border },
              isRtl(text) && { writingDirection: 'rtl', textAlign: 'right' },
            ]}>
            {text}
          </Text>
        );
      })}
    </View>
  );
}

function FullTable({ visible, onClose, title, theme, accent, headers, rows, weights: w }: { visible: boolean; onClose: () => void; title?: string; theme: ReaderTheme; accent: string; headers: string[]; rows: string[][]; weights: number[] }) {
  const insets = useSafeAreaInsets();
  const rt = ReaderThemes[theme];
  const widths = w.map((x) => Math.min(300, Math.max(130, x * 7.5)));
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} supportedOrientations={['portrait', 'landscape']}>
      <View style={{ flex: 1, backgroundColor: rt.bg, paddingTop: insets.top }}>
        <View style={[styles.fullBar, { borderBottomColor: rt.border }]}>
          <Text numberOfLines={1} style={[styles.fullTitle, { color: rt.text }]}>{title ?? tt('Table')}</Text>
          <Text style={[styles.hintText, { color: rt.muted }]}>{rows.length} {tt('rows')} · {w.length} {tt('columns')}</Text>
          <Pressable onPress={onClose} hitSlop={10} style={styles.close} accessibilityLabel="Close">
            <X size={20} color={rt.text} strokeWidth={1.7} />
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator>
          <ScrollView stickyHeaderIndices={[0]} contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 30 }} showsVerticalScrollIndicator>
            <View style={{ backgroundColor: rt.bg }}>
              <Row cells={headers} widths={widths} header theme={theme} accent={accent} fs={1} />
            </View>
            <View style={[styles.table, { borderColor: rt.border, borderTopWidth: 0, borderTopLeftRadius: 0, borderTopRightRadius: 0 }]}>
              {rows.map((r, i) => (
                <Row key={i} cells={r} widths={widths} theme={theme} accent={accent} fs={1} zebra={i % 2 === 1} />
              ))}
            </View>
          </ScrollView>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  hint: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  hintText: { fontFamily: Font.regular, fontSize: 11.5 },
  expand: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  expandText: { fontFamily: Font.medium, fontSize: 11.5 },
  table: { borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  tr: { flexDirection: 'row' },
  td: { paddingHorizontal: 10, paddingVertical: 9 },
  fullBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  fullTitle: { flex: 1, fontFamily: Font.semibold, fontSize: 15 },
  close: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
});
