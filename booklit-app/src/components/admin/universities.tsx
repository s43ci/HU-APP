import { Check, GraduationCap, Pencil, Plus, Trash2, Users } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Brand, Font, Type } from '@/constants/theme';
import { allCourseSubjects, stages } from '@/data/content';
import type { StageId, University } from '@/data/types';
import { IS_AR, t as tt } from '@/i18n';
import { useApp } from '@/store/app-store';
import { Button, Card, Chip, EmptyState, Icon, Txt } from '../ui';
import { adm, confirm } from './common';
import { saveCatalog } from './subjects';

const slug = (s: string) =>
  `${s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 30) || 'uni'}-${Math.random().toString(36).slice(2, 6)}`;

/** Universities: add one, choose its subjects in each stage, and see how many students chose it. */
export function Universities() {
  'use no memo'; // reads the shared subject list
  const app = useApp();
  const p = app.palette;
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState('');
  const list = app.catalog.universities;
  const editable = app.canUpload;

  useEffect(() => {
    adm<{ counts: Record<string, number> }>('universities.stats')
      .then((d) => setCounts(d.counts))
      .catch(() => setCounts({}));
  }, []);

  const save = async (next: University[]) => {
    setError('');
    try {
      await saveCatalog(app, { ...app.catalog, universities: next });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const total = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : 0;

  return (
    <View style={{ gap: 12 }}>
      <Card style={{ padding: 16, gap: 4 }}>
        <Txt weight="semibold">Universities</Txt>
        <Txt muted size={Type.small} style={{ lineHeight: 20 }}>
          Add a university and choose the subjects it teaches in each stage. Students pick their university from the home screen and only see its subjects.
        </Txt>
      </Card>
      {error ? <Txt size={Type.small} color="#E5484D">{error}</Txt> : null}

      {!list.length && editing !== 'new' ? <EmptyState icon={GraduationCap} title="No universities yet" text="Until you add one, every student sees every subject." /> : null}

      {list.map((u) =>
        editing === u.id ? (
          <UniForm key={u.id} initial={u} onCancel={() => setEditing(null)} onSave={async (x) => { await save(list.map((y) => (y.id === u.id ? x : y))); setEditing(null); }} />
        ) : (
          <Card key={u.id} style={{ padding: 14, gap: 8 }}>
            <View style={styles.line}>
              <View style={[styles.icon, { backgroundColor: p.primarySoft }]}>
                <Icon as={GraduationCap} size={18} color={p.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Txt weight="semibold" numberOfLines={2}>{u.name}</Txt>
                <Txt faint size={Type.tiny}>{summary(u)}</Txt>
              </View>
              <View style={[styles.count, { backgroundColor: p.surfaceAlt }]}>
                <Icon as={Users} size={13} color={p.textMuted} />
                {counts ? <Txt weight="semibold" size={Type.small}>{counts[u.id] ?? 0}</Txt> : <ActivityIndicator size="small" color={p.primary} />}
              </View>
            </View>
            {editable ? (
              <View style={[styles.line, { justifyContent: 'flex-end' }]}>
                <Pressable onPress={() => setEditing(u.id)} style={[styles.pill, { backgroundColor: p.primarySoft }]}>
                  <Icon as={Pencil} size={13} color={p.primary} />
                  <Txt weight="semibold" size={Type.tiny} color={p.primary}>Edit</Txt>
                </Pressable>
                <Pressable
                  onPress={async () => {
                    if (await confirm('Delete this university?', 'Its students will see every subject until they choose another university.', 'Delete', true)) void save(list.filter((y) => y.id !== u.id));
                  }}
                  style={[styles.pill, { backgroundColor: Brand.danger + '14' }]}>
                  <Icon as={Trash2} size={13} color={Brand.danger} />
                  <Txt weight="semibold" size={Type.tiny} color={Brand.danger}>Delete</Txt>
                </Pressable>
              </View>
            ) : null}
          </Card>
        ),
      )}

      {counts && total ? (
        <Txt faint size={Type.tiny}>
          {IS_AR ? `${counts[''] ?? 0} طالب لم يختر جامعة بعد` : `${counts[''] ?? 0} students have not chosen a university yet`}
        </Txt>
      ) : null}

      {editable ? (
        editing === 'new' ? (
          <UniForm onCancel={() => setEditing(null)} onSave={async (x) => { await save([...list, x]); setEditing(null); }} />
        ) : (
          <Button label="Add university" icon={Plus} variant="primary" onPress={() => setEditing('new')} />
        )
      ) : null}
    </View>
  );
}

function summary(u: University) {
  const set = Object.keys(u.subjects).length;
  if (!set) return tt('Every subject in every stage');
  const n = Object.values(u.subjects).reduce((a, b) => a + (b?.length ?? 0), 0);
  return IS_AR ? `${n} مادة مختارة في ${set} مراحل · باقي المراحل كل المواد` : `${n} subjects chosen in ${set} stages · other stages: all subjects`;
}

/** Name + subjects per stage. A stage left on "All subjects" follows every subject of that stage, including new ones. */
function UniForm({ initial, onSave, onCancel }: { initial?: University; onSave: (u: University) => Promise<void>; onCancel: () => void }) {
  'use no memo';
  const { palette: p } = useApp();
  const [name, setName] = useState(initial?.name ?? '');
  const [chosen, setChosen] = useState<Partial<Record<StageId, string[]>>>(initial?.subjects ?? {});
  const [busy, setBusy] = useState(false);
  const all = allCourseSubjects();

  const toggle = (stage: StageId, id: string) => {
    const cur = chosen[stage] ?? all.filter((s) => s.stageId === stage).map((s) => s.id);
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    setChosen({ ...chosen, [stage]: next });
  };
  const setAll = (stage: StageId) => {
    const next = { ...chosen };
    delete next[stage];
    setChosen(next);
  };

  return (
    <Card style={{ padding: 14, gap: 12 }}>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder={tt('University name, e.g. University of Baghdad')}
        placeholderTextColor={p.textFaint}
        style={[styles.input, { borderColor: p.border, color: p.text, fontFamily: Font.regular }]}
      />
      {stages.map((st) => {
        const inStage = all.filter((s) => s.stageId === st.id);
        const sel = chosen[st.id];
        return (
          <View key={st.id} style={{ gap: 8 }}>
            <View style={styles.line}>
              <Txt weight="semibold" size={Type.small} style={{ flex: 1 }}>{st.name}</Txt>
              <Chip label="All subjects" active={!sel} onPress={() => setAll(st.id)} />
            </View>
            <View style={styles.wrap}>
              {inStage.map((s) => {
                const on = !sel || sel.includes(s.id);
                return (
                  <Pressable key={s.id} onPress={() => toggle(st.id, s.id)} style={[styles.sub, { borderColor: on ? p.primary : p.border, backgroundColor: on ? p.primarySoft : 'transparent' }]}>
                    {on ? <Icon as={Check} size={13} color={p.primary} stroke={2.4} /> : null}
                    <Txt size={Type.small} weight={on ? 'semibold' : 'regular'} color={on ? p.primary : p.textMuted}>{s.name}</Txt>
                  </Pressable>
                );
              })}
            </View>
          </View>
        );
      })}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button label="Cancel" variant="outline" style={{ flex: 1 }} onPress={onCancel} />
        <Button
          label={busy ? 'Saving…' : 'Save'}
          icon={Check}
          variant="primary"
          style={{ flex: 1 }}
          disabled={busy || name.trim().length < 2}
          onPress={async () => {
            setBusy(true);
            try {
              await onSave({ id: initial?.id ?? slug(name), name: name.trim(), subjects: chosen });
            } finally {
              setBusy(false);
            }
          }}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  line: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  count: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 },
  input: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  sub: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 999, borderWidth: 1.2 },
});
