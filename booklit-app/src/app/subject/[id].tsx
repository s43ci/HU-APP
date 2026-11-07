import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { ScreenBar } from '@/components/screen-bar';
import { Icon, IconBadge, ProgressBar, Txt } from '@/components/ui';
import { bookletsOf, getSubject, topicsOf } from '@/data/content';
import { bookletProgress } from '@/lib/progress';
import { useApp } from '@/store/app-store';

export default function SubjectScreen() {
  const { id, booklet } = useLocalSearchParams<{ id: string; booklet?: string }>();
  const subject = getSubject(id);
  const list = bookletsOf(id);
  const [active, setActive] = useState(booklet && list.some((b) => b.id === booklet) ? booklet : list[0]?.id);
  const app = useApp();
  const p = app.palette;
  const { width } = useWindowDimensions();
  const wide = width >= 700;

  if (!subject) return <ScreenBar title="Not found" />;
  const current = list.find((b) => b.id === active);
  const topics = current ? topicsOf(current.id) : [];
  const fav = current ? app.favoriteBooklets.includes(current.id) : false;

  const bookletList = (
    <View style={wide ? { width: 300, borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: p.border, padding: 12 } : undefined}>
      {wide ? null : (
        <Txt weight="semibold" muted size={13} style={{ paddingHorizontal: 18, paddingTop: 14 }}>
          BOOKLETS
        </Txt>
      )}
      <ScrollView
        horizontal={!wide}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={wide ? { gap: 4 } : { gap: 10, padding: 14, paddingHorizontal: 18 }}>
        {list.map((b) => {
          const on = b.id === active;
          const pr = bookletProgress(b.id, app.completedTopics, app.topicProgress);
          return (
            <Pressable
              key={b.id}
              onPress={() => setActive(b.id)}
              style={[
                styles.booklet,
                wide ? null : { width: 190, borderWidth: 1, borderColor: on ? p.primary : p.border },
                { backgroundColor: on ? p.primarySoft : wide ? 'transparent' : p.surface },
              ]}>
              <Icon name="book-open-variant" size={24} color={on ? p.primary : p.icon} />
              <View style={{ flex: 1, gap: 2 }}>
                <Txt weight="bold" size={15} color={on ? p.primary : p.text} numberOfLines={2}>
                  {b.title}
                </Txt>
                <Txt muted size={12.5}>
                  {topicsOf(b.id).length} Topics · {Math.round(pr.pct * 100)}%
                </Txt>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <ScreenBar
        title={subject.name}
        right={
          <Pressable hitSlop={10} onPress={() => router.push('/search')}>
            <Icon name="magnify" size={24} color={p.text} />
          </Pressable>
        }
      />
      <View style={{ flex: 1, flexDirection: wide ? 'row' : 'column' }}>
        {bookletList}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 18, paddingBottom: 40 }}>
          {current ? (
            <>
              <View style={styles.head}>
                <IconBadge name="book-open-variant" size={56} color={subject.color} />
                <View style={{ flex: 1 }}>
                  <Txt weight="extrabold" size={22}>
                    {current.title}
                  </Txt>
                  <Txt muted>{topics.length} Topics</Txt>
                </View>
                <Pressable hitSlop={10} onPress={() => app.toggleFavoriteBooklet(current.id)} accessibilityLabel="Save booklet">
                  <Icon name={fav ? 'heart' : 'heart-outline'} size={26} color={fav ? '#E5484D' : p.icon} />
                </Pressable>
              </View>
              <ProgressBar value={bookletProgress(current.id, app.completedTopics, app.topicProgress).pct} color={subject.color} />
              <View style={{ marginTop: 10 }}>
                {topics.map((t) => {
                  const done = app.completedTopics.includes(t.id);
                  const favT = app.favoriteTopics.includes(t.id);
                  return (
                    <Pressable
                      key={t.id}
                      onPress={() => router.push({ pathname: '/reader/[topicId]', params: { topicId: t.id } })}
                      style={({ pressed }) => [styles.topic, { borderBottomColor: p.border, opacity: pressed ? 0.7 : 1 }]}>
                      <View style={[styles.num, { backgroundColor: done ? subject.color : p.primarySoft }]}>
                        {done ? <Icon name="check" size={16} color="#fff" /> : <Txt weight="semibold" color={p.primary}>{t.order}</Txt>}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Txt weight="medium" size={16}>
                          {t.title}
                        </Txt>
                        <Txt muted size={12}>
                          {t.minutes} min read
                        </Txt>
                      </View>
                      <Pressable hitSlop={10} onPress={() => app.toggleFavoriteTopic(t.id)} accessibilityLabel="Save topic">
                        <Icon name={favT ? 'bookmark' : 'bookmark-outline'} size={20} color={favT ? p.primary : p.icon} />
                      </Pressable>
                      <Icon name="chevron-right" />
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  booklet: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14 },
  topic: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 15, borderBottomWidth: StyleSheet.hairlineWidth },
  num: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
});
