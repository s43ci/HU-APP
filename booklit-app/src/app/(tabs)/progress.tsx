import { router } from 'expo-router';
import { ChevronDown, ChevronRight, ChevronUp, Flame, ListChecks, Target } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { Card, Heading, Icon, Page, ProgressBar, SectionTitle, SubjectThumb, Txt, TabHeader } from '@/components/ui';
import { Type } from '@/constants/theme';
import { booklets, bookletsOf, subjects, topicsOf } from '@/data/content';
import { bookletProgress, isSubjectUnlocked, subjectProgress } from '@/lib/progress';
import { useApp } from '@/store/app-store';

export default function Progress() {
  'use no memo'; // reads the shared content lists, which change when booklets are published or deleted
  const app = useApp();
  const p = app.palette;
  const [open, setOpen] = useState<string | null>(null);
  const [all, setAll] = useState(false);

  const available = subjects.filter((s) => isSubjectUnlocked(s.id, app.unlockedSubjects) && bookletsOf(s.id).length);
  const availableBooklets = booklets.filter((b) => available.some((s) => s.id === b.subjectId));
  const completedBooklets = availableBooklets.filter((b) => {
    const ts = topicsOf(b.id);
    return ts.length && ts.every((t) => app.completedTopics.includes(t.id));
  }).length;
  const totalTopics = available.reduce((n, s) => n + subjectProgress(s.id, []).total, 0);
  const doneTopics = available.reduce((n, s) => n + subjectProgress(s.id, app.completedTopics).done, 0);
  const overall = totalTopics ? doneTopics / totalTopics : 0;
  const accuracy = app.quiz.answered ? Math.round((app.quiz.correct / app.quiz.answered) * 100) : 0;

  const sorted = [...available].sort((a, b) => subjectProgress(b.id, app.completedTopics).pct - subjectProgress(a.id, app.completedTopics).pct);
  const shown = all ? sorted : sorted.slice(0, 4);

  return (
    <Page>
      <TabHeader title="Progress" />
      <View style={{ marginTop: 14 }}>
        <Heading light="Track your" strong="study journey." />
      </View>

      <Card style={styles.overview}>
        <Ring value={overall} color={p.primary} track={p.surfaceAlt} text={p.text} muted={p.textMuted} />
        <View style={{ flex: 1, gap: 12 }}>
          <Stat label="Booklets done" value={`${completedBooklets}/${availableBooklets.length}`} />
          <Stat label="Topics done" value={`${doneTopics}/${totalTopics}`} />
        </View>
      </Card>

      <View style={styles.mini}>
        <MiniStat icon={Target} label="Accuracy" value={`${accuracy}%`} />
        <MiniStat icon={ListChecks} label="Answered" value={`${app.quiz.answered}`} />
        <MiniStat icon={Flame} label="Streak" value={`${app.streak}d`} />
      </View>

      <SectionTitle title="By subject" action={sorted.length > 4 ? (all ? 'Show less' : 'View all') : undefined} onAction={() => setAll((v) => !v)} />
      <View style={{ gap: 10 }}>
        {shown.map((s) => {
          const pr = subjectProgress(s.id, app.completedTopics);
          const expanded = open === s.id;
          return (
            <Card key={s.id} style={{ padding: 12, borderRadius: 20 }} onPress={() => setOpen(expanded ? null : s.id)}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <SubjectThumb subjectId={s.id} size={44} radius={14} />
                <View style={{ flex: 1, gap: 6 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Txt weight="semibold" numberOfLines={1} style={{ flex: 1 }}>{s.name}</Txt>
                    <Txt weight="medium" size={Type.small} color={p.primary}>{Math.round(pr.pct * 100)}%</Txt>
                  </View>
                  <ProgressBar value={pr.pct} />
                  <Txt faint size={Type.tiny}>{pr.done} of {pr.total} topics</Txt>
                </View>
                <Icon as={expanded ? ChevronUp : ChevronDown} size={18} color={p.textFaint} />
              </View>
              {expanded ? (
                <View style={{ marginTop: 10 }}>
                  {bookletsOf(s.id).map((b) => {
                    const bp = bookletProgress(b.id, app.completedTopics, app.topicProgress);
                    return (
                      <Pressable
                        key={b.id}
                        onPress={() => router.push({ pathname: '/subject/[id]', params: { id: s.id, booklet: b.id } })}
                        style={[styles.bRow, { borderTopColor: p.border }]}>
                        <Txt size={Type.small} style={{ flex: 1 }} numberOfLines={1}>{b.title}</Txt>
                        <Txt faint size={Type.tiny}>{bp.done}/{bp.total}</Txt>
                        <View style={{ width: 56 }}><ProgressBar value={bp.pct} height={3} /></View>
                        <Icon as={ChevronRight} size={16} color={p.textFaint} />
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
            </Card>
          );
        })}
      </View>
    </Page>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Txt weight="semibold" size={Type.h2}>{value}</Txt>
      <Txt muted size={Type.tiny}>{label}</Txt>
    </View>
  );
}

function MiniStat({ icon, label, value }: { icon: Parameters<typeof Icon>[0]['as']; label: string; value: string }) {
  const { palette: p } = useApp();
  return (
    <View style={[styles.miniStat, { backgroundColor: p.surface }]}>
      <View style={[styles.miniIcon, { backgroundColor: p.primarySoft }]}>
        <Icon as={icon} size={16} color={p.primary} />
      </View>
      <Txt weight="semibold" size={Type.h2}>{value}</Txt>
      <Txt muted size={Type.tiny}>{label}</Txt>
    </View>
  );
}

function Ring({ value, color, track, text, muted, size = 112 }: { value: number; color: string; track: string; text: string; muted: string; size?: number }) {
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        {value > 0 ? (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={color}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${c} ${c}`}
            strokeDashoffset={c * (1 - value)}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        ) : null}
      </Svg>
      <Txt weight="semibold" size={24} color={text}>{Math.round(value * 100)}%</Txt>
      <Txt size={10.5} color={muted}>overall</Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  overview: { flexDirection: 'row', alignItems: 'center', gap: 22, padding: 18, marginTop: 22, borderRadius: 24 },
  mini: { flexDirection: 'row', gap: 10, marginTop: 12, marginBottom: 26 },
  miniStat: { flex: 1, borderRadius: 20, padding: 14, gap: 4 },
  miniIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  bRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
});
