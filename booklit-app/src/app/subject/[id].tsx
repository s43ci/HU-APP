import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Bookmark, Check, ChevronRight, Heart, ListChecks, Pencil, Play, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Chip, CircleButton, Icon, ProgressBar, SubjectThumb, Txt } from '@/components/ui';
import { Type } from '@/constants/theme';
import { bookletsOf, getSubject, isStudioBooklet, stageName, topicsOf, topicsOfSubject, UPLOADS_SUBJECT } from '@/data/content';
import { bookletProgress } from '@/lib/progress';
import { useApp } from '@/store/app-store';
import { t as tt } from '@/i18n';

export default function SubjectScreen() {
  const { id, booklet } = useLocalSearchParams<{ id: string; booklet?: string }>();
  const app = useApp();
  const p = app.palette;
  const insets = useSafeAreaInsets();
  const subject = getSubject(id);
  const list = bookletsOf(id);
  const [picked, setPicked] = useState<string | undefined>(booklet);
  const activeId = picked && list.some((b) => b.id === picked) ? picked : list[0]?.id;

  if (!subject) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Txt muted>Subject not found.</Txt>
      </View>
    );
  }

  const current = list.find((b) => b.id === activeId);
  const topics = current ? topicsOf(current.id) : [];
  const pr = current ? bookletProgress(current.id, app.completedTopics, app.topicProgress) : { done: 0, total: 0, pct: 0 };
  const fav = current ? app.favoriteBooklets.includes(current.id) : false;
  const next = topics.find((t) => !app.completedTopics.includes(t.id)) ?? topics[0];
  const isUploads = subject.id === UPLOADS_SUBJECT.id;
  const studio = !!current && isStudioBooklet(current.id);

  const removeUpload = () => {
    if (!current) return;
    const doIt = () => {
      app.removeImported(current.id);
      router.back();
    };
    if (Platform.OS === 'web') return doIt();
    Alert.alert(tt('Delete this booklet?'), current.title, [
      { text: tt('Cancel'), style: 'cancel' },
      { text: tt('Delete'), style: 'destructive', onPress: doIt },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 + insets.bottom }}>
        {/* Hero */}
        <View>
          <SubjectThumb subjectId={subject.id} width="100%" height={310 + insets.top} radius={0} />
          <View style={[styles.heroBar, { top: insets.top + 8 }]}>
            <CircleButton icon={ArrowLeft} variant="glass" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/library'))} />
            {current ? (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {studio && app.canEdit ? (
                  <CircleButton icon={Pencil} variant="glass" label="Edit booklet" onPress={() => router.push({ pathname: '/editor/[bookletId]', params: { bookletId: current.id } })} />
                ) : null}
                {studio && app.canUpload ? (
                  <CircleButton icon={Trash2} variant="glass" label="Delete booklet" onPress={removeUpload} />
                ) : null}
                {!isUploads ? (
                  <CircleButton icon={Heart} variant="glass" label="Save booklet" onPress={() => app.toggleFavoriteBooklet(current.id)} />
                ) : null}
              </View>
            ) : null}
          </View>
          {fav ? (
            <View style={[styles.saved, { top: insets.top + 60 }]}>
              <Heart size={12} color="#E5484D" fill="#E5484D" />
              <Txt size={Type.tiny} weight="medium" color="#17172B">Saved</Txt>
            </View>
          ) : null}
        </View>

        {/* Sheet */}
        <View style={[styles.sheet, { backgroundColor: p.bg }]}>
          <Txt weight="semibold" size={Type.title}>{isUploads ? current?.title ?? subject.name : subject.name}</Txt>
          <Txt muted size={Type.small} style={{ marginTop: 4 }}>
            {isUploads
              ? `Your upload · ${topics.length} topics · ${app.importedBooklets.find((b) => b.id === current?.id)?.language ?? ''}`
              : `${stageName(subject.stageId)} · ${list.length} booklets · ${topicsOfSubject(subject.id).length} topics`}
          </Txt>

          {!isUploads ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={{ marginHorizontal: -20 }}>
              {list.map((b) => (
                <Chip key={b.id} label={b.title} active={b.id === activeId} onPress={() => setPicked(b.id)} />
              ))}
            </ScrollView>
          ) : (
            <View style={{ height: 16 }} />
          )}

          {current ? (
            <>
              <View style={styles.bookletHead}>
                <View style={{ flex: 1 }}>
                  <Txt weight="semibold" size={Type.h2}>{isUploads ? 'Topics' : current.title}</Txt>
                  <Txt muted size={Type.tiny}>{pr.done} of {pr.total} topics done</Txt>
                </View>
                <Txt weight="semibold" size={Type.small} color={p.primary}>{Math.round(pr.pct * 100)}%</Txt>
              </View>
              <ProgressBar value={pr.pct} />

              <View style={[styles.topicCard, { backgroundColor: p.surface }]}>
                {topics.map((t, i) => {
                  const done = app.completedTopics.includes(t.id);
                  const saved = app.favoriteTopics.includes(t.id);
                  return (
                    <Pressable
                      key={t.id}
                      onPress={() => router.push({ pathname: '/reader/[topicId]', params: { topicId: t.id } })}
                      style={({ pressed }) => [styles.topic, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: p.border }, pressed && { opacity: 0.6 }]}>
                      <View style={[styles.num, { backgroundColor: done ? p.primary : p.primarySoft }]}>
                        {done ? <Icon as={Check} size={14} color="#fff" stroke={2} /> : <Txt weight="medium" size={Type.tiny} color={p.primary}>{t.order}</Txt>}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Txt weight="medium" numberOfLines={2}>{t.title}</Txt>
                        <Txt faint size={Type.tiny}>{t.minutes} min read</Txt>
                      </View>
                      <Pressable hitSlop={10} onPress={() => app.toggleFavoriteTopic(t.id)} accessibilityLabel="Save topic">
                        <Bookmark size={18} color={saved ? p.primary : p.textFaint} fill={saved ? p.primary : 'transparent'} strokeWidth={1.6} />
                      </Pressable>
                      <Icon as={ChevronRight} size={18} color={p.textFaint} />
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : (
            <Txt muted style={{ marginTop: 20 }}>No booklets yet.</Txt>
          )}
        </View>
      </ScrollView>

      {next ? (
        <View style={[styles.cta, { paddingBottom: insets.bottom + 12, backgroundColor: p.bg }]}>
          <Pressable
            onPress={() => router.push({ pathname: '/quiz/[topicId]', params: { topicId: next.id, mode: 'quiz' } })}
            style={({ pressed }) => [styles.ctaBtn, { backgroundColor: p.ink }, pressed && { opacity: 0.85 }]}>
            <Icon as={ListChecks} size={17} color={p.onInk} />
            <Txt weight="semibold" color={p.onInk}>Quiz</Txt>
          </Pressable>
          <Pressable
            onPress={() => router.push({ pathname: '/reader/[topicId]', params: { topicId: next.id } })}
            style={({ pressed }) => [styles.ctaBtn, { flex: 1.4, backgroundColor: p.primary }, pressed && { opacity: 0.85 }]}>
            <Icon as={Play} size={16} color="#fff" />
            <Txt weight="semibold" color="#fff">{pr.done ? 'Continue reading' : 'Start reading'}</Txt>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  heroBar: { position: 'absolute', left: 20, right: 20, flexDirection: 'row', justifyContent: 'space-between' },
  saved: { position: 'absolute', right: 20, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  sheet: { marginTop: -28, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 22 },
  chips: { gap: 8, paddingVertical: 16, paddingHorizontal: 20 },
  bookletHead: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 10 },
  topicCard: { borderRadius: 22, paddingHorizontal: 14, marginTop: 16 },
  topic: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  num: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cta: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 10 },
  ctaBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 999, paddingVertical: 15 },
});
