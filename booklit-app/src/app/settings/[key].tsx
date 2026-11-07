import { router, useLocalSearchParams } from 'expo-router';
import { Check, Monitor, Moon, RotateCcw, Send, Sun } from 'lucide-react-native';
import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { Field } from '@/components/field';
import { Button, Card, Chip, EmptyState, Icon, SubjectThumb, TopBar, Txt } from '@/components/ui';
import { TELEGRAM_URL, Type } from '@/constants/theme';
import { getBooklet, getSubject, getTopic, stages } from '@/data/content';
import type { StageId } from '@/data/types';
import { useApp, type Appearance } from '@/store/app-store';

const TITLES: Record<string, string> = {
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
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 15, paddingHorizontal: 10 },
  recent: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 20 },
});
