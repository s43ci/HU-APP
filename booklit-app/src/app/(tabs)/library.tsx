import { router, useLocalSearchParams } from 'expo-router';
import { Lock, Plus, Search, Wand2 } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { LockedModal } from '@/components/locked-modal';
import { ArrowCircle, Card, Chip, CircleButton, Heading, Icon, Page, SectionTitle, SubjectThumb, Txt, TabHeader } from '@/components/ui';
import { Type } from '@/constants/theme';
import { bookletsOf, courseSubjects, stages, topicsOf, topicsOfSubject, UPLOADS_SUBJECT } from '@/data/content';
import type { StageId, Subject } from '@/data/types';
import { isSubjectUnlocked } from '@/lib/progress';
import { accessOf, useApp } from '@/store/app-store';

type StageFilter = 'all' | StageId;

export default function Library() {
  const params = useLocalSearchParams<{ stage?: string }>();
  const app = useApp();
  const p = app.palette;
  const { width } = useWindowDimensions();
  const cols = width >= 700 ? 3 : 2;
  const cardW = (Math.min(width, 900) - 40 - 12 * (cols - 1)) / cols;

  const paramStage: StageFilter = stages.some((s) => s.id === params.stage) ? (params.stage as StageId) : 'all';
  // The chip follows the URL param (Home shortcuts) until the student taps a chip.
  const [sel, setSel] = useState<{ param?: string; value: StageFilter }>({ param: params.stage, value: paramStage });
  const stage = sel.param === params.stage ? sel.value : paramStage;
  const setStage = (value: StageFilter) => setSel({ param: params.stage, value });
  const [locked, setLocked] = useState<Subject | null>(null);

  const list = courseSubjects().filter((s) => stage === 'all' || s.stageId === stage);
  const uploads = bookletsOf(UPLOADS_SUBJECT.id);

  const open = (s: Subject) =>
    isSubjectUnlocked(s.id, app.unlockedSubjects) ? router.push({ pathname: '/subject/[id]', params: { id: s.id } }) : setLocked(s);

  return (
    <Page>
      <TabHeader title="Library" right={app.canUpload ? <CircleButton icon={Wand2} label="BOOKLIT Studio" size={40} onPress={() => router.push('/studio')} /> : undefined} />

      <View style={styles.headRow}>
        <View style={{ flex: 1 }}>
          <Heading light="Find your" strong="next booklet." />
        </View>
        <CircleButton icon={Search} label="Search" size={52} onPress={() => router.push('/search')} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={{ marginHorizontal: -20 }}>
        <Chip label="All" active={stage === 'all'} onPress={() => setStage('all')} />
        {stages.map((s) => (
          <Chip key={s.id} label={s.name} active={stage === s.id} onPress={() => setStage(s.id)} />
        ))}
      </ScrollView>

      <SectionTitle title="Subjects" action={`${list.length} subjects`} />
      <View style={styles.grid}>
        {list.map((s) => {
          const lockedS = !isSubjectUnlocked(s.id, app.unlockedSubjects);
          return (
            <Pressable key={s.id} onPress={() => open(s)} style={({ pressed }) => [{ width: cardW }, pressed && { opacity: 0.88, transform: [{ scale: 0.985 }] }]}>
              <View style={[styles.subjectCard, { backgroundColor: p.surface }]}>
                <SubjectThumb subjectId={s.id} width={cardW - 12} height={cardW * 0.78} radius={18} />
                <View style={styles.subjectMeta}>
                  <View style={{ flex: 1 }}>
                    <Txt weight="semibold" size={Type.small + 0.5} numberOfLines={1}>{s.name}</Txt>
                    <Txt muted size={Type.tiny}>{topicsOfSubject(s.id).length} topics</Txt>
                  </View>
                  {lockedS ? (
                    <View style={[styles.lockDot, { backgroundColor: p.surfaceAlt }]}>
                      <Icon as={Lock} size={13} color={p.textMuted} />
                    </View>
                  ) : null}
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>

      {app.canAddFiles || uploads.length ? (
        <>
      <View style={{ marginTop: 26 }}>
        <SectionTitle title={app.canUpload ? 'Studio drafts' : 'My files'} action={uploads.length ? `${uploads.length} files` : undefined} />
      </View>
      <View style={{ gap: 10 }}>
        {uploads.map((b) => (
          <Card key={b.id} style={styles.uploadRow} onPress={() => router.push({ pathname: '/subject/[id]', params: { id: UPLOADS_SUBJECT.id, booklet: b.id } })}>
            <SubjectThumb subjectId={UPLOADS_SUBJECT.id} size={46} radius={14} />
            <View style={{ flex: 1 }}>
              <Txt weight="semibold" numberOfLines={1}>{b.title}</Txt>
              <Txt muted size={Type.tiny}>{topicsOf(b.id).length} topics</Txt>
            </View>
            <ArrowCircle onPress={() => router.push({ pathname: '/subject/[id]', params: { id: UPLOADS_SUBJECT.id, booklet: b.id } })} />
          </Card>
        ))}
        {app.canAddFiles ? (
        <Pressable onPress={() => router.push('/import')} style={({ pressed }) => [styles.uploadCard, { borderColor: p.border }, pressed && { opacity: 0.8 }]}>
          <View style={[styles.plus, { backgroundColor: p.primarySoft }]}>
            <Icon as={Plus} size={18} color={p.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Txt weight="semibold">Upload a file</Txt>
            <Txt muted size={Type.tiny}>PDF, Word, PowerPoint, image or text. AI turns it into a booklet.</Txt>
          </View>
        </Pressable>
        ) : null}
      </View>
        </>
      ) : (
        <>
      <View style={{ marginTop: 26 }}>
        <SectionTitle title="My files" />
      </View>
      <View>
        <Pressable onPress={() => router.push({ pathname: '/settings/[key]', params: { key: 'account' } })} style={({ pressed }) => [styles.uploadCard, { borderColor: p.border }, pressed && { opacity: 0.8 }]}>
          <View style={[styles.plus, { backgroundColor: p.primarySoft }]}>
            <Icon as={Plus} size={18} color={p.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Txt weight="semibold">Your own library · Premium</Txt>
            <Txt muted size={Type.tiny}>Turn your own PDFs into booklets, or open a PDF from any app with Booklit.</Txt>
          </View>
        </Pressable>
      </View>
        </>
      )}

      <LockedModal visible={!!locked} subjectName={locked?.name} plan={locked && accessOf(locked.id, locked.isFree, app.subjectAccess) === 'premium' ? 'premium' : 'pro'} onClose={() => setLocked(null)} />
    </Page>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14 },
  chips: { gap: 8, paddingVertical: 18, paddingHorizontal: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  subjectCard: { borderRadius: 22, padding: 6, paddingBottom: 10 },
  subjectMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 6, paddingTop: 10 },
  lockDot: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  uploadRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 20 },
  uploadCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 20, borderWidth: 1.2, borderStyle: 'dashed' },
  plus: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
