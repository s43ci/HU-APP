import type { DocumentPickerAsset } from 'expo-document-picker';
import * as DocumentPicker from 'expo-document-picker';
import { File as FsFile } from 'expo-file-system';
import { router, useLocalSearchParams } from 'expo-router';
import { Check, CircleAlert, FilePlus2, FileText, FileUp, Image as ImageIcon, Presentation, RefreshCw, ScrollText, ShieldCheck, PenLine, Sparkles, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Chip, EmptyState, Heading, Icon, SubjectThumb, TopBar, Txt } from '@/components/ui';
import { Font, Type } from '@/constants/theme';
import { IS_AR, t as tt } from '@/i18n';
import { allCourseSubjects, stageName, UPLOADS_SUBJECT } from '@/data/content';
import { newBlankBooklet } from '@/lib/editor';
import { ACCEPTED_TYPES, convertFile, MAX_UPLOAD_MB, type ImportOptions } from '@/lib/import';
import { log } from '@/lib/log';
import { ENKIDU_PROMPT } from '@/server/prompt';
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
  const { shared, sharedUri } = useLocalSearchParams<{ shared?: string; sharedUri?: string }>();
  // Premium students build booklets for their own library only (no subject picking, no Studio).
  const personal = !app.canUpload;
  const [file, setFile] = useState<DocumentPickerAsset | null>(null);
  const [opts, setOpts] = useState<ImportOptions>({ design: 'enhanced', questionsPerTopic: 5, subjectId: UPLOADS_SUBJECT.id });
  const [state, setState] = useState<{ phase: 'idle' | 'working' | 'error'; error?: string; step: number; retrying?: boolean }>({ phase: 'idle', step: 0 });
  const abort = useRef<AbortController | null>(null);
  // Number of topics (empty = like the file) and this booklet's own prompt (null = the fixed prompt).
  const [topicsText, setTopicsText] = useState('');
  const topicsCount = Math.min(40, Math.max(1, Number(topicsText) || 0));
  const [ownPrompt, setOwnPrompt] = useState<string | null>(null);
  // Shortening in % (empty or 0 = no shortening: the AI only reorganises).
  const [shortenText, setShortenText] = useState('');
  const shorten = Math.min(90, Math.max(0, Number(shortenText) || 0));
  const [promptHeight, setPromptHeight] = useState(240);

  useEffect(() => {
    if (state.phase !== 'working') return;
    const iv = setInterval(() => setState((s) => (s.phase === 'working' ? { ...s, step: Math.min(STEPS.length - 1, s.step + 1) } : s)), 5000);
    return () => clearInterval(iv);
  }, [state.phase]);
  useEffect(() => () => abort.current?.abort(), []);

  // A PDF shared to Booklit from another app (installed web app share sheet, or Android "Open with").
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (Platform.OS === 'web' && shared && typeof caches !== 'undefined') {
          const cache = await caches.open('booklit-shared');
          const res = await cache.match('/shared-file');
          if (!res) return;
          const blob = await res.blob();
          const name = decodeURIComponent(res.headers.get('X-File-Name') || 'Shared file.pdf');
          const f = new File([blob], name, { type: blob.type || 'application/pdf' });
          await cache.delete('/shared-file');
          if (!cancelled) setFile({ name, size: f.size, mimeType: f.type, uri: URL.createObjectURL(f), file: f, lastModified: Date.now() });
        } else if (sharedUri) {
          const f = new FsFile(sharedUri);
          const raw = decodeURIComponent(sharedUri.split('/').pop() ?? '');
          const name = /\.pdf$/i.test(raw) ? raw.split(':').pop()! : 'Shared file.pdf';
          if (!cancelled) setFile({ name, size: f.size ?? undefined, mimeType: 'application/pdf', uri: sharedUri, lastModified: Date.now() });
        }
      } catch (e) {
        log('error', 'share', 'Could not open shared file', { message: (e as Error).message });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shared, sharedUri]);

  if (!app.canAddFiles) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg }}>
        <TopBar title="My files" />
        <EmptyState
          icon={ShieldCheck}
          title="A Premium feature"
          text="With Premium you can turn your own PDFs and notes into Booklit booklets, and open any PDF with Booklit from other apps."
          action="See plans"
          onAction={() => router.replace({ pathname: '/settings/[key]', params: { key: 'account' } })}
        />
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
    // Up to two conversions (the app checks the first and may ask once more).
    const timer = setTimeout(() => abort.current?.abort(), 9 * 60 * 1000);
    try {
      const { booklet, length } = await convertFile(file, { ...opts, subjectId: personal ? UPLOADS_SUBJECT.id : opts.subjectId, unlimited: app.canUpload, topics: topicsText ? topicsCount : null, shorten, prompt: ownPrompt !== null && ownPrompt.trim() && ownPrompt.trim() !== ENKIDU_PROMPT.trim() ? ownPrompt : undefined }, abort.current.signal, (stage) => {
        if (stage === 'images') setState((st) => ({ ...st, step: Math.max(st.step, 4), retrying: false }));
        if (stage === 'retrying') setState((st) => ({ ...st, step: 2, retrying: true }));
      });
      app.addImported(booklet);
      if (length) {
        const n = (x: number) => x.toLocaleString('en-US');
        const cov = length.coverage;
        const miss = length.missing.slice(0, 12).join('، ');
        const msg = IS_AR
          ? [
              `الأصل ${n(length.sourceWords)} كلمة ← الملزمة ${n(length.outputWords)} كلمة.`,
              cov !== null ? `المعلومات المحفوظة: ${cov}% من مصطلحات الأصل وأرقامه.` : '',
              length.shorten > 0 ? `الاختصار الفعلي ${Math.max(0, length.actualPct)}% (المطلوب ${length.shorten}%).` : 'بدون اختصار.',
              length.retried ? 'أُعيد التحويل مرة ثانية تلقائياً لأن الأولى ابتعدت عن المطلوب.' : '',
              length.restored ? `أُضيفت ${length.restored} جملة من الأصل كما هي، كان الذكاء الاصطناعي قد أسقطها (في نهاية مواضيعها تحت «تفاصيل إضافية من النص الأصلي»).` : '',
              length.ok ? '' : `النتيجة ما زالت بعيدة عن المطلوب. يمكنك إعادة التحويل أو تعديل الملزمة.${length.shorten <= 0 && miss ? `\nمن الكلمات غير الموجودة: ${miss}` : ''}`,
            ]
          : [
              `Source ${n(length.sourceWords)} words → booklet ${n(length.outputWords)} words.`,
              cov !== null ? `Information kept: ${cov}% of the source's terms and numbers.` : '',
              length.shorten > 0 ? `Actual shortening ${Math.max(0, length.actualPct)}% (asked ${length.shorten}%).` : 'No shortening.',
              length.retried ? 'Converted a second time automatically, because the first result was off.' : '',
              length.restored ? `${length.restored} sentences the AI left out were added back word for word (at the end of their topics, under "Additional details from the original").` : '',
              length.ok ? '' : `Still off target. You can convert again or edit the booklet.${length.shorten <= 0 && miss ? `\nSome missing words: ${miss}` : ''}`,
            ];
        const text = msg.filter(Boolean).join('\n');
        if (Platform.OS === 'web') window.alert(text);
        else Alert.alert(IS_AR ? 'فحص الملزمة' : 'Booklet check', text);
      }
      router.replace({ pathname: '/subject/[id]', params: { id: personal ? UPLOADS_SUBJECT.id : opts.subjectId ?? UPLOADS_SUBJECT.id, booklet: booklet.id } });
    } catch (e) {
      const aborted = (e as Error).name === 'AbortError';
      if (aborted) log('error', 'upload', 'Timed out or cancelled', { name: file.name, size: file.size });
      setState({ phase: 'error', error: aborted ? 'The conversion took too long. Try a shorter file.' : (e as Error).message || 'Something went wrong. Please try again.', step: 0 });
    } finally {
      clearTimeout(timer);
    }
  };

  const subjects = [UPLOADS_SUBJECT, ...allCourseSubjects()];
  const working = state.phase === 'working';

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
       <TopBar title={personal ? 'My files' : 'New booklet'} onBack={() => { abort.current?.abort(); router.back(); }} />
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
            {state.retrying ? (
              <Txt size={Type.small} color={p.primary} style={{ marginTop: 14, textAlign: 'center' }}>
                Checking against the original: a second pass to restore what was missing.
              </Txt>
            ) : null}
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
            {personal ? null : (<>
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
            </>)}

            {/* 3. Number of topics */}
            <StepLabel n={personal ? 2 : 3} label="Number of topics" done />
            <View style={[styles.ask, { backgroundColor: p.surface }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <TextInput
                  value={topicsText}
                  onChangeText={(v) => setTopicsText(v.replace(/[^0-9]/g, '').slice(0, 2))}
                  keyboardType="number-pad"
                  placeholder="—"
                  placeholderTextColor={p.textFaint}
                  style={[styles.number, { borderColor: topicsText ? p.primary : p.border, color: p.text, fontFamily: Font.semibold }]}
                />
                <Txt muted size={Type.small} style={{ flex: 1, lineHeight: 19 }}>
                  {topicsText ? (IS_AR ? `ستكون الملزمة ${topicsCount} مواضيع بالضبط.` : `The booklet will have exactly ${topicsCount} topics.`) : tt('Leave empty to follow the sections of the file.')}
                </Txt>
              </View>
            </View>

            {/* Shortening: 0 = none */}
            <StepLabel n={personal ? 3 : 4} label="Shortening" done />
            <View style={[styles.ask, { backgroundColor: p.surface }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <TextInput
                    value={shortenText}
                    onChangeText={(v) => setShortenText(v.replace(/[^0-9]/g, '').slice(0, 2))}
                    keyboardType="number-pad"
                    placeholder="0"
                    placeholderTextColor={p.textFaint}
                    style={[styles.number, { borderColor: shorten ? p.primary : p.border, color: p.text, fontFamily: Font.semibold }]}
                  />
                  <Txt weight="semibold" size={Type.h2}>%</Txt>
                </View>
                <Txt muted size={Type.small} style={{ flex: 1, lineHeight: 19 }}>
                  {shorten
                    ? IS_AR
                      ? `يختصر الملزمة ${shorten}% ويحتفظ بنحو ${100 - shorten}% من طولها. يقاس الطول بعد التحويل ويُعاد إن ابتعد.`
                      : `Shortens by ${shorten}%, keeping about ${100 - shorten}% of the length. The length is checked after converting.`
                    : tt('0 = no shortening: the AI only reorganises, nothing is removed.')}
                </Txt>
              </View>
            </View>

            {/* 4. Questions */}
            <StepLabel n={personal ? 4 : 5} label="Questions per topic" done />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[3, 5, 8].map((n) => (
                <Chip key={n} label={`${n} questions`} active={opts.questionsPerTopic === n} onPress={() => setOpts({ ...opts, questionsPerTopic: n })} />
              ))}
            </View>

            {/* 5. The prompt stays hidden: one button shows it for this booklet only */}
            {ownPrompt === null ? (
              <Pressable onPress={() => setOwnPrompt(ENKIDU_PROMPT)} style={({ pressed }) => [styles.changePrompt, { borderColor: p.border }, pressed && { opacity: 0.8 }]}>
                <Icon as={PenLine} size={16} color={p.primary} />
                <Txt weight="semibold" size={Type.small} color={p.primary}>Change prompt</Txt>
              </Pressable>
            ) : (
              <View style={[styles.ask, { backgroundColor: p.surface, borderWidth: 1.5, borderColor: p.primary, marginTop: 22 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Txt weight="semibold" size={Type.small} style={{ flex: 1 }}>Prompt for this booklet only</Txt>
                  <Pressable onPress={() => setOwnPrompt(null)} style={[styles.promptBtn, { backgroundColor: p.surfaceAlt }]}>
                    <Txt weight="semibold" size={Type.tiny}>Cancel</Txt>
                  </Pressable>
                </View>
                <TextInput
                  value={ownPrompt}
                  onChangeText={(v) => setOwnPrompt(v.slice(0, 8000))}
                  multiline
                  scrollEnabled={false}
                  // The box grows with the prompt, so the whole prompt is always visible.
                  onContentSizeChange={(e) => {
                    // Web reports the box's full height (padding included); phones report the text only.
                    const next = Math.max(120, Math.ceil(e.nativeEvent.contentSize.height) + (Platform.OS === 'web' ? 2 : 28));
                    setPromptHeight((h) => (Math.abs(next - h) > 4 ? next : h));
                  }}
                  style={[styles.instructions, { borderColor: p.border, color: p.text, fontFamily: Font.regular, height: promptHeight, lineHeight: 21 }]}
                />
              </View>
            )}
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

        {!working && !personal ? (
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
  ask: { borderRadius: 22, padding: 14, gap: 14 },
  number: { width: 64, height: 52, borderWidth: 1.5, borderRadius: 16, textAlign: 'center', fontSize: 20 },
  promptBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  changePrompt: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 22, paddingVertical: 13, borderRadius: 999, borderWidth: 1, borderStyle: 'dashed' },
  instructions: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14.5, minHeight: 96, textAlignVertical: 'top' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 10 },
});
