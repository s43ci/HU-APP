import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { Field } from '@/components/field';
import { ScreenBar } from '@/components/screen-bar';
import { Button, Card, Chip, EmptyState, Icon, SubjectArt, Txt } from '@/components/ui';
import { TELEGRAM_URL } from '@/constants/theme';
import { getBooklet, getSubject, getTopic, stages } from '@/data/content';
import type { StageId } from '@/data/types';
import { useApp, type Appearance } from '@/store/app-store';

const TITLES: Record<string, string> = {
  'edit-profile': 'Edit Profile',
  password: 'Change Password',
  notifications: 'Notifications',
  appearance: 'Appearance',
  language: 'Language',
  recent: 'Recently Viewed',
  help: 'Help & Support',
  about: 'About Booklit',
};

export default function Settings() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const app = useApp();
  const p = app.palette;
  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <ScreenBar title={TITLES[key] ?? 'Settings'} />
      <ScrollView contentContainerStyle={{ padding: 18, gap: 14, paddingBottom: 40 }}>
        {key === 'edit-profile' ? <EditProfile /> : null}
        {key === 'password' ? (
          <Card style={{ padding: 18, gap: 8 }}>
            <Txt weight="bold" size={16}>Account security</Txt>
            <Txt muted style={{ lineHeight: 21 }}>
              Password changes will be available when accounts move to the BOOKLIT server. Until then your data stays on this device.
            </Txt>
          </Card>
        ) : null}
        {key === 'notifications' ? (
          <Card style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Txt weight="semibold">Study reminders & updates</Txt>
              <Txt muted size={13}>New booklets, MCQs and announcements</Txt>
            </View>
            <Switch value={app.notifications} onValueChange={(v) => app.set({ notifications: v })} trackColor={{ true: p.primary }} />
          </Card>
        ) : null}
        {key === 'appearance' ? (
          <Card style={{ paddingHorizontal: 6 }}>
            {(['system', 'light', 'dark'] as Appearance[]).map((a, i) => (
              <Pressable key={a} onPress={() => app.set({ appearance: a })} style={[styles.option, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: p.border }]}>
                <Icon name={a === 'system' ? 'cellphone' : a === 'light' ? 'white-balance-sunny' : 'moon-waning-crescent'} />
                <Txt weight="semibold" style={{ flex: 1 }}>{a[0].toUpperCase() + a.slice(1)}</Txt>
                {app.appearance === a ? <Icon name="check" color={p.primary} /> : null}
              </Pressable>
            ))}
          </Card>
        ) : null}
        {key === 'language' ? (
          <Card style={{ paddingHorizontal: 6 }}>
            {(['English', 'العربية'] as const).map((l, i) => (
              <Pressable key={l} onPress={() => app.set({ language: l })} style={[styles.option, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: p.border }]}>
                <Txt weight="semibold" style={{ flex: 1 }}>{l}</Txt>
                {app.language === l ? <Icon name="check" color={p.primary} /> : null}
              </Pressable>
            ))}
          </Card>
        ) : null}
        {key === 'recent' ? (
          app.recent.length ? (
            app.recent.map((id) => {
              const t = getTopic(id);
              const b = t && getBooklet(t.bookletId);
              const s = b && getSubject(b.subjectId);
              if (!t || !b || !s) return null;
              return (
                <Card key={id} style={styles.recent} onPress={() => router.push({ pathname: '/reader/[topicId]', params: { topicId: id } })}>
                  <SubjectArt color={s.color} icon={s.icon} size={48} />
                  <View style={{ flex: 1 }}>
                    <Txt weight="bold">{t.title}</Txt>
                    <Txt muted size={13} numberOfLines={1}>{s.name} · {b.title}</Txt>
                  </View>
                  <Icon name="chevron-right" />
                </Card>
              );
            })
          ) : (
            <EmptyState icon="history" title="Nothing yet" text="Topics you open will appear here." />
          )
        ) : null}
        {key === 'help' ? (
          <Card style={{ padding: 18, gap: 10 }}>
            <Txt weight="bold" size={16}>Need help?</Txt>
            <Txt muted style={{ lineHeight: 21 }}>Message the BOOKLIT team on Telegram for subscriptions, access or content issues.</Txt>
            <Button label="Contact on Telegram" icon="send" onPress={() => Linking.openURL(TELEGRAM_URL)} />
          </Card>
        ) : null}
        {key === 'about' ? (
          <Card style={{ padding: 18, gap: 8 }}>
            <Txt weight="extrabold" size={22}>Booklit</Txt>
            <Txt muted>Version 1.0.0</Txt>
            <Txt style={{ lineHeight: 22 }}>
              Booklit is a dental education platform: structured booklets, ministry and instructor MCQs, quizzes and progress tracking, made by the BOOKLIT Studio team.
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
      <Txt weight="semibold" size={14} muted>Stage</Txt>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {stages.map((s) => (
          <Chip key={s.id} label={s.name} active={stageId === s.id} onPress={() => setStageId(s.id)} />
        ))}
      </View>
      <Button
        label="Save"
        icon="check"
        style={{ marginTop: 8 }}
        onPress={() => {
          if (name.trim().length < 2) return;
          app.set({ profile: { name: name.trim(), email: email.trim(), stageId } });
          router.back();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, paddingHorizontal: 12 },
  recent: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
});
