import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';

import { Card, Icon, ProgressBar, SectionTitle, SubjectArt, Txt } from '@/components/ui';
import { booklets, bookletsOf, subjects, topicsOf } from '@/data/content';
import { bookletProgress, isSubjectUnlocked, subjectProgress } from '@/lib/progress';
import { useApp } from '@/store/app-store';

export default function Progress() {
  const app = useApp();
  const p = app.palette;
  const [open, setOpen] = useState<string | null>(null);
  const [all, setAll] = useState(false);

  const available = subjects.filter((s) => isSubjectUnlocked(s.id, app.unlockedSubjects));
  const availableBooklets = booklets.filter((b) => available.some((s) => s.id === b.subjectId));
  const completedBooklets = availableBooklets.filter((b) => {
    const ts = topicsOf(b.id);
    return ts.length && ts.every((t) => app.completedTopics.includes(t.id));
  }).length;
  const totalTopics = available.reduce((n, s) => n + subjectProgress(s.id, []).total, 0);
  const doneTopics = available.reduce((n, s) => n + subjectProgress(s.id, app.completedTopics).done, 0);
  const overall = totalTopics ? doneTopics / totalTopics : 0;

  const sorted = [...available].sort(
    (a, b) => subjectProgress(b.id, app.completedTopics).pct - subjectProgress(a.id, app.completedTopics).pct,
  );
  const shown = all ? sorted : sorted.slice(0, 4);

  return (
    <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
      <Txt weight="extrabold" size={32} style={{ letterSpacing: -0.5 }}>
        Progress
      </Txt>
      <Txt muted size={15} style={{ marginTop: 4 }}>
        Track your study journey
      </Txt>

      <LinearGradient colors={['#17172B', '#26245A', '#3A2F8F']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View style={{ flex: 1, gap: 6 }}>
          <View style={styles.heroIcon}>
            <Icon name="layers-outline" size={26} color="#C9C2FF" />
          </View>
          <Txt weight="bold" size={20} color="#fff" style={{ marginTop: 10 }}>
            Your Progress
          </Txt>
          <Txt size={14} color="rgba(255,255,255,0.75)">
            {completedBooklets} of {availableBooklets.length} booklets
          </Txt>
          <Txt size={13} color="rgba(255,255,255,0.6)">
            {doneTopics} of {totalTopics} topics done
          </Txt>
        </View>
        <Ring value={overall} />
      </LinearGradient>

      <View style={{ marginTop: 24 }}>
        <SectionTitle title="By Subject" action={all ? 'Show Less' : 'View All'} onAction={() => setAll((v) => !v)} />
      </View>
      {shown.map((s) => {
        const pr = subjectProgress(s.id, app.completedTopics);
        const expanded = open === s.id;
        return (
          <Card key={s.id} style={{ padding: 14, marginBottom: 12 }} onPress={() => setOpen(expanded ? null : s.id)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <SubjectArt color={s.color} icon={s.icon} size={52} />
              <View style={{ flex: 1, gap: 4 }}>
                <Txt weight="bold" size={16}>
                  {s.name}
                </Txt>
                <Txt muted size={13}>
                  {pr.done} of {pr.total} topics
                </Txt>
                <ProgressBar value={pr.pct} color={s.color} />
              </View>
              <Txt weight="bold" size={16} style={{ width: 48, textAlign: 'right' }}>
                {Math.round(pr.pct * 100)}%
              </Txt>
              <Icon name={expanded ? 'chevron-up' : 'chevron-down'} />
            </View>
            {expanded ? (
              <View style={{ marginTop: 12, gap: 4 }}>
                {bookletsOf(s.id).map((b) => {
                  const bp = bookletProgress(b.id, app.completedTopics, app.topicProgress);
                  return (
                    <Pressable
                      key={b.id}
                      onPress={() => router.push({ pathname: '/subject/[id]', params: { id: s.id, booklet: b.id } })}
                      style={[styles.bRow, { borderTopColor: p.border }]}>
                      <Txt weight="medium" style={{ flex: 1 }} numberOfLines={1}>
                        {b.title}
                      </Txt>
                      <Txt muted size={12}>
                        {bp.done}/{bp.total}
                      </Txt>
                      <View style={{ width: 70 }}>
                        <ProgressBar value={bp.pct} color={s.color} height={5} />
                      </View>
                      <Icon name="chevron-right" size={18} />
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </Card>
        );
      })}
    </ScrollView>
  );
}

function Ring({ value, size = 124 }: { value: number; size?: number }) {
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgGradient id="g" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#A66BFA" />
            <Stop offset="1" stopColor="#5B8CFF" />
          </SvgGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.12)" strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="url(#g)"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={c * (1 - Math.max(0.001, value))}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <Txt weight="extrabold" size={30} color="#fff">
        {Math.round(value * 100)}%
      </Txt>
      <Txt size={11} color="rgba(255,255,255,0.7)">
        Overall
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', borderRadius: 26, padding: 20, marginTop: 20 },
  heroIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  bRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
});
