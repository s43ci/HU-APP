import { router } from 'expo-router';
import { Bookmark, BookOpen, Heart } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card, EmptyState, Heading, Icon, Page, SubjectThumb, Txt, TabHeader } from '@/components/ui';
import { Type } from '@/constants/theme';
import { getBooklet, getSubject, getTopic, stageName, topicsOf, UPLOADS_SUBJECT } from '@/data/content';
import { useApp } from '@/store/app-store';

export default function Favorites() {
  const app = useApp();
  const p = app.palette;
  const [tab, setTab] = useState<'booklets' | 'topics'>('booklets');

  const bookletItems = app.favoriteBooklets.map(getBooklet).filter((b) => !!b);
  const topicIds = [...new Set([...app.favoriteTopics, ...app.bookmarks])].filter((id) => !!getTopic(id));

  return (
    <Page>
      <TabHeader title="Favorites" />
      <View style={{ marginTop: 14 }}>
        <Heading light="Your saved" strong="booklets & topics." />
      </View>

      <View style={[styles.segment, { backgroundColor: p.surface }]}>
        {(['booklets', 'topics'] as const).map((k) => {
          const on = tab === k;
          return (
            <Pressable key={k} onPress={() => setTab(k)} style={[styles.seg, on && { backgroundColor: p.ink }]}>
              <Icon as={k === 'booklets' ? BookOpen : Bookmark} size={16} color={on ? p.onInk : p.textMuted} />
              <Txt weight="medium" size={Type.small} color={on ? p.onInk : p.textMuted}>
                {k === 'booklets' ? `Booklets · ${bookletItems.length}` : `Topics · ${topicIds.length}`}
              </Txt>
            </Pressable>
          );
        })}
      </View>

      {tab === 'booklets' && !bookletItems.length ? (
        <EmptyState icon={Heart} title="No saved booklets yet" text="Tap the heart on any booklet to keep it here." action="Browse library" onAction={() => router.push('/library')} />
      ) : null}
      {tab === 'topics' && !topicIds.length ? (
        <EmptyState icon={Bookmark} title="No saved topics yet" text="Bookmark a topic from the booklet list or while reading." action="Browse library" onAction={() => router.push('/library')} />
      ) : null}

      <View style={{ gap: 10 }}>
        {tab === 'booklets'
          ? bookletItems.map((b) => {
              const s = getSubject(b.subjectId)!;
              return (
                <Card key={b.id} style={styles.row} onPress={() => router.push({ pathname: '/subject/[id]', params: { id: s.id, booklet: b.id } })}>
                  <SubjectThumb subjectId={s.id} size={56} radius={16} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Txt weight="semibold" numberOfLines={1}>{b.title}</Txt>
                    <Txt muted size={Type.tiny}>{s.name}{s.id === UPLOADS_SUBJECT.id ? '' : ` · ${stageName(s.stageId)}`}</Txt>
                    <Txt faint size={Type.tiny}>{topicsOf(b.id).length} topics</Txt>
                  </View>
                  <Pressable hitSlop={10} onPress={() => app.toggleFavoriteBooklet(b.id)} accessibilityLabel="Remove from favorites" style={[styles.heart, { backgroundColor: p.surfaceAlt }]}>
                    <Heart size={16} color="#E5484D" fill="#E5484D" strokeWidth={1.6} />
                  </Pressable>
                </Card>
              );
            })
          : topicIds.map((id) => {
              const t = getTopic(id)!;
              const b = getBooklet(t.bookletId)!;
              const s = getSubject(b.subjectId)!;
              return (
                <Card key={id} style={styles.row} onPress={() => router.push({ pathname: '/reader/[topicId]', params: { topicId: t.id } })}>
                  <SubjectThumb subjectId={s.id} size={48} radius={14} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Txt weight="semibold" numberOfLines={1}>{t.title}</Txt>
                    <Txt muted size={Type.tiny} numberOfLines={1}>{s.name} · {b.title}</Txt>
                  </View>
                  <Pressable
                    hitSlop={10}
                    onPress={() => {
                      if (app.favoriteTopics.includes(id)) app.toggleFavoriteTopic(id);
                      if (app.bookmarks.includes(id)) app.toggleBookmark(id);
                    }}
                    accessibilityLabel="Remove from favorites"
                    style={[styles.heart, { backgroundColor: p.surfaceAlt }]}>
                    <Bookmark size={16} color={p.primary} fill={p.primary} strokeWidth={1.6} />
                  </Pressable>
                </Card>
              );
            })}
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  segment: { flexDirection: 'row', borderRadius: 999, padding: 4, marginTop: 22, marginBottom: 18 },
  seg: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 10, borderRadius: 999 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 20 },
  heart: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
});
