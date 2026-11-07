import { Check, Minus, Plus, X } from 'lucide-react-native';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Font, Type } from '@/constants/theme';
import type { Mcq } from '@/data/types';
import { usePalette } from '@/store/app-store';
import { Icon, Txt } from '../ui';
import { SmallButton } from './block-editor';

const SOURCE: Record<Mcq['source'], string> = { ministry: 'Ministry', instructor: 'Instructor', generated: 'Practice' };

export function McqEditor({ q, index, onChange, onDelete }: { q: Mcq; index: number; onChange: (q: Mcq) => void; onDelete: () => void }) {
  const p = usePalette();
  const input = (extra?: object) => [styles.input, { color: p.text, fontFamily: Font.regular, borderColor: p.border, backgroundColor: p.bg }, extra];
  return (
    <View style={[styles.card, { backgroundColor: p.surface }]}>
      <View style={styles.head}>
        <Txt weight="semibold" size={Type.small}>Question {index + 1}</Txt>
        <View style={{ flexDirection: 'row', gap: 4, marginLeft: 8 }}>
          {(['ministry', 'instructor', 'generated'] as const).map((s) => (
            <Pressable key={s} onPress={() => onChange({ ...q, source: s })} style={[styles.src, { backgroundColor: q.source === s ? p.ink : p.surfaceAlt }]}>
              <Txt size={10.5} weight="medium" color={q.source === s ? p.onInk : p.textMuted}>{SOURCE[s]}</Txt>
            </Pressable>
          ))}
        </View>
        <View style={{ flex: 1 }} />
        <Pressable hitSlop={8} onPress={onDelete} accessibilityLabel="Delete question">
          <Icon as={X} size={17} color="#E5484D" />
        </Pressable>
      </View>
      <TextInput multiline value={q.question} onChangeText={(question) => onChange({ ...q, question })} placeholder="Question" placeholderTextColor={p.textFaint} style={input({ fontFamily: Font.medium })} />
      <Txt faint size={Type.tiny}>Tap the circle to mark the correct answer</Txt>
      {q.options.map((o, i) => {
        const right = q.answerIndex === i;
        return (
          <View key={i} style={styles.optRow}>
            <Pressable
              onPress={() => onChange({ ...q, answerIndex: i })}
              style={[styles.radio, { borderColor: right ? '#16A34A' : p.border, backgroundColor: right ? '#16A34A' : 'transparent' }]}
              accessibilityLabel={`Mark option ${i + 1} correct`}>
              {right ? <Icon as={Check} size={13} color="#fff" stroke={2.2} /> : <Txt size={11} muted>{String.fromCharCode(65 + i)}</Txt>}
            </Pressable>
            <TextInput value={o} onChangeText={(t) => onChange({ ...q, options: q.options.map((x, k) => (k === i ? t : x)) })} placeholder={`Option ${String.fromCharCode(65 + i)}`} placeholderTextColor={p.textFaint} style={input({ flex: 1, paddingVertical: 8 })} />
            {q.options.length > 2 ? (
              <Pressable
                hitSlop={8}
                onPress={() => {
                  const options = q.options.filter((_, k) => k !== i);
                  const answerIndex = q.answerIndex === i ? 0 : q.answerIndex > i ? q.answerIndex - 1 : q.answerIndex;
                  onChange({ ...q, options, answerIndex });
                }}
                accessibilityLabel="Remove option">
                <Icon as={Minus} size={15} color={p.textFaint} />
              </Pressable>
            ) : null}
          </View>
        );
      })}
      {q.options.length < 5 ? <SmallButton icon={Plus} label="Add option" onPress={() => onChange({ ...q, options: [...q.options, ''] })} /> : null}
      <TextInput multiline value={q.explanation} onChangeText={(explanation) => onChange({ ...q, explanation })} placeholder="Explanation (shown after answering)" placeholderTextColor={p.textFaint} style={input({ fontSize: 13 })} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, padding: 14, gap: 8 },
  head: { flexDirection: 'row', alignItems: 'center' },
  src: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  optRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  radio: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
});
