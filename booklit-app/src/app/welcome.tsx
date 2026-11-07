import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Field } from '@/components/field';
import { Button, Chip, Txt } from '@/components/ui';
import { Font, HeaderGradient } from '@/constants/theme';
import { stages } from '@/data/content';
import type { StageId } from '@/data/types';
import { useApp } from '@/store/app-store';

export default function Welcome() {
  const insets = useSafeAreaInsets();
  const { set, palette: p } = useApp();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [stageId, setStageId] = useState<StageId>('stage5');
  const valid = name.trim().length >= 2;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: p.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <LinearGradient colors={HeaderGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.hero, { paddingTop: insets.top + 40 }]}>
          <View style={styles.logoTile}>
            <Image source={require('@/assets/images/logo-mark.png')} style={{ width: 96, height: 96 }} />
          </View>
          <Txt color="#fff" style={{ fontFamily: Font.bold, fontSize: 38, marginTop: 18 }}>
            Booklit
          </Txt>
          <Txt color="rgba(255,255,255,0.85)" size={15} style={{ marginTop: 6, textAlign: 'center' }}>
            Your dental booklets, MCQs and progress in one place.
          </Txt>
        </LinearGradient>

        <View style={{ padding: 20, gap: 14 }}>
          <Field label="Full name" value={name} onChangeText={setName} placeholder="e.g. Ahmed Ali" />
          <Field label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" />
          <Txt weight="semibold" size={14} muted>
            Stage
          </Txt>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {stages.map((s) => (
              <Chip key={s.id} label={s.name} active={stageId === s.id} onPress={() => setStageId(s.id)} />
            ))}
          </View>
          <Button
            label="Start studying"
            icon="arrow-right"
            style={{ marginTop: 10, opacity: valid ? 1 : 0.5 }}
            onPress={() => {
              if (!valid) return;
              set({ profile: { name: name.trim(), email: email.trim(), stageId } });
              router.replace('/');
            }}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingBottom: 40, paddingHorizontal: 24, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  logoTile: { width: 96, height: 96, borderRadius: 26, overflow: 'hidden', backgroundColor: '#fff' },
});
