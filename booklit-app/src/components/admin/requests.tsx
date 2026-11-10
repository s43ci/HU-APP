import { Check, Inbox, X } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Brand, Font, Type } from '@/constants/theme';
import { t as tt } from '@/i18n';
import { formatPrice, type SubRequest } from '@/lib/api';
import { useApp } from '@/store/app-store';
import { Card, EmptyState, Icon, Txt } from '../ui';
import { adm, fmtDate, PlanBadge, Seg, STAGE_SHORT, Tag } from './common';

type Filter = 'pending' | 'approved' | 'rejected' | 'all';

export function Requests() {
  const app = useApp();
  const p = app.palette;
  const [list, setList] = useState<SubRequest[] | null>(null);
  const [filter, setFilter] = useState<Filter>('pending');
  const [busy, setBusy] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(() => {
    adm<{ requests: SubRequest[] }>('requests.list')
      .then((d) => setList(d.requests))
      .catch((e) => setError((e as Error).message));
  }, []);
  useEffect(() => {
    load();
    const iv = setInterval(load, 20_000);
    return () => clearInterval(iv);
  }, [load]);

  const decide = async (r: SubRequest, approve: boolean) => {
    setBusy(r.id);
    setError('');
    try {
      const d = await adm<{ request: SubRequest }>('requests.decide', { id: r.id, userId: r.userId, approve, note: approve ? undefined : note });
      setList((l) => l?.map((x) => (x.id === r.id ? d.request : x)) ?? null);
      setRejecting(null);
      setNote('');
    } catch (e) {
      setError((e as Error).message);
      load();
    } finally {
      setBusy(null);
    }
  };

  const currency = app.plans?.currency ?? 'IQD';
  const shown = (list ?? []).filter((r) => (filter === 'all' ? r.note !== 'Replaced by a new request' : r.status === filter && r.note !== 'Replaced by a new request'));
  const count = (f: Filter) => (list ?? []).filter((r) => r.status === f && r.note !== 'Replaced by a new request').length;

  return (
    <View style={{ gap: 12 }}>
      <Seg
        value={filter}
        onChange={setFilter}
        options={[
          { key: 'pending', label: `${tt('Pending')} · ${count('pending')}` },
          { key: 'approved', label: 'Approved' },
          { key: 'rejected', label: 'Rejected' },
          { key: 'all', label: 'All' },
        ]}
      />
      {error ? <Txt size={Type.small} color="#E5484D">{error}</Txt> : null}
      {!list ? (
        <ActivityIndicator color={p.primary} style={{ marginTop: 40 }} />
      ) : !shown.length ? (
        <EmptyState icon={Inbox} title={filter === 'pending' ? 'No pending requests' : 'Nothing here'} text="New subscription requests from students appear here instantly." />
      ) : (
        shown.map((r) => (
          <Card key={r.id} style={{ padding: 16, gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Txt weight="semibold">{r.name}</Txt>
                <Txt muted size={Type.tiny} numberOfLines={1}>{r.email}</Txt>
                <Txt faint size={Type.tiny}>{tt('Stage')} {STAGE_SHORT[r.stageId] ?? ''} · {fmtDate(r.createdAt)}</Txt>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 6 }}>
                <PlanBadge plan={r.plan} />
                <Txt weight="medium" size={Type.small}>{formatPrice(r.price, currency)}</Txt>
              </View>
            </View>
            {r.status === 'pending' ? (
              rejecting === r.id ? (
                <View style={{ gap: 8 }}>
                  <TextInput
                    value={note}
                    onChangeText={setNote}
                    placeholder={tt('Reason (optional, the student sees it)')}
                    placeholderTextColor={p.textFaint}
                    style={[styles.note, { borderColor: p.border, color: p.text, fontFamily: Font.regular }]}
                  />
                  <View style={styles.row}>
                    <Btn label="Back" onPress={() => setRejecting(null)} />
                    <Btn label="Reject request" color={Brand.danger} solid busy={busy === r.id} onPress={() => decide(r, false)} />
                  </View>
                </View>
              ) : (
                <View style={styles.row}>
                  <Btn label="Reject" icon={X} onPress={() => setRejecting(r.id)} />
                  <Btn label="Approve" icon={Check} color={Brand.success} solid busy={busy === r.id} onPress={() => decide(r, true)} />
                </View>
              )
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Tag label={r.status === 'approved' ? 'Approved' : 'Rejected'} color={r.status === 'approved' ? Brand.success : Brand.danger} />
                {r.decidedBy ? <Txt faint size={Type.tiny}>{tt('by')} {r.decidedBy}{r.decidedAt ? ` · ${fmtDate(r.decidedAt)}` : ''}</Txt> : null}
                {r.note ? <Txt muted size={Type.tiny} style={{ width: '100%' }}>{r.note}</Txt> : null}
              </View>
            )}
          </Card>
        ))
      )}
    </View>
  );
}

function Btn({ label, onPress, icon, color, solid, busy }: { label: string; onPress: () => void; icon?: typeof Check; color?: string; solid?: boolean; busy?: boolean }) {
  const { palette: p } = useApp();
  const c = color ?? p.text;
  return (
    <Pressable
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => [styles.btn, solid ? { backgroundColor: c } : { borderWidth: 1, borderColor: p.border }, pressed && { opacity: 0.85 }]}>
      {busy ? <ActivityIndicator size="small" color="#fff" /> : icon ? <Icon as={icon} size={16} color={solid ? '#fff' : c} /> : null}
      <Txt weight="semibold" size={Type.small} color={solid ? '#fff' : c}>{label}</Txt>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  btn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: 999 },
  note: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14 },
});
