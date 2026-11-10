import { router } from 'expo-router';
import { ChevronRight, FilePlus2, FileUp, ListChecks, Pencil, ShieldCheck } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card, EmptyState, Heading, Icon, SubjectThumb, TopBar, Txt, type LucideIcon } from '@/components/ui';
import { Type } from '@/constants/theme';
import { getSubject, UPLOADS_SUBJECT } from '@/data/content';
import { StatusTag, usePublishStatus } from '@/components/publish-card';
import type { ImportedBooklet } from '@/data/types';
import { useApp } from '@/store/app-store';

/** BOOKLIT Studio: the admin's production line (upload & design booklets, question banks, manage). */
export default function Studio() {
  'use no memo'; // reads the shared content lists, which change when booklets are published or deleted
  const app = useApp();
  const p = app.palette;
  const insets = useSafeAreaInsets();

  if (!app.canUpload) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg }}>
        <TopBar title="BOOKLIT Studio" />
        <EmptyState icon={ShieldCheck} title="For the BOOKLIT team" text="Studio is where the admin uploads and designs booklets." />
      </View>
    );
  }

  // Your Studio booklets, plus ones other team members published (open them to edit a copy).
  const local = new Set(app.importedBooklets.map((b) => b.id));
  const booklets = [...app.importedBooklets, ...(app.canUpload ? app.published.booklets.filter((b) => !local.has(b.id)) : [])];
  const questions = booklets.reduce((n, b) => n + b.mcqs.length, 0) + app.extraMcqs.length;

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <TopBar title="BOOKLIT Studio" />
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 4, paddingBottom: insets.bottom + 40 }}>
        <Heading light="Create. Design." strong="Publish." size={26} />
        <Txt muted size={Type.small} style={{ marginTop: 6 }}>{booklets.length} booklets · {questions} questions made in Studio</Txt>

        <View style={{ gap: 10, marginTop: 20 }}>
          <Action icon={FileUp} primary title="New booklet from a file" text="PDF, Word, slides or photos. AI designs it, splits topics, writes questions and keeps the images." onPress={() => router.push('/import')} />
          <Action icon={ListChecks} title="Question bank → topics" text="Upload ministry or instructor MCQs. AI sorts every question into its topic for you to check." onPress={() => router.push('/studio/mcq-bank')} />
          <Action icon={FilePlus2} title="Empty booklet" text="Start from a blank page in the editor." onPress={() => router.push('/import')} />
        </View>

        <Txt weight="semibold" size={Type.h2} style={{ marginTop: 28, marginBottom: 10 }}>Studio booklets</Txt>
        {!booklets.length ? <Txt muted size={Type.small}>Booklets you create appear here.</Txt> : null}
        <View style={{ gap: 8 }}>
          {booklets.map((b) => {
            const s = getSubject(b.subjectId ?? UPLOADS_SUBJECT.id) ?? UPLOADS_SUBJECT;
            return (
              <Card key={b.id} style={styles.row} onPress={() => router.push({ pathname: '/editor/[bookletId]', params: { bookletId: b.id } })}>
                <SubjectThumb subjectId={s.id} size={46} radius={14} />
                <View style={{ flex: 1 }}>
                  <Txt weight="semibold" numberOfLines={1}>{b.title}</Txt>
                  <Txt faint size={Type.tiny} numberOfLines={1}>{s.name} · {b.topics.length} topics · {b.mcqs.length} questions</Txt>
                </View>
                <Status b={b} />
                <Icon as={Pencil} size={16} color={p.textMuted} />
              </Card>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

function Status({ b }: { b: ImportedBooklet }) {
  const s = usePublishStatus(b);
  return b.subjectId && b.subjectId !== UPLOADS_SUBJECT.id ? <StatusTag status={s} /> : null;
}

function Action({ icon, title, text, onPress, primary }: { icon: LucideIcon; title: string; text: string; onPress: () => void; primary?: boolean }) {
  const { palette: p } = useApp();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.action, { backgroundColor: primary ? p.primary : p.surface }, pressed && { opacity: 0.88 }]}>
      <View style={[styles.actionIcon, { backgroundColor: primary ? 'rgba(255,255,255,0.18)' : p.primarySoft }]}>
        <Icon as={icon} size={20} color={primary ? '#fff' : p.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Txt weight="semibold" color={primary ? '#fff' : p.text}>{title}</Txt>
        <Txt size={Type.tiny} color={primary ? 'rgba(255,255,255,0.8)' : p.textMuted} style={{ marginTop: 2, lineHeight: 17 }}>{text}</Txt>
      </View>
      <Icon as={ChevronRight} size={18} color={primary ? '#fff' : p.textFaint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  action: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 22 },
  actionIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 20 },
});
