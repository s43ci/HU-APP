/**
 * Ask AI server route (runs on EAS Hosting, never inside the app bundle).
 * Uses Google's Gemini API with a cheap "flash-lite" model.
 * The key is the EAS secret env var GEMINI_API_KEY.
 */
import { fetchWithRetry } from '@/server/gemini';
import { aiGate } from '@/server/supa';

const MODEL = 'gemini-3.5-flash-lite';

type ChatMessage = { role: 'user' | 'assistant'; content: string };
type Body = { subject?: string; booklet?: string; topic?: string; topicText?: string; messages?: ChatMessage[] };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-File-Name, X-File-Type, X-Options',
};

const SYSTEM = `You are BOOKLIT's study assistant for dental students in Iraq.
The student is reading a specific topic in a booklet. Answer questions about that topic and its subject.
- Base your answer on the booklet text provided; add standard textbook knowledge when it helps, and say when something goes beyond the booklet.
- Be accurate and exam-focused: definitions, classifications, key signs, first-line management.
- Keep answers short and easy to scan. Write plain text only: no Markdown, no asterisks, no # headings, no tables. Use "• " for bullet points.
- Reply in the language the student writes in (Arabic or English). Arabic replies must be in clear Modern Standard Arabic (فصحى), never a local dialect, even if the student writes in dialect. Keep medical terms in English.
- If the question is unrelated to dentistry or medicine, politely steer back to the subject.`;

export function OPTIONS() {
  return new Response(null, { headers: CORS });
}

export async function POST(request: Request) {
  const denied = await aiGate(request, 'user');
  if (denied) return denied;
  const key = process.env.GEMINI_API_KEY;
  if (!key) return json({ error: 'AI service is not configured' }, 500);

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const history = (body.messages ?? [])
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-12);
  if (!history.length || history[history.length - 1].role !== 'user') return json({ error: 'Last message must be from the user' }, 400);

  const context = `Subject: ${body.subject ?? ''}\nBooklet: ${body.booklet ?? ''}\nTopic: ${body.topic ?? ''}\n\nBooklet text:\n${(body.topicText ?? '').slice(0, 12000)}`;

  let res: Response;
  try {
    res = await fetchWithRetry(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: `${SYSTEM}\n\n${context}` }] },
        contents: history.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content.slice(0, 4000) }] })),
        generationConfig: { maxOutputTokens: 900, temperature: 0.4 },
      }),
    });
  } catch (e) {
    return json({ error: (e as Error).message }, 503);
  }

  if (res.status === 429) return json({ error: 'Too many requests, try again in a minute.' }, 429);
  if (!res.ok) return json({ error: `AI service error (${res.status})` }, 502);

  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  };
  const answer = (data.candidates?.[0]?.content?.parts ?? [])
    .map((p) => p.text ?? '')
    .join('')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/^\s*[*-]\s+/gm, '• ')
    .trim();
  return json({ answer: answer || "I couldn't answer that one. Try rephrasing your question." });
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...CORS } });
}
