import type { DocumentPickerAsset } from 'expo-document-picker';
import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import { Check, CircleAlert, FilePlus2, FileText, FileUp, Image as ImageIcon, Presentation, RefreshCw, ScrollText, ShieldCheck, Sparkles, Wand2, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Chip, EmptyState, Heading, Icon, SubjectThumb, TopBar, Txt } from '@/components/ui';
import { Type } from '@/constants/theme';
import { courseSubjects, stageName, UPLOADS_SUBJECT } from '@/data/content';
import { newBlankBooklet } from '@/lib/editor';
import { ACCEPTED_TYPES, convertFile, MAX_UPLOAD_MB, type ImportOptions } from '@/lib/import';
import { log } from '@/lib/log';
import { useApp } from '@/store/app-store';

const STEPS = ['Uploading your file', 'Reading every page', 'Designing the booklet', 'Writing questions for each topic', 'Placing images', 'Almost done'];
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
  const [file, setFile] = useState<DocumentPickerAsset | null>(null);
  const [opts, setOpts] = useState<ImportOptions>({ design: 'enhanced', questionsPerTopic: 5, subjectId: UPLOADS_SUBJECT.id });
  const [state, setState] = useState<{ phase: 'idle' | 'working' | 'error'; error?: string; step: number }>({ phase: 'idle', step: 0 });
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    if (state.phase !== 'working') return;
    const iv = setInterval(() => setState((s) => (s.phase === 'working' ? { ...s, step: Math.min(STEPS.length - 1, s.step + 1) } : s)), 5000);
    return () => clearInterval(iv);
  }, [state.phase]);
  useEffect(() => () => abort.current?.abort(), []);

  if (!app.canUpload) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg }}>
        <TopBar title="Upload" />
        <EmptyState icon={ShieldCheck} title="For the BOOKLIT team" text="Uploading and designing booklets is done by the admin in BOOKLIT Studio." />
      </View>
    );
  }

  const pick = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: ACCEPTED_TYPES, copyToCacheDirectory: true, multiple: false });
    if (res.canceled || !res.assets?.[0]) return;
    const asset = res.assets[0];
    if (asset.size && asset.size > MAX_UPLOAD_MB * 1024 * 1024) {
      setState({ phase: 'error', error: `This file is larger than ${MAX_UPLOAD_MB} MB. Please upload a smaller file or split it.`, step: 0 });
      return;
    }
    setFile(asset);
    setState({ phase: 'idle', step: 0 });
  };

  const build = async () => {
    if (!file) return;
    setState({ phase: 'working', step: 0 });
    abort.current = new AbortController();
    const timer = setTimeout(() => abort.current?.abort(), 5 * 60 * 1000);
    try {
      const { booklet } = await convertFile(file, opts, abort.current.signal);
      app.addImported(booklet);
      router.replace({ pathname: '/subject/[id]', params: { id: opts.subjectId ?? UPLOADS_SUBJECT.id, booklet: booklet.id } });
    } catch (e) {
      const aborted = (e as Error).name === 'AbortError';
      if (aborted) log('error', 'upload', 'Timed out or cancelled', { name: file.name, size: file.size });
      setState({ phase: 'error', error: aborted ? 'The conversion took too long. Try a shorter file.' : (e as Error).message || 'Something went wrong. Please try again.', step: 0 });
    } finally {
      clearTimeout(timer);
    }
  };

  const subjects = [UPLOADS_SUBJECT, ...courseSubjects()];
  const working = state.phase === 'working';

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <TopBar title="New booklet" onBack={() => { abort.current?.abort(); router.back(); }} />
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 4, paddingBottom: insets.bottom + 120 }}>
        <Heading light="Upload a file," strong="AI builds the booklet." size={24} />
        <Txt muted size={Type.small} style={{ marginTop: 8, lineHeight: 20 }}>
          Any language. The original text is kept, split into topics, designed for reading, with questions for every topic and the images from the file.
        </Txt>

        {/* 1. File */}
        <StepLabel n={1} label="Choose the file" done={!!file} />
        {working ? (
          <View style={[styles.zone, { backgroundColor: p.surface }]}>
            <ActivityIndicator color={p.primary} />
            <Txt weight="semibold" style={{ marginTop: 12 }} numberOfLines={1}>{file?.name}</Txt>
            <View style={{ marginTop: 14, gap: 8, alignSelf: 'stretch' }}>
              {STEPS.map((s, i) => (
                <View key={s} style={styles.step}>
                  <View style={[styles.dot, { backgroundColor: i < state.step ? p.primary : i === state.step ? p.primary + '66' : p.surfaceAlt }]}>
                    {i < state.step ? <Icon as={Check} size={9} color="#fff" stroke={2.4} /> : null}
                  </View>
                  <Txt size={Type.small} color={i <= state.step ? p.text : p.textFaint}>{s}</Txt>
                </View>
              ))}
            </View>
            <Txt faint size={Type.tiny} style={{ marginTop: 14, textAlign: 'center' }}>Long files take a minute or two. Keep the app open.</Txt>
          </View>
        ) : file ? (
          <View style={[styles.fileRow, { backgroundColor: p.surface }]}>
            <View style={[styles.fileIcon, { backgroundColor: p.primarySoft }]}>
              <Icon as={FileText} size={20} color={p.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Txt weight="semibold" numberOfLines={1}>{file.name}</Txt>
              <Txt faint size={Type.tiny}>{file.size ? (file.size < 1024 * 1024 ? `${Math.max(1, Math.round(file.size / 1024))} KB` : `${(file.size / 1024 / 1024).toFixed(1)} MB`) : ''}</Txt>
            </View>
            <Pressable onPress={pick} hitSlop={8} style={styles.iconBtn} accessibilityLabel="Change file">
              <Icon as={RefreshCw} size={17} />
            </Pressable>
            <Pressable onPress={() => setFile(null)} hitSlop={8} style={styles.iconBtn} accessibilityLabel="Remove file">
              <Icon as={X} size={17} />
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={pick} style={({ pressed }) => [styles.zone, styles.dashed, { borderColor: p.primary + '55', backgroundColor: p.surface }, pressed && { opacity: 0.85 }]}>
            <View style={[styles.bigIcon, { backgroundColor: p.primarySoft }]}>
              <Icon as={FileUp} size={24} color={p.primary} />
            </View>
            <Txt weight="semibold" size={Type.h2} style={{ marginTop: 12 }}>Choose a file</Txt>
            <Txt muted size={Type.tiny} style={{ marginTop: 3 }}>Up to {MAX_UPLOAD_MB} MB</Txt>
            <View style={styles.formats}>
              {FORMATS.map((f) => (
                <View key={f.label} style={[styles.format, { backgroundColor: p.surfaceAlt }]}>
                  <Icon as={f.icon} size={12} color={p.textMuted} />
                  <Txt size={Type.tiny} muted>{f.label}</Txt>
                </View>
              ))}
            </View>
          </Pressable>
        )}

        {!working ? (
          <>
            {/* 2. Subject */}
            <StepLabel n={2} label="Where does it go?" done />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ gap: 10, paddingHorizontal: 20 }}>
              {subjects.map((s) => {
                const on = opts.subjectId === s.id;
                return (
                  <Pressable key={s.id} onPress={() => setOpts({ ...opts, subjectId: s.id })} style={[styles.subject, { backgroundColor: p.surface, borderColor: on ? p.primary : 'transparent' }]}>
                    <SubjectThumb subjectId={s.id} size={64} radius={14} />
                    <Txt weight={on ? 'semibold' : 'medium'} size={Type.tiny} numberOfLines={2} style={{ textAlign: 'center' }} color={on ? p.primary : p.text}>{s.name}</Txt>
                    <Txt faint size={10}>{s.id === UPLOADS_SUBJECT.id ? 'Studio' : stageName(s.stageId)}</Txt>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* 3. Design */}
            <StepLabel n={3} label="How should it look?" done />
            <View style={{ gap: 8 }}>
              <Choice
                on={opts.design === 'enhanced'}
                icon={Wand2}
                title="AI design (recommended)"
                text="Same text, designed for studying: clear sections, lists and tables, exam tips and a key-points summary for every topic."
                onPress={() => setOpts({ ...opts, design: 'enhanced' })}
              />
              <Choice
                on={opts.design === 'original'}
                icon={FileText}
                title="Keep the original layout"
                text="Text, lists and tables exactly as they are in the file."
                onPress={() => setOpts({ ...opts, design: 'original' })}
              />
            </View>

            {/* 4. Questions */}
            <StepLabel n={4} label="Questions per topic" done />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[3, 5, 8].map((n) => (
                <Chip key={n} label={`${n} questions`} active={opts.questionsPerTopic === n} onPress={() => setOpts({ ...opts, questionsPerTopic: n })} />
              ))}
            </View>
          </>
        ) : null}

        {state.phase === 'error' ? (
          <View style={[styles.error, { backgroundColor: p.dangerSoft }]}>
            <Icon as={CircleAlert} size={18} color="#E5484D" />
            <View style={{ flex: 1 }}>
              <Txt weight="semibold" size={Type.small} color="#E5484D">Couldn&apos;t build the booklet</Txt>
              <Txt size={Type.small} color="#B4363A" style={{ marginTop: 2, lineHeight: 19 }}>{state.error}</Txt>
              <Pressable onPress={() => router.push('/error-log')} hitSlop={8} style={{ marginTop: 8 }}>
                <Txt weight="semibold" size={Type.small} color="#E5484D">View & share error log →</Txt>
              </Pressable>
            </View>
          </View>
        ) : null}

        {!working ? (
          <Button
            label="Or start an empty booklet"
            icon={FilePlus2}
            variant="outline"
            style={{ marginTop: 22 }}
            onPress={() => {
              const b = { ...newBlankBooklet(), subjectId: opts.subjectId };
              app.addImported(b);
              router.replace({ pathname: '/editor/[bookletId]', params: { bookletId: b.id } });
            }}
          />
        ) : null}
      </ScrollView>

      {!working ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 12, backgroundColor: p.bg }]}>
          <Button label={file ? 'Build booklet with AI' : 'Choose a file first'} icon={Sparkles} variant="primary" disabled={!file} onPress={build} />
        </View>
      ) : null}
    </View>
  );
}

