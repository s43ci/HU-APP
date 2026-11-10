import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Type } from '@/constants/theme';
import { builtinBooklet, getSubject, stages, subjects } from '@/data/content';
import { t as tt } from '@/i18n';
import { accessOf, useApp } from '@/store/app-store';
import { Card, SubjectThumb, Txt } from '../ui';
import { adm, Seg } from './common';

type Level = 'free' | 'pro' | 'premium';

/** Choose, for every subject, which plan opens it. Saved at once and sent to every student. */
export function Subjects() {
  const app = useApp();
  const p = app.palette;
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const editable = app.can('pricing');

  const set = async (id: string, level: Level) => {
    setBusy(id);
    setError('');
    const next = { ...app.subjectAccess, [id]: level };
    try {
      const d = await adm<{ access: Record<string, Level> }>('subjects.save', { access: next });
      app.set({ subjectAccess: d.access });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={{ gap: 12 }}>
      <Card style={{ padding: 16, gap: 4 }}>
        <Txt weight="semibold">Who can open each subject</Txt>
        <Txt muted size={Type.small} style={{ lineHeight: 20 }}>
          Free: every student. Pro: Pro and Premium subscribers. Premium: Premium subscribers only. Changes reach students within a few minutes.
        </Txt>
      </Card>
      {error ? <Txt size={Type.small} color="#E5484D">{error}</Txt> : null}
      {stages.map((st) => {
        const list = subjects.filter((s) => s.stageId === st.id && s.id !== 'uploads');
        if (!list.length) return null;
        return (
          <View key={st.id} style={{ gap: 8 }}>
            <Txt weight="semibold" size={Type.small} muted style={{ marginTop: 6 }}>{st.name}</Txt>
            {list.map((s) => {
              const level = accessOf(s.id, s.isFree, app.subjectAccess);
              return (
                <Card key={s.id} style={styles.row}>
                  <SubjectThumb subjectId={s.id} size={42} radius={12} />
                  <View style={{ flex: 1, gap: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Txt weight="medium" style={{ flex: 1 }} numberOfLines={1}>{s.name}</Txt>
                      {busy === s.id ? <ActivityIndicator size="small" color={p.primary} /> : null}
                    </View>
                    <View pointerEvents={editable && !busy ? 'auto' : 'none'} style={{ opacity: editable ? 1 : 0.6 }}>
                      <Seg<Level>
                        value={level}
                        onChange={(v) => v !== level && void set(s.id, v)}
                        options={[
                          { key: 'free', label: tt('Free') },
                          { key: 'pro', label: 'Pro' },
                          { key: 'premium', label: 'Premium' },
                        ]}
                      />
                    </View>
                  </View>
                </Card>
              );
            })}
          </View>
        );
      })}
      {!editable ? <Txt faint size={Type.tiny}>You can view this but not change it.</Txt> : null}

      {app.hiddenBooklets.length && app.canUpload ? (
        <View style={{ gap: 8, marginTop: 10 }}>
          <Txt weight="semibold">Deleted booklets</Txt>
          {app.hiddenBooklets.map((id) => {
            const b = builtinBooklet(id);
            return (
              <Card key={id} style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Txt weight="medium" numberOfLines={1}>{b?.title ?? id}</Txt>
                  <Txt faint size={Type.tiny}>{b ? getSubject(b.subjectId)?.name : ''}</Txt>
                </View>
                <Pressable
                  disabled={!!busy}
                  onPress={async () => {
                    setBusy(id);
                    try {
                      const d = await adm<{ hidden: string[] }>('content.hide', { id, hidden: false });
                      app.set({ hiddenBooklets: d.hidden });
                    } catch (e) {
                      setError((e as Error).message);
                    } finally {
                      setBusy(null);
                    }
                  }}
                  style={[styles.restore, { backgroundColor: p.primarySoft }]}>
                  {busy === id ? <ActivityIndicator size="small" color={p.primary} /> : <Txt weight="semibold" size={Type.small} color={p.primary}>Restore</Txt>}
                </Pressable>
              </Card>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  restore: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, minWidth: 80, alignItems: 'center' },
});
