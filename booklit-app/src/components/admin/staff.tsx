import { Check, KeyRound, ShieldPlus, Trash2, UserCog, X } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Field } from '@/components/field';
import { Brand, Type } from '@/constants/theme';
import { t as tt } from '@/i18n';
import { PERM_LABELS, type Account, type Perm } from '@/lib/api';
import { useApp } from '@/store/app-store';
import { Button, Card, EmptyState, Icon, Txt } from '../ui';
import { adm, confirm, Tag } from './common';

const ALL = Object.keys(PERM_LABELS) as Perm[];

const strongPassword = () => {
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let s = '';
  for (let i = 0; i < 14; i++) s += a[Math.floor(Math.random() * a.length)];
  return `${s.slice(0, 7)}-${s.slice(7)}`;
};

export function Staff() {
  const { palette: p } = useApp();
  const [list, setList] = useState<Account[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    adm<{ staff: Account[] }>('staff.list')
      .then((d) => setList(d.staff))
      .catch((e) => setError((e as Error).message));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const replace = (a: Account) => setList((l) => (l ? (a.kind === 'student' ? l.filter((x) => x.id !== a.id) : l.some((x) => x.id === a.id) ? l.map((x) => (x.id === a.id ? a : x)) : [...l, a]) : l));

  return (
    <View style={{ gap: 12 }}>
      <Card style={{ padding: 16, gap: 4 }}>
        <Txt weight="semibold">Moderators</Txt>
        <Txt muted size={Type.small} style={{ lineHeight: 20 }}>
          Give your team their own sign-in and choose exactly what each one can do. Only you (the admin) can add or remove moderators.
        </Txt>
      </Card>

      {error ? <Txt size={Type.small} color="#E5484D">{error}</Txt> : null}
      {!list ? (
        <ActivityIndicator color={p.primary} style={{ marginTop: 30 }} />
      ) : (
        <>
          {list.filter((x) => x.kind === 'staff').length === 0 && !adding ? (
            <EmptyState icon={UserCog} title="No moderators yet" text="Add a moderator to share the work: approving payments, uploading booklets and more." />
          ) : null}
          {list
            .filter((x) => x.kind === 'staff')
            .map((s) =>
              editing === s.id ? (
                <EditStaff key={s.id} staff={s} onDone={(a) => { if (a) replace(a); setEditing(null); }} />
              ) : (
                <Card key={s.id} style={{ padding: 16, gap: 10 }} onPress={() => setEditing(s.id)}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Txt weight="semibold">{s.name}</Txt>
                      <Txt muted size={Type.tiny} selectable>{s.email}</Txt>
                    </View>
                    {s.blocked ? <Tag label="Suspended" color={Brand.danger} /> : <Tag label="Moderator" color={p.primary} />}
                  </View>
                  <View style={styles.chips}>
                    {s.perms.length ? s.perms.map((k) => <Tag key={k} label={PERM_LABELS[k].title} color={p.textMuted} />) : <Txt faint size={Type.tiny}>No permissions</Txt>}
                  </View>
                </Card>
              ),
            )}
          {adding ? (
            <AddStaff onDone={(a) => { if (a) replace(a); setAdding(false); }} />
          ) : (
            <Button label="Add moderator" icon={ShieldPlus} variant="primary" onPress={() => setAdding(true)} />
          )}
        </>
      )}
    </View>
  );
}

function PermPicker({ value, onChange }: { value: Perm[]; onChange: (v: Perm[]) => void }) {
  const { palette: p } = useApp();
  return (
    <View style={{ gap: 8 }}>
      {ALL.map((k) => {
        const on = value.includes(k);
        return (
          <Pressable key={k} onPress={() => onChange(on ? value.filter((x) => x !== k) : [...value, k])} style={[styles.perm, { borderColor: on ? p.primary : p.border, backgroundColor: on ? p.primarySoft : 'transparent' }]}>
            <View style={[styles.box, { borderColor: on ? p.primary : p.border, backgroundColor: on ? p.primary : 'transparent' }]}>{on ? <Icon as={Check} size={12} color="#fff" stroke={2.6} /> : null}</View>
            <View style={{ flex: 1 }}>
              <Txt weight="medium" size={Type.small}>{PERM_LABELS[k].title}</Txt>
              <Txt faint size={Type.tiny}>{PERM_LABELS[k].text}</Txt>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function AddStaff({ onDone }: { onDone: (a: Account | null) => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState(strongPassword);
  const [perms, setPerms] = useState<Perm[]>(['requests']);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<Account | null>(null);

  if (created)
    return (
      <Card style={{ padding: 16, gap: 8 }}>
        <Txt weight="semibold" color={Brand.success}>Moderator added</Txt>
        <Txt muted size={Type.small}>Send these sign-in details to the moderator. They can change the password from their profile.</Txt>
        <Txt selectable size={Type.small}>{tt('Email')}: {created.email}</Txt>
        <Txt selectable size={Type.small}>{tt('Password')}: {password}</Txt>
        <Button label="Done" icon={Check} variant="primary" onPress={() => onDone(created)} />
      </Card>
    );

  return (
    <Card style={{ padding: 16, gap: 12 }}>
      <Txt weight="semibold">New moderator</Txt>
      <Field label="Full name" value={name} onChangeText={setName} autoCapitalize="words" />
      <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" placeholder="name@example.com" />
      <View>
        <Field label="Password" value={password} onChangeText={setPassword} />
        <Pressable onPress={() => setPassword(strongPassword())} hitSlop={8} style={styles.gen} accessibilityLabel={tt('New password')}>
          <Icon as={KeyRound} size={17} />
        </Pressable>
      </View>
      <Txt weight="medium" size={Type.tiny} muted style={{ marginStart: 4 }}>Permissions</Txt>
      <PermPicker value={perms} onChange={setPerms} />
      {error ? <Txt size={Type.small} color="#E5484D">{error}</Txt> : null}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button label="Cancel" icon={X} variant="outline" style={{ flex: 1 }} onPress={() => onDone(null)} />
        <Button
          label={busy ? 'Adding…' : 'Add'}
          icon={ShieldPlus}
          variant="primary"
          style={{ flex: 1 }}
          disabled={busy || name.trim().length < 2 || !email.includes('@') || password.length < 8}
          onPress={async () => {
            setBusy(true);
            setError('');
            try {
              const d = await adm<{ staff: Account }>('staff.create', { name, email, password, perms });
              setCreated(d.staff);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        />
      </View>
    </Card>
  );
}

function EditStaff({ staff, onDone }: { staff: Account; onDone: (a: Account | null) => void }) {
  const [perms, setPerms] = useState<Perm[]>(staff.perms);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = async (action: string, params: Record<string, unknown>) => {
    setBusy(true);
    setError('');
    try {
      const d = await adm<{ staff: Account }>(action, { id: staff.id, ...params });
      onDone(d.staff);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <Card style={{ padding: 16, gap: 12 }}>
      <View>
        <Txt weight="semibold">{staff.name}</Txt>
        <Txt muted size={Type.tiny} selectable>{staff.email}</Txt>
      </View>
      <PermPicker value={perms} onChange={setPerms} />
      <Field label="New password (optional)" value={password} onChangeText={setPassword} placeholder={tt('Leave empty to keep it')} />
      {error ? <Txt size={Type.small} color="#E5484D">{error}</Txt> : null}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button label="Cancel" variant="outline" style={{ flex: 1 }} onPress={() => onDone(null)} />
        <Button label={busy ? 'Saving…' : 'Save'} icon={Check} variant="primary" style={{ flex: 1 }} disabled={busy} onPress={() => run('staff.update', { perms, password: password || undefined })} />
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button
          label={staff.blocked ? 'Unsuspend' : 'Suspend'}
          variant="outline"
          style={{ flex: 1 }}
          disabled={busy}
          onPress={async () => {
            if (await confirm(staff.blocked ? 'Unsuspend this moderator?' : 'Suspend this moderator?', staff.name)) void run('staff.update', { blocked: !staff.blocked });
          }}
        />
        <Button
          label="Remove"
          icon={Trash2}
          variant="danger"
          style={{ flex: 1 }}
          disabled={busy}
          onPress={async () => {
            if (await confirm('Remove this moderator?', 'Their account loses all permissions and is suspended.', 'Remove', true)) void run('staff.remove', {});
          }}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  perm: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, borderWidth: 1.5 },
  box: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  gen: { position: 'absolute', end: 16, bottom: 13 },
});
