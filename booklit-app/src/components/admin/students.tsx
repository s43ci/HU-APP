import { Ban, Search, ShieldCheck, Users, X } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Brand, Font, Type } from '@/constants/theme';
import { t as tt } from '@/i18n';
import type { Account } from '@/lib/api';
import { useApp } from '@/store/app-store';
import { Button, Card, EmptyState, Icon, Txt } from '../ui';
import { adm, confirm, fmtDate, PlanBadge, Seg, STAGE_SHORT, Tag } from './common';

type Filter = 'all' | 'free' | 'pro' | 'premium' | 'blocked';

export function Students() {
  const { palette: p } = useApp();
  const [list, setList] = useState<Account[] | null>(null);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [open, setOpen] = useState<Account | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    adm<{ users: Account[] }>('users.list')
      .then((d) => setList(d.users))
      .catch((e) => setError((e as Error).message));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (list ?? []).filter((u) => {
      if (filter === 'blocked' ? !u.blocked : filter !== 'all' && u.plan !== filter) return false;
      return !s || u.name.toLowerCase().includes(s) || u.email.toLowerCase().includes(s);
    });
  }, [list, q, filter]);

  const replace = (u: Account) => {
    setList((l) => l?.map((x) => (x.id === u.id ? u : x)) ?? null);
    setOpen(u);
  };

  return (
    <View style={{ gap: 12 }}>
      <View style={[styles.search, { backgroundColor: p.surface, borderColor: p.border }]}>
        <Icon as={Search} size={17} color={p.textMuted} />
        <TextInput value={q} onChangeText={setQ} placeholder={tt('Search by name or email')} placeholderTextColor={p.textFaint} style={[styles.input, { color: p.text, fontFamily: Font.regular }]} autoCapitalize="none" />
      </View>
      <Seg
        value={filter}
        onChange={setFilter}
        options={[
          { key: 'all', label: `${tt('All')} · ${list?.length ?? 0}` },
          { key: 'free', label: 'Free' },
          { key: 'pro', label: 'Pro' },
          { key: 'premium', label: 'Premium' },
          { key: 'blocked', label: 'Blocked' },
        ]}
      />
      {error ? <Txt size={Type.small} color="#E5484D">{error}</Txt> : null}
      {!list ? (
        <ActivityIndicator color={p.primary} style={{ marginTop: 40 }} />
      ) : !shown.length ? (
        <EmptyState icon={Users} title="No students found" text="Students appear here as soon as they create an account." />
      ) : (
        <Card style={{ paddingHorizontal: 14 }}>
          {shown.map((u, i) => (
            <Pressable key={u.id} onPress={() => setOpen(u)} style={({ pressed }) => [styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: p.border }, pressed && { opacity: 0.6 }]}>
              <View style={[styles.avatar, { backgroundColor: p.primarySoft }]}>
                <Txt weight="semibold" size={Type.small} color={p.primary}>{(u.name || u.email).slice(0, 1).toUpperCase()}</Txt>
              </View>
              <View style={{ flex: 1 }}>
                <Txt weight="medium" numberOfLines={1}>{u.name || '—'}</Txt>
                <Txt faint size={Type.tiny} numberOfLines={1}>{u.email}</Txt>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                {u.blocked ? <Tag label="Blocked" color={Brand.danger} /> : <PlanBadge plan={u.plan} />}
                <Txt faint size={10.5}>{tt('Stage')} {STAGE_SHORT[u.stageId] ?? ''}</Txt>
              </View>
            </Pressable>
          ))}
        </Card>
      )}
      <StudentSheet user={open} onClose={() => setOpen(null)} onChange={replace} />
    </View>
  );
}

function StudentSheet({ user, onClose, onChange }: { user: Account | null; onClose: () => void; onChange: (u: Account) => void }) {
  const { palette: p } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!user) return null;

  const run = async (params: Record<string, unknown>) => {
    setBusy(true);
    setError('');
    try {
      const d = await adm<{ user: Account }>('users.update', { id: user.id, ...params });
      onChange(d.user);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: p.bg }]}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Txt weight="semibold" size={Type.h2}>{user.name || '—'}</Txt>
              <Txt muted size={Type.small} selectable>{user.email}</Txt>
            </View>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <Icon as={X} size={20} />
            </Pressable>
          </View>

          <Card style={{ padding: 14, gap: 6, marginTop: 14 }}>
            <Line k="Stage" v={STAGE_SHORT[user.stageId] ?? user.stageId} />
            <Line k="Joined" v={fmtDate(user.createdAt)} />
            <Line k="Last sign-in" v={user.lastSignIn ? fmtDate(user.lastSignIn) : '—'} />
            <Line k="Plan" v={user.plan === 'free' ? tt('Free') : `${user.plan === 'pro' ? 'Pro' : 'Premium'}${user.planUntil ? ` · ${tt('until')} ${fmtDate(user.planUntil)}` : ''}`} />
          </Card>

          <Txt weight="semibold" style={{ marginTop: 16, marginBottom: 8 }}>Change plan</Txt>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(['free', 'pro', 'premium'] as const).map((k) => (
              <Pressable
                key={k}
                disabled={busy || user.plan === k}
                onPress={async () => {
                  if (await confirm(k === 'free' ? 'Remove the subscription?' : `Activate ${k === 'pro' ? 'Pro' : 'Premium'}?`, user.name)) void run({ plan: k });
                }}
                style={[styles.planBtn, { borderColor: user.plan === k ? p.primary : p.border, backgroundColor: user.plan === k ? p.primarySoft : p.surface }]}>
                <Txt weight="semibold" size={Type.small} color={user.plan === k ? p.primary : p.text}>{k === 'free' ? 'Free' : k === 'pro' ? 'Pro' : 'Premium'}</Txt>
              </Pressable>
            ))}
          </View>

          {error ? <Txt size={Type.small} color="#E5484D" style={{ marginTop: 10 }}>{error}</Txt> : null}
          <Button
            label={user.blocked ? 'Unblock account' : 'Block account'}
            icon={user.blocked ? ShieldCheck : Ban}
            variant={user.blocked ? 'primary' : 'danger'}
            style={{ marginTop: 18 }}
            disabled={busy}
            onPress={async () => {
              if (await confirm(user.blocked ? 'Unblock this account?' : 'Block this account?', user.blocked ? '' : 'The student is signed out and cannot sign in again until you unblock them.', user.blocked ? 'Unblock' : 'Block', !user.blocked))
                void run({ blocked: !user.blocked });
            }}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Line({ k, v }: { k: string; v: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
      <Txt muted size={Type.small}>{k}</Txt>
      <Txt weight="medium" size={Type.small}>{v}</Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 999, paddingHorizontal: 16 },
  input: { flex: 1, paddingVertical: 12, fontSize: 14.5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  backdrop: { flex: 1, backgroundColor: 'rgba(10,10,20,0.45)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22, paddingBottom: 36, maxWidth: 640, width: '100%', alignSelf: 'center' },
  planBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 16, borderWidth: 1.5 },
});
