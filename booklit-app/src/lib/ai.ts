import { getBooklet, getSubject, topicPlainText } from '@/data/content';
import type { Topic } from '@/data/types';

import { log, logError } from './log';
import { consume } from './usage';
import { authHeader } from './api';

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

/** Base URL of the BOOKLIT server routes (src/app/api) on EAS Hosting. */
export const API_BASE = (process.env.EXPO_PUBLIC_API_BASE || 'https://booklit.expo.app').replace(/\/$/, '');

export async function askAI(topic: Topic, history: ChatMessage[]): Promise<string> {
  const booklet = getBooklet(topic.bookletId)!;
  const subject = getSubject(booklet.subjectId)!;
  await consume('ask');
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify({
      subject: subject.name,
      booklet: booklet.title,
      topic: topic.title,
      topicText: topicPlainText(topic).slice(0, 12000),
      // Only the last few turns are needed for context (keeps each request small).
      messages: history.slice(-6),
    }),
    });
  } catch (e) {
    logError('ask-ai', e, { topic: topic.id, step: 'network' });
    throw new Error('Network problem. Check your internet connection.');
  }
  const data = (await res.json().catch(() => ({}))) as { answer?: string; error?: string };
  if (!res.ok || !data.answer) {
    log('error', 'ask-ai', data.error ?? `HTTP ${res.status}`, { topic: topic.id, status: res.status });
    throw new Error(data.error ?? `AI service error (${res.status})`);
  }
  return data.answer;
}
