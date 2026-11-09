import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ArrowRight } from 'lucide-react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Field } from '@/components/field';
import { Button, Chip, Heading, Txt } from '@/components/ui';
import { Font, Type } from '@/constants/theme';
import { stages } from '@/data/content';
import type { StageId } from '@/data/types';
import { useApp } from '@/store/app-store';
import { IS_AR, setLanguage, t as tt } from '@/i18n';

export default function Welcome() {
  const insets = useSafeAreaInsets();
  const { set, palette: p } = useApp();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [stageId, setStageId] = useState<StageId>('stage5');
  const valid = name.trim().length >= 2;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: p.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24, paddingTop: insets.top + 36, paddingBottom: insets.bottom + 24 }} keyboardShouldPersistTaps="handled">
        <View style={styles.brand}>
          <View style={styles.logo}>
            <Image source={require('@/assets/images/logo-mark.png')} style={{ width: 44, height: 44 }} />
          </View>
          <Txt style={{ fontFamily: Font.semibold, fontSize: 20, flex: 1 }}>Booklit</Txt>
          <Chip
            label={IS_AR ? 'English' : 'العربية'}
            onPress={() => {
              set({ language: IS_AR ? 'English' : 'العربية' });
              void setLanguage(IS_AR ? 'en' : 'ar');
            }}
          />
        </View>

        <View style={{ marginTop: 40 }}>
          <Heading light="Your dental booklets," strong="in one calm place." size={30} />
          <Txt muted size={Type.small} style={{ marginTop: 12, lineHeight: 21 }}>
            Read your booklets, practice ministry and instructor MCQs, ask AI about any topic, and track your progress.
          </Txt>
        </View>

        <View style={{ gap: 14, marginTop: 34 }}>
          <Field label="Full name" value={name} onChangeText={setName} placeholder={tt('e.g. Ahmed Ali')} autoCapitalize="words" />
          <Field label="Email (optional)" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" />
          <Txt weight="medium" size={Type.tiny} muted style={{ marginLeft: 4, marginTop: 4 }}>Stage</Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {stages.map((s) => (
              <Chip key={s.id} label={s.name} active={stageId === s.id} onPress={() => setStageId(s.id)} />
            ))}
          </View>
        </View>

        <View style={{ flex: 1, minHeight: 30 }} />
        <Button
          label="Start studying"
          icon={ArrowRight}
          variant="primary"
          disabled={!valid}
          onPress={() => {
            set({ profile: { name: name.trim(), email: email.trim(), stageId } });
            router.replace('/');
          }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { width: 44, height: 44, borderRadius: 13, overflow: 'hidden', backgroundColor: '#fff' },
});
