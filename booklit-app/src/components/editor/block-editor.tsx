import { Image } from 'expo-image';
import {
  ArrowDown,
  Camera,
  ArrowUp,
  Copy,
  ImagePlus,
  Info,
  Lightbulb,
  Minus,
  MoreHorizontal,
  Plus,
  Sparkles,
  TriangleAlert,
  X,
} from 'lucide-react-native';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Font, Type } from '@/constants/theme';
import type { ContentBlock } from '@/data/types';
import { BLOCK_LABELS } from '@/lib/editor';
import { usePalette } from '@/store/app-store';
import { Icon, Txt } from '../ui';

const isRtl = (s: string) => /[֐-ࣿ]/.test(s.slice(0, 60));

type Props = {
  block: ContentBlock;
  index: number;
  count: number;
  busy?: boolean;
  onChange: (b: ContentBlock) => void;
  onMove: (dir: -1 | 1) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMore: () => void;
  onAi: () => void;
  onPickImage: (source: 'library' | 'camera') => void;
};

export function BlockEditor({ block: b, index, count, busy, onChange, onMove, onDuplicate, onDelete, onMore, onAi, onPickImage }: Props) {
  const p = usePalette();
  const input = (extra?: object) => [styles.input, { color: p.text, fontFamily: Font.regular, borderColor: p.border, backgroundColor: p.bg }, extra];
  const dir = (s: string) => (isRtl(s) ? ({ writingDirection: 'rtl', textAlign: 'right' } as const) : null);
  const canAi = b.type !== 'image' && b.type !== 'table';

  return (
    <View style={[styles.card, { backgroundColor: p.surface }]}>
      {/* toolbar */}
      <View style={styles.bar}>
        <Pressable onPress={onMore} style={[styles.typeChip, { backgroundColor: p.primarySoft }]} accessibilityLabel="Change block type">
          <Txt weight="medium" size={Type.tiny} color={p.primary}>{BLOCK_LABELS[b.type]}</Txt>
        </Pressable>
        <View style={{ flex: 1 }} />
        {busy ? <ActivityIndicator size="small" color={p.primary} /> : null}
        {canAi ? <Tool icon={Sparkles} label="AI tools" onPress={onAi} color={p.primary} /> : null}
        <Tool icon={ArrowUp} label="Move up" onPress={() => onMove(-1)} disabled={index === 0} />
        <Tool icon={ArrowDown} label="Move down" onPress={() => onMove(1)} disabled={index === count - 1} />
        <Tool icon={Copy} label="Duplicate" onPress={onDuplicate} />
        <Tool icon={MoreHorizontal} label="More" onPress={onMore} />
        <Tool icon={X} label="Delete block" onPress={onDelete} color="#E5484D" />
      </View>

      {b.type === 'heading' ? (
        <TextInput value={b.text} onChangeText={(text) => onChange({ ...b, text })} placeholder="Heading" placeholderTextColor={p.textFaint} style={input([{ fontFamily: Font.semibold, fontSize: 17 }, dir(b.text)])} />
      ) : null}

      {b.type === 'paragraph' ? (
        <TextInput multiline value={b.text} onChangeText={(text) => onChange({ ...b, text })} placeholder="Write a paragraph…" placeholderTextColor={p.textFaint} style={input([{ minHeight: 90, textAlignVertical: 'top' }, dir(b.text)])} />
      ) : null}

      {b.type === 'list' ? (
        <View style={{ gap: 6 }}>
          {b.items.map((it, i) => (
            <View key={i} style={styles.listRow}>
              <View style={[styles.bullet, { backgroundColor: p.primary }]} />
              <TextInput
                multiline
                value={it}
                onChangeText={(t) => onChange({ ...b, items: b.items.map((x, k) => (k === i ? t : x)) })}
                placeholder={`Item ${i + 1}`}
                placeholderTextColor={p.textFaint}
                style={input([{ flex: 1 }, dir(it)])}
              />
              <Pressable hitSlop={8} onPress={() => onChange({ ...b, items: b.items.length > 1 ? b.items.filter((_, k) => k !== i) : [''] })} accessibilityLabel="Remove item">
                <Icon as={Minus} size={16} color={p.textFaint} />
              </Pressable>
            </View>
          ))}
          <SmallButton icon={Plus} label="Add item" onPress={() => onChange({ ...b, items: [...b.items, ''] })} />
        </View>
      ) : null}

      {b.type === 'table' ? (
        <View style={{ gap: 8 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View>
              {[b.headers, ...b.rows].map((row, ri) => (
                <View key={ri} style={{ flexDirection: 'row', gap: 4, marginBottom: 4, alignItems: 'center' }}>
                  {row.map((cell, ci) => (
                    <TextInput
                      key={ci}
                      multiline
                      value={cell}
                      placeholder={ri === 0 ? `Header ${ci + 1}` : '…'}
                      placeholderTextColor={p.textFaint}
                      onChangeText={(t) => {
                        if (ri === 0) onChange({ ...b, headers: b.headers.map((h, k) => (k === ci ? t : h)) });
                        else onChange({ ...b, rows: b.rows.map((r, rk) => (rk === ri - 1 ? r.map((c, k) => (k === ci ? t : c)) : r)) });
                      }}
                      style={input([styles.cell, ri === 0 && { fontFamily: Font.semibold, backgroundColor: p.primarySoft }])}
                    />
                  ))}
                  {ri > 0 ? (
                    <Pressable hitSlop={6} onPress={() => onChange({ ...b, rows: b.rows.filter((_, k) => k !== ri - 1) })} accessibilityLabel="Remove row">
                      <Icon as={Minus} size={15} color={p.textFaint} />
                    </Pressable>
                  ) : null}
                </View>
              ))}
            </View>
          </ScrollView>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            <SmallButton icon={Plus} label="Row" onPress={() => onChange({ ...b, rows: [...b.rows, b.headers.map(() => '')] })} />
            <SmallButton icon={Plus} label="Column" onPress={() => onChange({ ...b, headers: [...b.headers, ''], rows: b.rows.map((r) => [...r, '']) })} />
            {b.headers.length > 1 ? (
              <SmallButton icon={Minus} label="Column" onPress={() => onChange({ ...b, headers: b.headers.slice(0, -1), rows: b.rows.map((r) => r.slice(0, -1)) })} />
            ) : null}
          </View>
        </View>
      ) : null}

      {b.type === 'callout' ? (
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {([['key', 'Key point', Info], ['warning', 'Warning', TriangleAlert], ['tip', 'Tip', Lightbulb]] as const).map(([tone, label, I]) => (
              <Pressable
                key={tone}
                onPress={() => onChange({ ...b, tone, title: b.title === 'Key point' || b.title === 'Warning' || b.title === 'Tip' || !b.title ? label : b.title })}
                style={[styles.tone, { backgroundColor: b.tone === tone ? p.ink : p.surfaceAlt }]}>
                <Icon as={I} size={14} color={b.tone === tone ? p.onInk : p.textMuted} />
                <Txt size={Type.tiny} weight="medium" color={b.tone === tone ? p.onInk : p.textMuted}>{label}</Txt>
              </Pressable>
            ))}
          </View>
          <TextInput value={b.title} onChangeText={(title) => onChange({ ...b, title })} placeholder="Title" placeholderTextColor={p.textFaint} style={input({ fontFamily: Font.semibold })} />
          <TextInput multiline value={b.text} onChangeText={(text) => onChange({ ...b, text })} placeholder="Note text…" placeholderTextColor={p.textFaint} style={input([{ minHeight: 70, textAlignVertical: 'top' }, dir(b.text)])} />
        </View>
      ) : null}

      {b.type === 'image' ? (
        <View style={{ gap: 8 }}>
          {b.uri ? (
            <View>
              <Image source={{ uri: b.uri }} style={styles.image} contentFit="contain" />
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
                <SmallButton icon={ImagePlus} label="Replace" onPress={() => onPickImage('library')} />
                <SmallButton icon={Camera} label="Camera" onPress={() => onPickImage('camera')} />
                <SmallButton icon={X} label="Remove image" onPress={() => onChange({ ...b, uri: undefined })} />
              </View>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable onPress={() => onPickImage('library')} style={[styles.imagePick, { borderColor: p.primary + '55', backgroundColor: p.primarySoft }]}>
                <Icon as={ImagePlus} size={22} color={p.primary} />
                <Txt weight="medium" size={Type.small} color={p.primary}>From gallery</Txt>
              </Pressable>
              <Pressable onPress={() => onPickImage('camera')} style={[styles.imagePick, { borderColor: p.primary + '55', backgroundColor: p.primarySoft }]}>
                <Icon as={Camera} size={22} color={p.primary} />
                <Txt weight="medium" size={Type.small} color={p.primary}>Take a photo</Txt>
              </Pressable>
            </View>
          )}
          <TextInput value={b.caption} onChangeText={(caption) => onChange({ ...b, caption })} placeholder="Caption" placeholderTextColor={p.textFaint} style={input([{ fontSize: 13 }, dir(b.caption)])} />
        </View>
      ) : null}
    </View>
  );
}

function Tool({ icon, label, onPress, disabled, color }: { icon: Parameters<typeof Icon>[0]['as']; label: string; onPress: () => void; disabled?: boolean; color?: string }) {
  const p = usePalette();
  return (
    <Pressable disabled={disabled} onPress={onPress} hitSlop={4} style={styles.tool} accessibilityLabel={label}>
      <Icon as={icon} size={16} color={disabled ? p.border : (color ?? p.icon)} />
    </Pressable>
  );
}

export function SmallButton({ icon, label, onPress }: { icon: Parameters<typeof Icon>[0]['as']; label: string; onPress: () => void }) {
  const p = usePalette();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.small, { backgroundColor: p.surfaceAlt }, pressed && { opacity: 0.7 }]}>
      <Icon as={icon} size={14} color={p.icon} />
      <Txt size={Type.tiny} weight="medium">{label}</Txt>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, padding: 12, gap: 10 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  typeChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  tool: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 15 },
  input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14.5, lineHeight: 21 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bullet: { width: 5, height: 5, borderRadius: 3 },
  cell: { width: 150, minHeight: 42, fontSize: 13, borderRadius: 10, paddingVertical: 8 },
  tone: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999 },
  image: { width: '100%', height: 200, borderRadius: 14, backgroundColor: '#0000000A' },
  imagePick: { flex: 1, height: 110, borderRadius: 16, borderWidth: 1.2, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 6 },
  small: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 999 },
});
