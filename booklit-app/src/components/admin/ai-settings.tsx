import { Check, Layers, ListChecks, Paintbrush } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Brand, Font, Type } from '@/constants/theme';
import type { AiRules } from '@/data/types';
import { t as tt } from '@/i18n';
import { useApp } from '@/store/app-store';
import { Button, Card, Icon, Txt, type LucideIcon } from '../ui';
import { saveCatalog } from './subjects';

const FIELDS: { key: keyof AiRules; icon: LucideIcon; title: string; help: string; example: string }[] = [
  {
    key: 'split',
    icon: Layers,
    title: 'Splitting into topics',
    help: 'How the file is divided into topics and in what order.',
    example: 'Follow the lecture headings. One topic per main heading. Keep the order of the lecture. Put the introduction and definitions in the first topic.',
  },
  {
    key: 'design',
    icon: Paintbrush,
    title: 'Design',
    help: 'How each topic looks (used with "AI design").',
    example: 'Use tables for classifications and comparisons. Keep paragraphs short. Add one "Exam tip" box only when the lecture says something is important.',
  },
  {
    key: 'mcq',
    icon: ListChecks,
    title: 'Questions (MCQs)',
    help: 'How the practice questions are written.',
    example: 'Write ministry-style single-best-answer questions. No "all of the above". Every question must be answerable from the topic text.',
  },
];

/** Rules the AI follows for every file it converts. Written in plain words, Arabic or English. */
export function AiSettings() {
  const app = useApp();
  const p = app.palette;
  const [rules, setRules] = useState<AiRules>(app.catalog.ai);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  return (
    <View style={{ gap: 12 }}>
      <Card style={{ padding: 16, gap: 4 }}>
        <Txt weight="semibold">Teach the AI how you want booklets</Txt>
        <Txt muted size={Type.small} style={{ lineHeight: 20 }}>
          Write your rules in plain words (Arabic or English). The AI follows them for every file. When you upload a file you can also add instructions just for that file.
        </Txt>
      </Card>
      {FIELDS.map((f) => (
        <Card key={f.key} style={{ padding: 16, gap: 8 }}>
          <View style={styles.line}>
            <View style={[styles.icon, { backgroundColor: p.primarySoft }]}>
              <Icon as={f.icon} size={17} color={p.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Txt weight="semibold">{f.title}</Txt>
              <Txt faint size={Type.tiny}>{f.help}</Txt>
            </View>
          </View>
          <TextInput
            value={rules[f.key]}
            onChangeText={(v) => setRules({ ...rules, [f.key]: v.slice(0, 1000) })}
            multiline
            placeholder={`${tt('Example')}: ${tt(f.example)}`}
            placeholderTextColor={p.textFaint}
            style={[styles.area, { borderColor: p.border, color: p.text, fontFamily: Font.regular }]}
          />
          <Txt faint size={10.5} style={{ textAlign: 'right' }}>{rules[f.key].length}/1000</Txt>
        </Card>
      ))}
      {msg ? <Txt size={Type.small} color={msg.ok ? Brand.success : Brand.danger}>{msg.text}</Txt> : null}
      <Button
        label={busy ? 'Saving…' : 'Save rules'}
        icon={Check}
        variant="primary"
        disabled={busy}
        onPress={async () => {
          setBusy(true);
          setMsg(null);
          try {
            await saveCatalog(app, { ...app.catalog, ai: rules });
            setMsg({ ok: true, text: tt('Saved. The next file you upload follows these rules.') });
          } catch (e) {
            setMsg({ ok: false, text: (e as Error).message });
          } finally {
            setBusy(false);
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  line: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  area: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14.5, minHeight: 110, textAlignVertical: 'top' },
});
