import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { LockedModal } from '@/components/locked-modal';
import { Card, Chip, Icon, SubjectArt, Txt } from '@/components/ui';
import { stages, subjects, topicsOfSubject } from '@/data/content';
import type { Subject } from '@/data/types';
import { isSubjectUnlocked } from '@/lib/progress';
import { useApp } from '@/store/app-store';

type StageFilter = 'all' | 'stage4' | 'stage5';
type TypeFilter = 'all' | 'free' | 'premium';
const TYPE_LABEL: Record<TypeFilter, string> = { all: 'All Types', free: 'Free', premium: 'Premium' };

export default function Library() {
  const params = useLocalSearchParams<{ stage?: string }>();
  const { unlockedSubjects, palette: p } = useApp();
  const paramStage: StageFilter = params.stage === 'stage4' || params.stage === 'stage5' ? params.stage : 'all';
  // The stage chip follows the URL param (Home shortcuts) until the user taps a chip.
  const [sel, setSel] = useState<{ param?: string; value: StageFilter }>({ param: params.stage, value: paramStage });
  const stage = sel.param === params.stage ? sel.value : paramStage;
  const setStage = (value: StageFilter) => setSel({ param: params.stage, value });
  const [type, setType] = useState<TypeFilter>('all');
  const [locked, setLocked] = useState<Subject | null>(null);
  const { width } = useWindowDimensions();
  const cols = width >= 700 ? 3 : 2;

  const list = subjects.filter(
    (s) =>
      (stage === 'all' || s.stageId === stage) &&
      (type === 'all' || (type === 'free' ? s.isFree : !s.isFree)),
  );

  const nextType = () => setType((t) => (t === 'all' ? 'free' : t === 'free' ? 'premium' : 'all'));

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Txt weight="extrabold" size={32} style={{ letterSpacing: -0.5 }}>
        Library
      </Txt>
      <Txt muted size={15} style={{ marginTop: 4 }}>
        Browse all booklets by subject
      </Txt>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        <Chip label="All" active={stage === 'all'} onPress={() => setStage('all')} />
        {stages.map((s) => (
          <Chip key={s.id} label={s.name} active={stage === s.id} onPress={() => setStage(s.id)} />
        ))}
        <Pressable onPress={nextType} style={[styles.typeBtn, { borderColor: p.border, backgroundColor: p.surface }]}>
          <Txt weight="medium" size={14}>
            {TYPE_LABEL[type]}
          </Txt>
          <Icon name="chevron-down" size={18} />
        </Pressable>
      </ScrollView>

      <View style={styles.grid}>
        {list.map((s) => {
          const open = isSubjectUnlocked(s.id, unlockedSubjects);
          return (
            <View key={s.id} style={{ width: `${100 / cols}%`, padding: 5 }}>
              <Card
                style={styles.card}
                onPress={() => (open ? router.push({ pathname: '/subject/[id]', params: { id: s.id } }) : setLocked(s))}>
                <SubjectArt color={s.color} icon={s.icon} size={56} radius={15} />
                <View style={{ gap: 2 }}>
                  <Txt weight="bold" size={15.5} numberOfLines={2}>
                    {s.name}
                  </Txt>
                  <Txt muted size={12.5}>
                    {topicsOfSubject(s.id).length} Topics
                  </Txt>
                </View>
                {!open ? (
                  <View style={[styles.lock, { backgroundColor: p.primarySoft }]}>
                    <Icon name="lock" size={14} color={p.primary} />
                  </View>
                ) : null}
              </Card>
            </View>
          );
        })}
      </View>
      {!list.length ? (
        <Txt muted style={{ textAlign: 'center', marginTop: 40 }}>
          No subjects match these filters.
        </Txt>
      ) : null}

      <LockedModal visible={!!locked} subjectName={locked?.name} onClose={() => setLocked(null)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 18, paddingBottom: 32 },
  filters: { gap: 8, paddingVertical: 18 },
  typeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5 },
  card: { gap: 12, padding: 14 },
  lock: { position: 'absolute', top: 12, right: 12, width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
});
