import { router, useLocalSearchParams } from 'expo-router';
import { Check, KeyRound, Monitor, Moon, RotateCcw, Send, Sun } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { Field } from '@/components/field';
import { Button, Card, Chip, EmptyState, Icon, SubjectThumb, TopBar, Txt } from '@/components/ui';
import { TELEGRAM_URL, Type } from '@/constants/theme';
import { Plans } from '@/components/plans';
import { api, type Account as AccountT, type Session } from '@/lib/api';
import { getBooklet, getSubject, getTopic, stages } from '@/data/content';
import type { StageId } from '@/data/types';
import { useApp, type Appearance } from '@/store/app-store';
import { setLanguage, t as tt } from '@/i18n';

const TITLES: Record<string, string> = {
  account: 'Subscription',
  'edit-profile': 'Edit profile',
  password: 'Change password',
  notifications: 'Notifications',
  appearance: 'Appearance',
  language: 'Language',
  recent: 'Recently viewed',
  help: 'Help & support',
  about: 'About Booklit',
};

export default function Settings() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const app = useApp();
  const p = app.palette;
  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <TopBar title={TITLES[key] ?? 'Settings'} />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 40 }}>
        {key === 'account' ? <Account /> : null}
        {key === 'edit-profile' ? <EditProfile /> : null}
        {key === 'password' ? <Password /> : null}
        {key === 'notifications' ? (
          <Card style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Txt weight="medium">Study reminders & updates</Txt>
              <Txt faint size={Type.tiny}>New booklets, MCQs and announcements</Txt>
            </View>
            <Switch value={app.notifications} onValueChange={(v) => app.set({ notifications: v })} trackColor={{ true: p.primary }} />
          </Card>
        ) : null}
        {key === 'appearance' ? (
          <Card style={{ paddingHorizontal: 8 }}>
            {([['system', Monitor], ['light', Sun], ['dark', Moon]] as const).map(([a, I], i) => (
              <Pressable key={a} onPress={() => app.set({ appearance: a as Appearance })} style={[styles.option, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: p.border }]}>
                <Icon as={I} size={18} />
                <Txt weight="medium" style={{ flex: 1 }}>{a[0].toUpperCase() + a.slice(1)}</Txt>
                {app.appearance === a ? <Icon as={Check} size={18} color={p.primary} /> : null}
              </Pressable>
            ))}
          </Card>
        ) : null}
        {key === 'language' ? (
          <Card style={{ paddingHorizontal: 8 }}>
            {(['English', 'العربية'] as const).map((l, i) => (
              <Pressable
                key={l}
                onPress={() => {
                  app.set({ language: l });
                  // Restart in the chosen language (Arabic switches the whole app to right-to-left).
                  setTimeout(() => void setLanguage(l === 'العربية' ? 'ar' : 'en'), 400);
                }}
                style={[styles.option, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: p.border }]}>
                <Txt weight="medium" style={{ flex: 1 }}>{l}</Txt>
                {app.language === l ? <Icon as={Check} size={18} color={p.primary} /> : null}
              </Pressable>
            ))}
          </Card>
        ) : null}
        {key === 'recent' ? (
          app.recent.filter((id) => getTopic(id)).length ? (
            app.recent.map((id) => {
              const t = getTopic(id);
              const b = t && getBooklet(t.bookletId);
              const s = b && getSubject(b.subjectId);
              if (!t || !b || !s) return null;
              return (
                <Card key={id} style={styles.recent} onPress={() => router.push({ pathname: '/reader/[topicId]', params: { topicId: id } })}>
                  <SubjectThumb subjectId={s.id} size={44} radius={14} />
                  <View style={{ flex: 1 }}>
                    <Txt weight="medium" numberOfLines={1}>{t.title}</Txt>
                    <Txt faint size={Type.tiny} numberOfLines={1}>{s.name} · {b.title}</Txt>
                  </View>
                </Card>
              );
            })
          ) : (
            <EmptyState icon={RotateCcw} title="Nothing yet" text="Topics you open will appear here." />
          )
        ) : null}
        {key === 'help' ? (
          <Card style={{ padding: 18, gap: 10 }}>
            <Txt weight="semibold">Need help?</Txt>
            <Txt muted size={Type.small} style={{ lineHeight: 20 }}>Message the BOOKLIT team on Telegram about subscriptions, access or content.</Txt>
            <Button label="Contact on Telegram" icon={Send} variant="primary" onPress={() => Linking.openURL(TELEGRAM_URL)} />
          </Card>
        ) : null}
        {key === 'about' ? (
          <Card style={{ padding: 18, gap: 6 }}>
            <Txt weight="semibold" size={Type.title}>Booklit</Txt>
            <Txt faint size={Type.tiny}>Version 1.0.0</Txt>
            <Txt muted size={Type.small} style={{ lineHeight: 21, marginTop: 6 }}>
              Structured dental booklets, ministry and instructor MCQs, quizzes, Ask AI and progress tracking, made by the BOOKLIT Studio team.
            </Txt>
          </Card>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Account() {
  const app = useApp();
  // Fresh plan, prices and request status every time the page opens.
  useEffect(() => {
    void app.sync();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return <Plans />;
}

function EditProfile() {
  const app = useApp();
  const [name, setName] = useState(app.profile?.name ?? '');
  const [stageId, setStageId] = useState<StageId>(app.profile?.stageId ?? 'stage5');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <View style={{ gap: 14 }}>
      <Field label="Full name" value={name} onChangeText={setName} autoCapitalize="words" />
      <Field label="Email" value={app.profile?.email ?? ''} editable={false} style={{ opacity: 0.6 }} />
      <Txt weight="medium" size={Type.tiny} muted style={{ marginStart: 4 }}>Stage</Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {stages.map((s) => (
          <Chip key={s.id} label={s.name} active={stageId === s.id} onPress={() => setStageId(s.id)} />
        ))}
      </View>
      {error ? <Txt size={Type.small} color="#E5484D">{error}</Txt> : null}
      <Button
        label={busy ? 'Saving…' : 'Save'}
        icon={Check}
        variant="primary"
        disabled={name.trim().length < 2 || busy}
        style={{ marginTop: 8 }}
        onPress={async () => {
          setBusy(true);
          setError('');
          try {
            const r = await api<{ account: AccountT }>('/api/me', { method: 'PATCH', body: { name: name.trim(), stageId } });
            app.setAccount(r.account);
            router.back();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      />
    </View>
  );
}

function Password() {
  const app = useApp();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <View style={{ gap: 14 }}>
      <Field label="Current password" value={current} onChangeText={setCurrent} secureTextEntry autoComplete="current-password" />
      <Field label="New password" value={next} onChangeText={setNext} secureTextEntry placeholder={tt('At least 8 characters')} autoComplete="new-password" />
      {msg ? <Txt size={Type.small} color={msg.ok ? '#1F9D55' : '#E5484D'}>{msg.text}</Txt> : null}
      <Button
        label={busy ? 'Saving…' : 'Change password'}
        icon={KeyRound}
        variant="primary"
        disabled={!current || next.length < 8 || busy}
        onPress={async () => {
          setBusy(true);
          setMsg(null);
          try {
            const r = await api<{ account: AccountT; session: Session }>('/api/auth', { body: { action: 'password', current, next } });
            app.setAccount(r.account, r.session);
            setCurrent('');
            setNext('');
            setMsg({ ok: true, text: tt('Password changed.') });
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
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 15, paddingHorizontal: 10 },
  recent: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 20 },
});
