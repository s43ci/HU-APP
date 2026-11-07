import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenBar } from '@/components/screen-bar';
import { Button, Card, EmptyState, Icon, ProgressBar, Txt, withAlpha } from '@/components/ui';
import { Brand } from '@/constants/theme';
import { getTopic, mcqsOf } from '@/data/content';
import type { Mcq } from '@/data/types';
import { useApp } from '@/store/app-store';

type Mode = 'ministry' | 'instructor' | 'quiz';
const TITLES: Record<Mode, string> = { ministry: 'Ministry MCQs', instructor: 'Instructor MCQs', quiz: 'Quiz Mode' };

export default function Quiz() {
  const { topicId, mode: rawMode } = useLocalSearchParams<{ topicId: string; mode?: string }>();
  const mode: Mode = rawMode === 'instructor' || rawMode === 'quiz' ? rawMode : 'ministry';
  const topic = getTopic(topicId);
  const app = useApp();
  const p = app.palette;
  const insets = useSafeAreaInsets();

  // Only questions linked to the current topic.
  const [questions] = useState<Mcq[]>(() => {
    const qs = mode === 'quiz' ? mcqsOf(topicId) : mcqsOf(topicId, mode);
    return mode === 'quiz' ? [...qs].sort(() => Math.random() - 0.5) : qs;
  });

  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(() => questions.map(() => null));
  const [finished, setFinished] = useState(false);

  if (!topic) return <ScreenBar title="Not found" />;
  if (!questions.length)
    return (
      <View style={{ flex: 1, backgroundColor: p.bg }}>
        <ScreenBar title={TITLES[mode]} />
        <EmptyState icon="help-circle-outline" title="No questions yet" text="Questions for this topic will be added soon." />
      </View>
    );

  const q = questions[i];
  const chosen = answers[i];
  const practice = mode !== 'quiz';
  const revealed = practice && chosen !== null;
  const score = answers.reduce<number>((n, a, k) => n + (a === questions[k].answerIndex ? 1 : 0), 0);

  const choose = (opt: number) => {
    if (revealed || finished) return;
    const next = [...answers];
    next[i] = opt;
    setAnswers(next);
    if (practice) app.recordAnswer(opt === q.answerIndex);
  };

  const finish = () => {
    if (!practice) answers.forEach((a, k) => app.recordAnswer(a === questions[k].answerIndex));
    setFinished(true);
  };

  if (finished) {
    const pct = score / questions.length;
    return (
      <View style={{ flex: 1, backgroundColor: p.bg }}>
        <ScreenBar title="Result" />
        <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 30 }}>
          <Card style={{ padding: 22, alignItems: 'center' }}>
            <Txt muted>{topic.title}</Txt>
            <Txt weight="extrabold" size={48} color={pct >= 0.6 ? Brand.success : Brand.danger} style={{ marginTop: 6 }}>
              {Math.round(pct * 100)}%
            </Txt>
            <Txt weight="semibold">
              {score} of {questions.length} correct
            </Txt>
          </Card>
          <Txt weight="bold" size={18} style={{ marginTop: 22, marginBottom: 10 }}>
            Review answers
          </Txt>
          {questions.map((qq, k) => {
            const ok = answers[k] === qq.answerIndex;
            return (
              <Card key={qq.id} style={{ padding: 14, marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Icon name={ok ? 'check-circle' : 'close-circle'} size={20} color={ok ? Brand.success : Brand.danger} />
                  <Txt weight="semibold" style={{ flex: 1 }}>
                    {qq.question}
                  </Txt>
                </View>
                {!ok && answers[k] !== null ? (
                  <Txt size={13} color={Brand.danger} style={{ marginTop: 6 }}>
                    Your answer: {qq.options[answers[k]!]}
                  </Txt>
                ) : null}
                <Txt size={13} color={Brand.success} style={{ marginTop: 4 }}>
                  Correct: {qq.options[qq.answerIndex]}
                </Txt>
                <Txt muted size={13} style={{ marginTop: 4, lineHeight: 19 }}>
                  {qq.explanation}
                </Txt>
              </Card>
            );
          })}
          <View style={{ gap: 10, marginTop: 8 }}>
            <Button label="Try again" icon="refresh" onPress={() => { setAnswers(questions.map(() => null)); setI(0); setFinished(false); }} />
            <Button label="Back to topic" variant="ghost" onPress={() => router.back()} />
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <ScreenBar title={TITLES[mode]} />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 30 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
          <Txt muted size={13} numberOfLines={1} style={{ flex: 1 }}>
            {topic.title}
          </Txt>
          <Txt weight="semibold" size={13}>
            {i + 1} / {questions.length}
          </Txt>
        </View>
        <ProgressBar value={(i + 1) / questions.length} />
        <View style={[styles.tag, { backgroundColor: p.primarySoft }]}>
          <Txt weight="semibold" size={12} color={p.primary}>
            {q.source === 'ministry' ? 'Ministry' : 'Instructor'}
          </Txt>
        </View>
        <Txt weight="bold" size={20} style={{ lineHeight: 28, marginBottom: 18 }}>
          {q.question}
        </Txt>
        {q.options.map((opt, k) => {
          const isChosen = chosen === k;
          const isRight = k === q.answerIndex;
          let border = p.border;
          let bg = p.surface;
          if (revealed && isRight) { border = Brand.success; bg = withAlpha(Brand.success, 0.1); }
          else if (revealed && isChosen) { border = Brand.danger; bg = withAlpha(Brand.danger, 0.08); }
          else if (isChosen) { border = p.primary; bg = p.primarySoft; }
          return (
            <Pressable key={k} onPress={() => choose(k)} style={[styles.opt, { borderColor: border, backgroundColor: bg }]}>
              <View style={[styles.letter, { borderColor: border }]}>
                <Txt weight="bold" size={13}>{String.fromCharCode(65 + k)}</Txt>
              </View>
              <Txt weight="medium" style={{ flex: 1, lineHeight: 21 }}>{opt}</Txt>
              {revealed && isRight ? <Icon name="check-circle" color={Brand.success} /> : null}
              {revealed && isChosen && !isRight ? <Icon name="close-circle" color={Brand.danger} /> : null}
            </Pressable>
          );
        })}
        {revealed ? (
          <Card style={{ padding: 14, marginTop: 6 }}>
            <Txt weight="bold" color={chosen === q.answerIndex ? Brand.success : Brand.danger}>
              {chosen === q.answerIndex ? 'Correct!' : 'Not quite'}
            </Txt>
            <Txt muted style={{ marginTop: 4, lineHeight: 21 }}>{q.explanation}</Txt>
          </Card>
        ) : null}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + 12, borderTopColor: p.border, backgroundColor: p.surface }]}>
        <Button label="Previous" variant="ghost" style={{ flex: 1, opacity: i === 0 ? 0.4 : 1 }} onPress={() => i > 0 && setI(i - 1)} />
        {i < questions.length - 1 ? (
          <Button label="Next" icon="arrow-right" style={{ flex: 1 }} onPress={() => setI(i + 1)} />
        ) : (
          <Button label={practice ? 'Finish' : 'Submit'} icon="flag-checkered" style={{ flex: 1 }} onPress={finish} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginTop: 18, marginBottom: 10 },
  opt: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderRadius: 16, padding: 14, marginBottom: 10 },
  letter: { width: 30, height: 30, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  footer: { flexDirection: 'row', gap: 10, padding: 14, borderTopWidth: StyleSheet.hairlineWidth },
});
