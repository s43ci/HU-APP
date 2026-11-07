import { getBooklet, getSubject, topicPlainText } from '@/data/content';
import type { Topic } from '@/data/types';

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

/** Base URL of the BOOKLIT server routes (src/app/api) on EAS Hosting. */
export const API_BASE = (process.env.EXPO_PUBLIC_API_BASE || 'https://booklit.expo.app').replace(/\/$/, '');

export async function askAI(topic: Topic, history: ChatMessage[]): Promise<string> {
  const booklet = getBooklet(topic.bookletId)!;
  const subject = getSubject(booklet.subjectId)!;
  const res = await fetch(`${API_BASE}/api/ask`, {
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
  const data = (await res.json().catch(() => ({}))) as { answer?: string; error?: string };
  if (!res.ok || !data.answer) throw new Error(data.error ?? `AI service error (${res.status})`);
  return data.answer;
}
