import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import { CircleAlert, FilePlus2, FileText, FileUp, Image as ImageIcon, Presentation, ScrollText, Sparkles } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Heading, Icon, TopBar, Txt } from '@/components/ui';
import { Type } from '@/constants/theme';
import { UPLOADS_SUBJECT } from '@/data/content';
import { newBlankBooklet } from '@/lib/editor';
import { ACCEPTED_TYPES, convertFile, MAX_UPLOAD_MB } from '@/lib/import';
import { log } from '@/lib/log';
import { useApp } from '@/store/app-store';

const STEPS = ['Uploading your file', 'Reading the document', 'Organizing it into topics', 'Writing practice questions', 'Almost done'];

const FORMATS = [
  { icon: FileText, label: 'PDF' },
  { icon: ScrollText, label: 'Word' },
  { icon: Presentation, label: 'PowerPoint' },
  { icon: ImageIcon, label: 'Image' },
  { icon: FileText, label: 'Text' },
];

export default function ImportScreen() {
  const app = useApp();
  const p = app.palette;
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<{ phase: 'idle' | 'working' | 'error'; name?: string; error?: string; step: number }>({ phase: 'idle', step: 0 });
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    if (state.phase !== 'working') return;
    const iv = setInterval(() => setState((s) => (s.phase === 'working' ? { ...s, step: Math.min(STEPS.length - 1, s.step + 1) } : s)), 6000);
    return () => clearInterval(iv);
  }, [state.phase]);

  useEffect(() => () => abort.current?.abort(), []);

  const pick = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: ACCEPTED_TYPES, copyToCacheDirectory: true, multiple: false });
    if (res.canceled || !res.assets?.[0]) return;
    const asset = res.assets[0];
    if (asset.size && asset.size > MAX_UPLOAD_MB * 1024 * 1024) {
      setState({ phase: 'error', name: asset.name, error: `This file is larger than ${MAX_UPLOAD_MB} MB. Please upload a smaller file or split it.`, step: 0 });
      return;
    }
    setState({ phase: 'working', name: asset.name, step: 0 });
    abort.current = new AbortController();
    const timer = setTimeout(() => abort.current?.abort(), 5 * 60 * 1000);
    try {
      const { booklet } = await convertFile(asset, abort.current.signal);
      app.addImported(booklet);
      router.replace({ pathname: '/subject/[id]', params: { id: UPLOADS_SUBJECT.id, booklet: booklet.id } });
    } catch (e) {
      const msg = (e as Error).name === 'AbortError' ? 'The conversion took too long. Try a shorter file.' : (e as Error).message;
      if ((e as Error).name === 'AbortError') log('error', 'upload', 'Timed out or cancelled', { name: asset.name, size: asset.size });
      setState({ phase: 'error', name: asset.name, error: msg || 'Something went wrong. Please try again.', step: 0 });
    } finally {
      clearTimeout(timer);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <TopBar title="Upload a file" onBack={() => { abort.current?.abort(); router.back(); }} />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 30 }}>
        <Heading light="Turn any file into" strong="a booklet." size={26} />
        <Txt muted size={Type.small} style={{ marginTop: 10, lineHeight: 20 }}>
          Upload your lecture notes in any language. We keep the original text, split it into topics you can read in the reader, and write practice questions for each topic.
        </Txt>

        {state.phase === 'working' ? (
          <View style={[styles.zone, { backgroundColor: p.surface, borderColor: p.border }]}>
            <ActivityIndicator color={p.primary} />
            <Txt weight="semibold" style={{ marginTop: 14 }} numberOfLines={1}>{state.name}</Txt>
            <View style={{ marginTop: 16, gap: 8, alignSelf: 'stretch' }}>
              {STEPS.map((s, i) => (
                <View key={s} style={styles.step}>
                  <View style={[styles.dot, { backgroundColor: i < state.step ? p.primary : i === state.step ? p.primary + '66' : p.surfaceAlt }]} />
                  <Txt size={Type.small} color={i <= state.step ? p.text : p.textFaint}>{s}</Txt>
                </View>
              ))}
            </View>
            <Txt faint size={Type.tiny} style={{ marginTop: 16, textAlign: 'center' }}>
              Long files can take a minute or two. Keep the app open.
            </Txt>
          </View>
        ) : (
          <Pressable onPress={pick} style={({ pressed }) => [styles.zone, styles.dashed, { borderColor: p.primary + '55', backgroundColor: p.surface }, pressed && { opacity: 0.85 }]}>
            <View style={[styles.bigIcon, { backgroundColor: p.primarySoft }]}>
              <Icon as={FileUp} size={26} color={p.primary} />
            </View>
            <Txt weight="semibold" size={Type.h2} style={{ marginTop: 14 }}>Choose a file</Txt>
            <Txt muted size={Type.tiny} style={{ marginTop: 4 }}>Up to {MAX_UPLOAD_MB} MB</Txt>
            <View style={styles.formats}>
              {FORMATS.map((f) => (
                <View key={f.label} style={[styles.format, { backgroundColor: p.surfaceAlt }]}>
                  <Icon as={f.icon} size={13} color={p.textMuted} />
                  <Txt size={Type.tiny} muted>{f.label}</Txt>
                </View>
              ))}
            </View>
          </Pressable>
        )}

        {state.phase === 'error' ? (
          <View style={[styles.error, { backgroundColor: p.dangerSoft }]}>
            <Icon as={CircleAlert} size={18} color="#E5484D" />
            <View style={{ flex: 1 }}>
              <Txt weight="semibold" size={Type.small} color="#E5484D">Couldn&apos;t convert {state.name}</Txt>
              <Txt size={Type.small} color="#B4363A" style={{ marginTop: 2, lineHeight: 19 }}>{state.error}</Txt>
              <Pressable onPress={() => router.push('/error-log')} hitSlop={8} style={{ marginTop: 8 }}>
                <Txt weight="semibold" size={Type.small} color="#E5484D">View & share error log →</Txt>
              </Pressable>
            </View>
          </View>
        ) : null}

        <View style={[styles.note, { backgroundColor: p.surface }]}>
          <Icon as={Sparkles} size={16} color={p.primary} />
          <Txt muted size={Type.tiny} style={{ flex: 1, lineHeight: 18 }}>
            Your booklet appears under Library → My uploads, and works with the reader, Quiz Mode and Ask AI. Figures from the file show as captions.
          </Txt>
        </View>

        {state.phase === 'error' ? <Button label="Choose another file" icon={FileUp} style={{ marginTop: 16 }} onPress={pick} /> : null}

        {state.phase !== 'working' ? (
          <Button
            label="Or create a booklet from scratch"
            icon={FilePlus2}
            variant="outline"
            style={{ marginTop: 12 }}
            onPress={() => {
              const b = newBlankBooklet();
              app.addImported(b);
              router.replace({ pathname: '/editor/[bookletId]', params: { bookletId: b.id } });
            }}
          />
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  zone: { marginTop: 24, borderRadius: 26, padding: 24, alignItems: 'center' },
  dashed: { borderWidth: 1.5, borderStyle: 'dashed', paddingVertical: 34 },
  bigIcon: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  formats: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: 18 },
  format: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  error: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: 18, marginTop: 16 },
  note: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: 18, marginTop: 16 },
});