function StepLabel({ n, label, done }: { n: number; label: string; done?: boolean }) {
  const { palette: p } = useApp();
  return (
    <View style={styles.stepLabel}>
      <View style={[styles.stepNum, { backgroundColor: done ? p.ink : p.surfaceAlt }]}>
        <Txt weight="semibold" size={11} color={done ? p.onInk : p.textMuted}>{n}</Txt>
      </View>
      <Txt weight="semibold">{label}</Txt>
    </View>
  );
}

function Choice({ on, icon, title, text, onPress }: { on: boolean; icon: Parameters<typeof Icon>[0]['as']; title: string; text: string; onPress: () => void }) {
  const { palette: p } = useApp();
  return (
    <Pressable onPress={onPress} style={[styles.choice, { backgroundColor: p.surface, borderColor: on ? p.primary : 'transparent' }]}>
      <View style={[styles.fileIcon, { backgroundColor: on ? p.primary : p.primarySoft }]}>
        <Icon as={icon} size={18} color={on ? '#fff' : p.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Txt weight="semibold" size={Type.small}>{title}</Txt>
        <Txt muted size={Type.tiny} style={{ lineHeight: 17, marginTop: 2 }}>{text}</Txt>
      </View>
      <View style={[styles.radio, { borderColor: on ? p.primary : p.border }]}>{on ? <View style={[styles.radioDot, { backgroundColor: p.primary }]} /> : null}</View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stepLabel: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 24, marginBottom: 10 },
  stepNum: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  zone: { borderRadius: 24, padding: 22, alignItems: 'center' },
  dashed: { borderWidth: 1.5, borderStyle: 'dashed', paddingVertical: 28 },
  bigIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  formats: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: 14 },
  format: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999 },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 20 },
  fileIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  iconBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  subject: { width: 116, alignItems: 'center', gap: 6, padding: 8, borderRadius: 18, borderWidth: 1.5 },
  choice: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 20, borderWidth: 1.5 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 14, height: 14, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  error: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: 18, marginTop: 18 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 10 },
});
