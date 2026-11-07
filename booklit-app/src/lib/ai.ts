import { getBooklet, getSubject, topicPlainText } from '@/data/content';
import type { Topic } from '@/data/types';

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

/**
 * URL of the BOOKLIT AI proxy (see /ai-proxy). The Claude API key lives only on the proxy,
 * never inside the app. Set EXPO_PUBLIC_AI_URL in booklit-app/.env.
 */
const AI_URL = process.env.EXPO_PUBLIC_AI_URL;

export const aiConfigured = !!AI_URL;

export async function askAI(topic: Topic, history: ChatMessage[]): Promise<string> {
  const booklet = getBooklet(topic.bookletId)!;
  const subject = getSubject(booklet.subjectId)!;

  if (!AI_URL) return offlineAnswer(topic, history[history.length - 1]?.content ?? '');

  const res = await fetch(AI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subject: subject.name,
      booklet: booklet.title,
      topic: topic.title,
      topicText: topicPlainText(topic),
      messages: history,
    }),
  });
  if (!res.ok) throw new Error(`AI service error (${res.status})`);
  const data = (await res.json()) as { answer?: string; error?: string };
  if (!data.answer) throw new Error(data.error ?? 'Empty answer');
  return data.answer;
}

/** Fallback used until the proxy is deployed: answers from the topic text only. */
function offlineAnswer(topic: Topic, question: string): string {
  const words = question.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
  const sentences = topicPlainText(topic)
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.replace(/^- /, '').trim())
    .filter((s) => s.length > 20 && !s.startsWith('[Figure'));
  const scored = sentences
    .map((s) => ({ s, n: words.reduce((k, w) => k + (s.toLowerCase().includes(w) ? 1 : 0), 0) }))
    .sort((a, b) => b.n - a.n);
  const best = (scored[0]?.n ? scored.slice(0, 4) : scored.slice(0, 4)).map((x) => `• ${x.s}`);
  return `From "${topic.title}":\n\n${best.join('\n')}\n\n(Demo mode: the AI service is not connected yet, so this answer comes from the booklet text only.)`;
}
