import { ChevronDown, ChevronUp, Layers, ListChecks, Paintbrush, RotateCcw, Save } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Brand, Font, Type } from '@/constants/theme';
import type { AiRules } from '@/data/types';
import { t as tt } from '@/i18n';
import { useApp } from '@/store/app-store';
import { saveCatalog } from './admin/subjects';
import { Icon, Txt, type LucideIcon } from './ui';

const FIELDS: { key: keyof AiRules; icon: LucideIcon; title: string }[] = [
  { key: 'split', icon: Layers, title: 'Splitting into topics' },
  { key: 'design', icon: Paintbrush, title: 'Design' },
  { key: 'mcq', icon: ListChecks, title: 'Questions (MCQs)' },
];

/**
 * The three prompts used for THIS booklet, filled in with the unified prompts (AI settings).
 * Leave them as they are and the unified prompts are used; change them and only this booklet uses the change.
 */
export function BookletPrompts({ value, onChange }: { value: AiRules | null; onChange: (v: AiRules | null) => void }) {
  const app = useApp();
  const p = app.palette;
  const unified = app.catalog.ai;
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const rules = value ?? unified;
  const custom = !!value && (value.split !== unified.split || value.design !== unified.design || value.mcq !== unified.mcq);

  return (
    <View style={[styles.card, { borderColor: custom ? p.primary : p.border }]}>
      <Pressable onPress={() => setOpen(!open)} style={styles.head} accessibilityLabel={tt('Prompts for this booklet')}>
        <View style={{ flex: 1, gap: 2 }}>
          <Txt weight="semibold" size={Type.small}>Prompts for this booklet</Txt>
          <Txt size={Type.tiny} color={custom ? p.primary : p.textMuted}>{custom ? 'Changed for this booklet only' : 'Using the unified prompts'}</Txt>
        </View>
        <Icon as={open ? ChevronUp : ChevronDown} size={18} color={p.textMuted} />
      </Pressable>

      {open ? (
        <View style={{ gap: 12, marginTop: 4 }}>
          {FIELDS.map((f) => (
            <View key={f.key} style={{ gap: 6 }}>
              <View style={styles.label}>
                <Icon as={f.icon} size={14} color={p.primary} />
                <Txt weight="medium" size={Type.small}>{f.title}</Txt>
              </View>
              <TextInput
                value={rules[f.key]}
                onChangeText={(v) => {
                  setSaved(false);
                  onChange({ ...rules, [f.key]: v.slice(0, 1000) });
                }}
                multiline
                placeholder={tt('Empty = the built-in behaviour')}
                placeholderTextColor={p.textFaint}
                style={[styles.area, { borderColor: p.border, color: p.text, fontFamily: Font.regular }]}
              />
            </View>
          ))}
          <View style={styles.row}>
            {custom ? (
              <Pressable onPress={() => onChange(null)} style={[styles.btn, { backgroundColor: p.surfaceAlt }]}>
                <Icon as={RotateCcw} size={14} color={p.text} />
                <Txt weight="semibold" size={Type.tiny}>Use the unified prompts</Txt>
              </Pressable>
            ) : null}
            {custom && app.canUpload ? (
              <Pressable
                disabled={saving}
                onPress={async () => {
                  setSaving(true);
                  try {
                    await saveCatalog(app, { ...app.catalog, ai: rules });
                    onChange(null);
                    setSaved(true);
                  } finally {
                    setSaving(false);
                  }
                }}
                style={[styles.btn, { backgroundColor: p.primarySoft }]}>
                {saving ? <ActivityIndicator size="small" color={p.primary} /> : <Icon as={Save} size={14} color={p.primary} />}
                <Txt weight="semibold" size={Type.tiny} color={p.primary}>Make these the unified prompts</Txt>
              </Pressable>
            ) : null}
          </View>
          {saved ? <Txt size={Type.tiny} color={Brand.success}>Saved as the unified prompts for every booklet.</Txt> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1.5, borderRadius: 18, padding: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  label: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  area: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, minHeight: 72, textAlignVertical: 'top' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
});
