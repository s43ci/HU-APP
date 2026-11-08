import { router, useLocalSearchParams } from 'expo-router';
import { BookOpen, Check, Crown, LogOut, Monitor, Moon, PenLine, RotateCcw, Send, ShieldCheck, Sun, Wand2 } from 'lucide-react-native';
import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';

import { Field } from '@/components/field';
import { Button, Card, Chip, EmptyState, Icon, SubjectThumb, TopBar, Txt } from '@/components/ui';
import { ADMIN_CODE, Font, TELEGRAM_URL, Type } from '@/constants/theme';
import type { Role } from '@/data/annotations';
import { getBooklet, getSubject, getTopic, stages } from '@/data/content';
import type { StageId } from '@/data/types';
import { useApp, type Appearance } from '@/store/app-store';

const TITLES: Record<string, string> = {
  account: 'Account & plan',
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
        {key === 'password' ? (
          <Card style={{ padding: 18, gap: 6 }}>
            <Txt weight="semibold">Account security</Txt>
            <Txt muted size={Type.small} style={{ lineHeight: 20 }}>
              Password changes arrive with BOOKLIT accounts on the server. Until then your data stays on this device only.
            </Txt>
          </Card>
        ) : null}
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
              <Pressable key={l} onPress={() => app.set({ language: l })} style={[styles.option, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: p.border }]}>
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

const PLANS: { role: Exclude<Role, 'admin'>; title: string; text: string; icon: typeof Crown }[] = [
  { role: 'pro', title: 'Pro', text: 'Read every booklet, MCQs, quizzes, Ask AI, highlights, notes and drawing.', icon: BookOpen },
  { role: 'premium', title: 'Premium', text: 'Everything in Pro, plus editing the design of booklets.', icon: PenLine },
];

function Account() {
  const app = useApp();
  const p = app.palette;
  const [code, setCode] = useState('');
  const [wrong, setWrong] = useState(false);
  const isAdmin = app.role === 'admin';

  return (
    <View style={{ gap: 12 }}>
      <Card style={{ padding: 16, gap: 4 }}>
        <Txt faint size={Type.tiny}>Current plan</Txt>
        <Txt weight="semibold" size={Type.title}>{isAdmin ? 'Admin' : app.role === 'premium' ? 'Premium' : 'Pro'}</Txt>
        <Txt muted size={Type.tiny} style={{ lineHeight: 17 }}>
          {isAdmin ? 'You can upload, design and publish booklets in BOOKLIT Studio.' : 'Plans are activated by the BOOKLIT team after payment.'}
        </Txt>
      </Card>

      {!isAdmin ? (
        <>
          <Txt weight="semibold" style={{ marginTop: 6 }}>Plans</Txt>
          {PLANS.map((pl) => {
            const on = app.role === pl.role;
            return (
              <Pressable key={pl.role} onPress={() => app.set({ role: pl.role })} style={[styles.plan, { backgroundColor: p.surface, borderColor: on ? p.primary : 'transparent' }]}>
                <View style={[styles.planIcon, { backgroundColor: on ? p.primary : p.primarySoft }]}>
                  <Icon as={pl.icon} size={18} color={on ? '#fff' : p.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Txt weight="semibold">{pl.title}</Txt>
                  <Txt muted size={Type.tiny} style={{ lineHeight: 17 }}>{pl.text}</Txt>
                </View>
                {on ? <Icon as={Check} size={18} color={p.primary} /> : null}
              </Pressable>
            );
          })}
          <Txt faint size={Type.tiny} style={{ lineHeight: 17 }}>
            Switching plans here is for testing. When accounts move to the BOOKLIT server, your plan is set by the admin.
          </Txt>
        </>
      ) : null}

      <Txt weight="semibold" style={{ marginTop: 10 }}>BOOKLIT team</Txt>
      {isAdmin ? (
        <View style={{ gap: 8 }}>
          <Button label="Open BOOKLIT Studio" icon={Wand2} variant="primary" onPress={() => router.push('/studio')} />
          <Button label="Leave admin mode" icon={LogOut} variant="outline" onPress={() => app.set({ role: app.planBeforeAdmin })} />
        </View>
      ) : (
        <Card style={{ padding: 14, gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Icon as={ShieldCheck} size={18} color={p.primary} />
            <Txt weight="medium" size={Type.small}>Admin access code</Txt>
          </View>
          <TextInput
            value={code}
            onChangeText={(t) => { setCode(t); setWrong(false); }}
            secureTextEntry
            placeholder="Enter code"
            placeholderTextColor={p.textFaint}
            style={[styles.code, { color: p.text, borderColor: wrong ? '#E5484D' : p.border, fontFamily: Font.regular }]}
          />
          {wrong ? <Txt size={Type.tiny} color="#E5484D">Wrong code.</Txt> : null}
          <Button
            label="Unlock Studio"
            icon={Crown}
            disabled={!code}
            onPress={() => {
              if (code.trim() === ADMIN_CODE) {
                app.set({ planBeforeAdmin: app.role, role: 'admin' });
                setCode('');
              } else setWrong(true);
            }}
          />
        </Card>
      )}
    </View>
  );
}

function EditProfile() {
  const app = useApp();
  const [name, setName] = useState(app.profile?.name ?? '');
  const [email, setEmail] = useState(app.profile?.email ?? '');
  const [stageId, setStageId] = useState<StageId>(app.profile?.stageId ?? 'stage5');
  return (
    <View style={{ gap: 14 }}>
      <Field label="Full name" value={name} onChangeText={setName} autoCapitalize="words" />
      <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
      <Txt weight="medium" size={Type.tiny} muted style={{ marginLeft: 4 }}>Stage</Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {stages.map((s) => (
          <Chip key={s.id} label={s.name} active={stageId === s.id} onPress={() => setStageId(s.id)} />
        ))}
      </View>
      <Button
        label="Save"
        icon={Check}
        variant="primary"
        disabled={name.trim().length < 2}
        style={{ marginTop: 8 }}
        onPress={() => {
          app.set({ profile: { name: name.trim(), email: email.trim(), stageId } });
          router.back();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  plan: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 20, borderWidth: 1.5 },
  planIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  code: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 11, fontSize: 15 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 15, paddingHorizontal: 10 },
  recent: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 20 },
});
