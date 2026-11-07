import { useLocalSearchParams } from 'expo-router';
import { BookOpen, Bot, Languages, ListChecks, Send, Sparkles, WandSparkles } from 'lucide-react-native';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type ScrollViewInstance,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Heading, Icon, TopBar, Txt, type LucideIcon } from '@/components/ui';
import { Font, Type } from '@/constants/theme';
import { getBooklet, getSubject, getTopic } from '@/data/content';
import { askAI, type ChatMessage } from '@/lib/ai';
import { useApp } from '@/store/app-store';

const SUGGESTIONS: { label: string; prompt: string; icon: LucideIcon }[] = [
  { label: 'Explain simply', prompt: 'Explain this topic simply.', icon: WandSparkles },
  { label: 'Key points', prompt: 'Summarize the key points I must remember.', icon: ListChecks },
  { label: 'Exam questions', prompt: 'Give me 3 likely exam questions with short answers.', icon: Sparkles },
  { label: 'اشرح بالعربي', prompt: 'اشرح لي هذا الموضوع بالعربي بشكل مبسط.', icon: Languages },
];

export default function AskAI() {
  const { topicId } = useLocalSearchParams<{ topicId: string }>();
  const topic = getTopic(topicId);
  const booklet = topic && getBooklet(topic.bookletId);
  const subject = booklet && getSubject(booklet.subjectId);
  const { palette: p } = useApp();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scroll = useRef<ScrollViewInstance>(null);

  if (!topic || !subject) return <TopBar title="Ask AI" />;

  const send = async (text: string) => {
    const t = text.trim();
    if (!t || loading) return;
    const history: ChatMessage[] = [...messages, { role: 'user', content: t }];
    setMessages(history);
    setInput('');
    setLoading(true);
    setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
    try {
      const answer = await askAI(topic, history);
      setMessages([...history, { role: 'assistant', content: answer }]);
    } catch (e) {
      setMessages([...history, { role: 'assistant', content: `Sorry, I couldn't answer right now. ${(e as Error).message}` }]);
    } finally {
      setLoading(false);
      setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 80);
    }
  };

  const empty = messages.length === 0;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: p.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <TopBar
        right={
          <View style={[styles.badge, { backgroundColor: p.surface }]}>
            <Icon as={Sparkles} size={14} color={p.primary} />
            <Txt weight="medium" size={Type.tiny}>AI Study Buddy</Txt>
          </View>
        }
      />
      <ScrollView ref={scroll} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16, flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        {empty ? (
          <View style={styles.hero}>
            <View style={[styles.orbOuter, { backgroundColor: p.primarySoft }]}>
              <View style={[styles.orbMid, { backgroundColor: p.primary + '33' }]}>
                <View style={[styles.orb, { backgroundColor: p.primary }]}>
                  <Icon as={Bot} size={30} color="#fff" />
                </View>
              </View>
            </View>
            <View style={{ marginTop: 28, alignItems: 'center' }}>
              <Heading light="How can I help" strong="you today?" size={26} />
            </View>
            <View style={[styles.context, { backgroundColor: p.surface }]}>
              <Icon as={BookOpen} size={14} color={p.primary} />
              <Txt size={Type.tiny} weight="medium" numberOfLines={1}>{subject.name} · {topic.title}</Txt>
            </View>
          </View>
        ) : (
          <View style={{ gap: 10, paddingTop: 8 }}>
            {messages.map((m, i) => (
              <View
                key={i}
                style={[
                  styles.bubble,
                  m.role === 'user'
                    ? { alignSelf: 'flex-end', backgroundColor: p.ink, borderBottomRightRadius: 6 }
                    : { alignSelf: 'flex-start', backgroundColor: p.surface, borderBottomLeftRadius: 6 },
                ]}>
                <Txt
                  color={m.role === 'user' ? p.onInk : p.text}
                  style={{ lineHeight: 22, writingDirection: /[؀-ۿ]/.test(m.content.slice(0, 40)) ? 'rtl' : 'auto' }}
                  selectable>
                  {m.content}
                </Txt>
              </View>
            ))}
            {loading ? (
              <View style={[styles.bubble, { alignSelf: 'flex-start', backgroundColor: p.surface, flexDirection: 'row', gap: 8, alignItems: 'center' }]}>
                <ActivityIndicator color={p.primary} size="small" />
                <Txt muted size={Type.small}>Thinking…</Txt>
              </View>
            ) : null}
          </View>
        )}
      </ScrollView>

      <View style={{ paddingBottom: insets.bottom + 10 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggest} keyboardShouldPersistTaps="handled">
          {SUGGESTIONS.map((s) => (
            <Pressable key={s.label} onPress={() => send(s.prompt)} style={({ pressed }) => [styles.sChip, { backgroundColor: p.surface, borderColor: p.border }, pressed && { opacity: 0.8 }]}>
              <Icon as={s.icon} size={14} color={p.primary} />
              <Txt size={Type.small} weight="medium">{s.label}</Txt>
            </Pressable>
          ))}
        </ScrollView>
        <View style={[styles.inputCard, { backgroundColor: p.surface, borderColor: p.border }]}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Ask a question…"
            placeholderTextColor={p.textFaint}
            multiline
            style={[styles.input, { color: p.text, fontFamily: Font.regular }]}
          />
          <View style={styles.inputRow}>
            <View style={[styles.pill, { backgroundColor: p.surfaceAlt }]}>
              <Icon as={BookOpen} size={13} color={p.textMuted} />
              <Txt size={Type.tiny} muted numberOfLines={1} style={{ maxWidth: 180 }}>{topic.title}</Txt>
            </View>
            <Pressable
              onPress={() => send(input)}
              disabled={!input.trim() || loading}
              style={[styles.send, { backgroundColor: input.trim() ? p.primary : p.surfaceAlt }]}
              accessibilityLabel="Send">
              <Icon as={Send} size={17} color={input.trim() ? '#fff' : p.textFaint} />
            </Pressable>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 999 },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 30 },
  orbOuter: { width: 150, height: 150, borderRadius: 75, alignItems: 'center', justifyContent: 'center' },
  orbMid: { width: 108, height: 108, borderRadius: 54, alignItems: 'center', justifyContent: 'center' },
  orb: { width: 70, height: 70, borderRadius: 35, alignItems: 'center', justifyContent: 'center' },
  context: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, marginTop: 16, maxWidth: '90%' },
  bubble: { maxWidth: '86%', borderRadius: 20, paddingHorizontal: 15, paddingVertical: 11 },
  suggest: { gap: 8, paddingHorizontal: 20, paddingBottom: 10 },
  sChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8 },
  inputCard: { marginHorizontal: 16, borderRadius: 24, borderWidth: 1, padding: 12 },
  input: { minHeight: 40, maxHeight: 120, fontSize: 14.5, paddingHorizontal: 4, paddingTop: 4 },
  inputRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  send: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
