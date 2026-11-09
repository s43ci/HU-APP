import { router, useLocalSearchParams } from 'expo-router';
import { ArrowRight, CircleCheck, CircleHelp, CircleX, RotateCcw } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Card, EmptyState, Icon, ProgressBar, TopBar, Txt, withAlpha } from '@/components/ui';
import { Brand, Font, Type } from '@/constants/theme';
import { getTopic, mcqsOf } from '@/data/content';
import type { Mcq } from '@/data/types';
import { IS_AR, t as tt } from '@/i18n';
import { useApp } from '@/store/app-store';

type Mode = 'ministry' | 'instructor' | 'quiz';
const TITLES: Record<Mode, string> = { ministry: 'Ministry MCQs', instructor: 'Instructor MCQs', quiz: 'Quiz Mode' };
const SOURCE: Record<Mcq['source'], string> = { ministry: 'Ministry', instructor: 'Instructor', generated: 'Practice' };

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

  if (!topic) return <TopBar title="Not found" />;
  if (!questions.length)
    return (
      <View style={{ flex: 1, backgroundColor: p.bg }}>
        <TopBar title={TITLES[mode]} />
        <EmptyState icon={CircleHelp} title="No questions yet" text="Questions for this topic will be added soon." action="Back to topic" onAction={() => router.back()} />
      </View>
    );

  const q = questions[i];
  const chosen = answers[i];
  const practice = mode !== 'quiz';
  const revealed = practice && chosen !== null;
  const score = answers.reduce<number>((n, a, k) => n + (a === questions[k].answerIndex ? 1 : 0), 0);
  const answeredCount = answers.filter((a) => a !== null).length;

  const choose = (opt: number) => {
    if (revealed) return;
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
        <TopBar title="Result" />
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 30 }}>
          <Card style={{ padding: 24, alignItems: 'center' }}>
            <Txt muted size={Type.small}>{topic.title}</Txt>
            <Txt weight="semibold" size={44} color={pct >= 0.6 ? Brand.success : Brand.danger} style={{ marginTop: 6, letterSpacing: -1 }}>
              {Math.round(pct * 100)}%
            </Txt>
            <Txt weight="medium" size={Type.small}>{IS_AR ? `${score} إجابات صحيحة من ${questions.length}` : `${score} of ${questions.length} correct`}</Txt>
          </Card>
          <Txt weight="semibold" size={Type.h2} style={{ marginTop: 24, marginBottom: 12 }}>Review answers</Txt>
          {questions.map((qq, k) => {
            const ok = answers[k] === qq.answerIndex;
            return (
              <Card key={qq.id} style={{ padding: 16, marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Icon as={ok ? CircleCheck : CircleX} size={18} color={ok ? Brand.success : Brand.danger} />
                  <Txt weight="medium" style={{ flex: 1, lineHeight: 21 }}>{qq.question}</Txt>
                </View>
                {!ok ? (
                  <Txt size={Type.small} color={Brand.danger} style={{ marginTop: 8, marginLeft: 28 }}>
                    {tt('Your answer:')} {answers[k] !== null ? qq.options[answers[k]!] : tt('Not answered')}
                  </Txt>
                ) : null}
                <Txt size={Type.small} color={Brand.success} style={{ marginTop: 4, marginLeft: 28 }}>{tt('Correct:')} {qq.options[qq.answerIndex]}</Txt>
                <Txt muted size={Type.small} style={{ marginTop: 6, marginLeft: 28, lineHeight: 19 }}>{qq.explanation}</Txt>
              </Card>
            );
          })}
          <View style={{ gap: 10, marginTop: 8 }}>
            <Button label="Try again" icon={RotateCcw} onPress={() => { setAnswers(questions.map(() => null)); setI(0); setFinished(false); }} />
            <Button label="Back to topic" variant="outline" onPress={() => router.back()} />
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <TopBar title={TITLES[mode]} right={<Txt weight="medium" size={Type.small} muted>{i + 1}/{questions.length}</Txt>} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 30 }}>
        <ProgressBar value={(i + 1) / questions.length} />
        <View style={styles.metaRow}>
          <View style={[styles.tag, { backgroundColor: p.primarySoft }]}>
            <Txt weight="medium" size={Type.tiny} color={p.primary}>{SOURCE[q.source]}</Txt>
          </View>
          <Txt faint size={Type.tiny} numberOfLines={1} style={{ flex: 1 }}>{topic.title}</Txt>
        </View>
        <Txt weight="semibold" size={18} style={{ lineHeight: 26, marginBottom: 18 }}>{q.question}</Txt>
        {q.options.map((opt, k) => {
          const isChosen = chosen === k;
          const isRight = k === q.answerIndex;
          let border = p.border;
          let bg = p.surface;
          if (revealed && isRight) { border = Brand.success; bg = withAlpha(Brand.success, 0.08); }
          else if (revealed && isChosen) { border = Brand.danger; bg = withAlpha(Brand.danger, 0.06); }
          else if (isChosen) { border = p.primary; bg = p.primarySoft; }
          return (
            <Pressable key={k} onPress={() => choose(k)} style={({ pressed }) => [styles.opt, { borderColor: border, backgroundColor: bg }, pressed && !revealed && { opacity: 0.85 }]}>
              <View style={[styles.letter, { borderColor: isChosen && !revealed ? p.primary : p.border, backgroundColor: isChosen && !revealed ? p.primary : 'transparent' }]}>
                <Txt weight="medium" size={Type.tiny} color={isChosen && !revealed ? '#fff' : p.textMuted}>{String.fromCharCode(65 + k)}</Txt>
              </View>
              <Txt style={{ flex: 1, lineHeight: 21 }}>{opt}</Txt>
              {revealed && isRight ? <Icon as={CircleCheck} size={19} color={Brand.success} /> : null}
              {revealed && isChosen && !isRight ? <Icon as={CircleX} size={19} color={Brand.danger} /> : null}
            </Pressable>
          );
        })}
        {revealed ? (
          <View style={[styles.explain, { backgroundColor: p.surface }]}>
            <Txt weight="semibold" size={Type.small} color={chosen === q.answerIndex ? Brand.success : Brand.danger}>
              {chosen === q.answerIndex ? 'Correct' : 'Not quite'}
            </Txt>
            <Txt muted size={Type.small} style={{ marginTop: 4, lineHeight: 20 }}>{q.explanation}</Txt>
          </View>
        ) : null}
        {!practice ? (
          <Txt faint size={Type.tiny} style={{ textAlign: 'center', marginTop: 10, fontFamily: Font.regular }}>
            {IS_AR ? `أجبت عن ${answeredCount} من ${questions.length} · تظهر النتيجة بعد التسليم` : `${answeredCount}/${questions.length} answered · results appear when you submit`}
          </Txt>
        ) : null}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Button label="Previous" variant="outline" style={{ flex: 1 }} disabled={i === 0} onPress={() => setI(i - 1)} />
        {i < questions.length - 1 ? (
          <Button label="Next" icon={ArrowRight} style={{ flex: 1 }} onPress={() => setI(i + 1)} />
        ) : (
          <Button label={practice ? 'Finish' : 'Submit'} variant="primary" style={{ flex: 1 }} onPress={finish} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 18, marginBottom: 12 },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  opt: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 18, padding: 14, marginBottom: 10 },
  letter: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  explain: { borderRadius: 18, padding: 14, marginTop: 6 },
  footer: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 10 },
});
