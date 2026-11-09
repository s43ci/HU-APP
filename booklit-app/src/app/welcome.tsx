import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ArrowRight, CircleAlert, Eye, EyeOff, LogIn } from 'lucide-react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Field } from '@/components/field';
import { Button, Chip, Heading, Icon, Txt } from '@/components/ui';
import { Font, Type } from '@/constants/theme';
import { stages } from '@/data/content';
import type { StageId } from '@/data/types';
import { useApp } from '@/store/app-store';
import { IS_AR, setLanguage, t as tt } from '@/i18n';

export default function Welcome() {
  const insets = useSafeAreaInsets();
  const { set, signIn, signUp, palette: p } = useApp();
  const [mode, setMode] = useState<'signup' | 'login'>('signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [stageId, setStageId] = useState<StageId>('stage5');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const valid = emailOk && password.length >= (mode === 'signup' ? 8 : 1) && (mode === 'login' || name.trim().length >= 2);

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError('');
    try {
      if (mode === 'signup') await signUp({ email: email.trim(), password, name: name.trim(), stageId });
      else await signIn(email.trim(), password);
      router.replace('/');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

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

        <View style={[styles.seg, { backgroundColor: p.surface, marginTop: 30 }]}>
          {(['signup', 'login'] as const).map((m) => (
            <Pressable key={m} onPress={() => { setMode(m); setError(''); }} style={[styles.segBtn, mode === m && { backgroundColor: p.ink }]}>
              <Txt weight="semibold" size={Type.small} color={mode === m ? p.onInk : p.textMuted}>{m === 'signup' ? 'Create account' : 'Sign in'}</Txt>
            </Pressable>
          ))}
        </View>

        <View style={{ gap: 14, marginTop: 18 }}>
          {mode === 'signup' ? <Field label="Full name" value={name} onChangeText={setName} placeholder={tt('e.g. Ahmed Ali')} autoCapitalize="words" textContentType="name" /> : null}
          <Field label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" textContentType="emailAddress" autoComplete="email" />
          <View>
            <Field
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder={mode === 'signup' ? tt('At least 8 characters') : '••••••••'}
              secureTextEntry={!show}
              textContentType={mode === 'signup' ? 'newPassword' : 'password'}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              onSubmitEditing={submit}
              style={{ paddingEnd: 50 }}
            />
            <Pressable onPress={() => setShow(!show)} hitSlop={8} style={styles.eye} accessibilityLabel={tt(show ? 'Hide password' : 'Show password')}>
              <Icon as={show ? EyeOff : Eye} size={18} color={p.textMuted} />
            </Pressable>
          </View>
          {mode === 'signup' ? (
            <>
              <Txt weight="medium" size={Type.tiny} muted style={{ marginStart: 4, marginTop: 4 }}>Stage</Txt>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {stages.map((s) => (
                  <Chip key={s.id} label={s.name} active={stageId === s.id} onPress={() => setStageId(s.id)} />
                ))}
              </View>
            </>
          ) : null}
          {error ? (
            <View style={[styles.error, { backgroundColor: p.dangerSoft }]}>
              <Icon as={CircleAlert} size={16} color="#E5484D" />
              <Txt size={Type.small} color="#B4363A" style={{ flex: 1, lineHeight: 19 }}>{error}</Txt>
            </View>
          ) : null}
        </View>

        <View style={{ flex: 1, minHeight: 30 }} />
        <Button
          label={busy ? (mode === 'signup' ? 'Creating your account…' : 'Signing in…') : mode === 'signup' ? 'Create account' : 'Sign in'}
          icon={mode === 'signup' ? ArrowRight : LogIn}
          variant="primary"
          disabled={!valid || busy}
          onPress={submit}
        />
        <Pressable onPress={() => { setMode(mode === 'signup' ? 'login' : 'signup'); setError(''); }} style={{ alignSelf: 'center', marginTop: 14, padding: 6 }}>
          <Txt size={Type.small} muted>{mode === 'signup' ? 'Already have an account? Sign in' : 'New to Booklit? Create an account'}</Txt>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { width: 44, height: 44, borderRadius: 13, overflow: 'hidden', backgroundColor: '#fff' },
  seg: { flexDirection: 'row', borderRadius: 999, padding: 4 },
  segBtn: { flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: 999 },
  eye: { position: 'absolute', end: 16, bottom: 13 },
  error: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', padding: 12, borderRadius: 16 },
});
