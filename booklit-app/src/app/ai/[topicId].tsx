import { useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View, type ScrollViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenBar } from '@/components/screen-bar';
import { Icon, IconBadge, Txt } from '@/components/ui';
import { Font } from '@/constants/theme';
import { getBooklet, getSubject, getTopic } from '@/data/content';
import { aiConfigured, askAI, type ChatMessage } from '@/lib/ai';
import { useApp } from '@/store/app-store';

const SUGGESTIONS = ['Explain this topic simply', 'Summarize the key points', 'Give me 3 exam questions', 'What do examiners usually ask?'];

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

  if (!topic || !subject) return <ScreenBar title="Ask AI" />;

  const send = async (text: string) => {
    const t = text.trim();
    if (!t || loading) return;
    const history: ChatMessage[] = [...messages, { role: 'user', content: t }];
    setMessages(history);
    setInput('');
    setLoading(true);
    try {
      const answer = await askAI(topic, history);
      setMessages([...history, { role: 'assistant', content: answer }]);
    } catch (e) {
      setMessages([...history, { role: 'assistant', content: `Sorry, I couldn't answer right now. ${(e as Error).message}` }]);
    } finally {
      setLoading(false);
      setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: p.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenBar title="Ask AI" />
      <View style={[styles.context, { backgroundColor: p.primarySoft }]}>
        <Icon name="book-open-variant" size={18} color={p.primary} />
        <Txt size={13} weight="medium" style={{ flex: 1 }} numberOfLines={1}>
          {subject.name} · {topic.title}
        </Txt>
        {!aiConfigured ? (
          <Txt size={11} weight="semibold" color={p.primary}>DEMO</Txt>
        ) : null}
      </View>
      <ScrollView ref={scroll} contentContainerStyle={{ padding: 16, gap: 10, flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        {messages.length === 0 ? (
          <View style={{ alignItems: 'center', paddingTop: 30, gap: 8 }}>
            <IconBadge name="robot-happy-outline" size={68} />
            <Txt weight="bold" size={19} style={{ marginTop: 8 }}>
              Ask about {subject.name}
            </Txt>
            <Txt muted style={{ textAlign: 'center', lineHeight: 21, paddingHorizontal: 20 }}>
              I know the topic you have open ({topic.title}). Ask anything, in English or Arabic.
            </Txt>
            <View style={styles.suggest}>
              {SUGGESTIONS.map((s) => (
                <Pressable key={s} onPress={() => send(s)} style={[styles.sChip, { borderColor: p.border, backgroundColor: p.surface }]}>
                  <Txt size={13} weight="medium">{s}</Txt>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
        {messages.map((m, i) => (
          <View
            key={i}
            style={[
              styles.bubble,
              m.role === 'user'
                ? { alignSelf: 'flex-end', backgroundColor: p.primary, borderBottomRightRadius: 6 }
                : { alignSelf: 'flex-start', backgroundColor: p.surface, borderColor: p.border, borderWidth: StyleSheet.hairlineWidth, borderBottomLeftRadius: 6 },
            ]}>
            <Txt color={m.role === 'user' ? '#fff' : p.text} style={{ lineHeight: 22 }} selectable>
              {m.content}
            </Txt>
          </View>
        ))}
        {loading ? (
          <View style={[styles.bubble, { alignSelf: 'flex-start', backgroundColor: p.surface, flexDirection: 'row', gap: 8, alignItems: 'center' }]}>
            <ActivityIndicator color={p.primary} />
            <Txt muted>Thinking…</Txt>
          </View>
        ) : null}
      </ScrollView>
      <View style={[styles.inputRow, { paddingBottom: insets.bottom + 10, backgroundColor: p.surface, borderTopColor: p.border }]}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Ask a question about this subject…"
          placeholderTextColor={p.textMuted}
          multiline
          style={[styles.input, { color: p.text, backgroundColor: p.surfaceAlt, fontFamily: Font.medium }]}
        />
        <Pressable onPress={() => send(input)} style={[styles.send, { backgroundColor: input.trim() ? p.primary : p.border }]} accessibilityLabel="Send">
          <Icon name="send" size={20} color="#fff" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  context: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 12, padding: 10, borderRadius: 12 },
  suggest: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 14 },
  sChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  bubble: { maxWidth: '86%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 12, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  input: { flex: 1, maxHeight: 120, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15 },
  send: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
