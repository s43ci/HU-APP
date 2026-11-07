import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Card, EmptyState, Icon, SubjectArt, Txt } from '@/components/ui';
import { getBooklet, getSubject, getTopic, stageName, topicsOf } from '@/data/content';
import { useApp } from '@/store/app-store';

export default function Favorites() {
  const app = useApp();
  const p = app.palette;
  const [tab, setTab] = useState<'booklets' | 'topics'>('booklets');

  const items =
    tab === 'booklets'
      ? app.favoriteBooklets.map((id) => getBooklet(id)).filter((b) => !!b)
      : [...new Set([...app.favoriteTopics, ...app.bookmarks])].map((id) => getTopic(id)).filter((t) => !!t);

  return (
    <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
      <Txt weight="extrabold" size={32} style={{ letterSpacing: -0.5 }}>
        Favorites
      </Txt>
      <Txt muted size={15} style={{ marginTop: 4 }}>
        Your saved booklets and topics
      </Txt>

      <View style={[styles.segment, { backgroundColor: p.surfaceAlt, borderColor: p.border }]}>
        {(['booklets', 'topics'] as const).map((k) => {
          const on = tab === k;
          return (
            <Pressable key={k} onPress={() => setTab(k)} style={[styles.seg, on && { backgroundColor: p.primary }]}>
              <Icon name={k === 'booklets' ? 'book-open-variant' : 'bookmark-outline'} size={20} color={on ? '#fff' : p.icon} />
              <Txt weight="semibold" color={on ? '#fff' : p.text}>
                {k === 'booklets' ? 'Booklets' : 'Topics'}
              </Txt>
            </Pressable>
          );
        })}
      </View>

      {items.length === 0 ? (
        <EmptyState
          icon={tab === 'booklets' ? 'heart-outline' : 'bookmark-outline'}
          title={tab === 'booklets' ? 'No saved booklets yet' : 'No saved topics yet'}
          text={
            tab === 'booklets'
              ? 'Tap the heart on any booklet to keep it here for quick access.'
              : 'Tap the bookmark on any topic, or bookmark it while reading.'
          }
          action="Browse Library"
          onAction={() => router.push('/library')}
        />
      ) : null}

      {tab === 'booklets'
        ? app.favoriteBooklets.map((id) => {
            const b = getBooklet(id);
            const s = b && getSubject(b.subjectId);
            if (!b || !s) return null;
            return (
              <Card key={id} style={styles.row} onPress={() => router.push({ pathname: '/subject/[id]', params: { id: s.id, booklet: b.id } })}>
                <SubjectArt color={s.color} icon={s.icon} size={64} />
                <View style={{ flex: 1 }}>
                  <Txt weight="bold" size={17}>{b.title}</Txt>
                  <Txt muted size={13}>{s.name} · {stageName(s.stageId)}</Txt>
                  <Txt muted size={12}>{topicsOf(b.id).length} topics</Txt>
                </View>
                <Pressable hitSlop={10} onPress={() => app.toggleFavoriteBooklet(id)} accessibilityLabel="Remove from favorites">
                  <Icon name="heart" size={24} color="#E5484D" />
                </Pressable>
              </Card>
            );
          })
        : [...new Set([...app.favoriteTopics, ...app.bookmarks])].map((id) => {
            const t = getTopic(id);
            const b = t && getBooklet(t.bookletId);
            const s = b && getSubject(b.subjectId);
            if (!t || !b || !s) return null;
            return (
              <Card key={id} style={styles.row} onPress={() => router.push({ pathname: '/reader/[topicId]', params: { topicId: t.id } })}>
                <SubjectArt color={s.color} icon={s.icon} size={56} />
                <View style={{ flex: 1 }}>
                  <Txt weight="bold" size={16}>{t.title}</Txt>
                  <Txt muted size={13} numberOfLines={1}>{s.name} · {b.title}</Txt>
                </View>
                <Pressable
                  hitSlop={10}
                  onPress={() => {
                    if (app.favoriteTopics.includes(id)) app.toggleFavoriteTopic(id);
                    if (app.bookmarks.includes(id)) app.toggleBookmark(id);
                  }}
                  accessibilityLabel="Remove from favorites">
                  <Icon name="bookmark" size={24} color={p.primary} />
                </Pressable>
              </Card>
            );
          })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  segment: { flexDirection: 'row', borderRadius: 999, padding: 5, borderWidth: 1, marginTop: 20, marginBottom: 18 },
  seg: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 11, borderRadius: 999 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12, marginBottom: 12 },
});
