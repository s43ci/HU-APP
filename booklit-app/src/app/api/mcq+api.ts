/** Generate practice MCQs for one topic (used by the booklet editor). */
import { geminiJson } from '@/server/ai';
import { CORS, GeminiError, json } from '@/server/gemini';
import { aiGate } from '@/server/supa';

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    mcqs: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          question: { type: 'STRING' },
          options: { type: 'ARRAY', items: { type: 'STRING' } },
          answerIndex: { type: 'INTEGER' },
          explanation: { type: 'STRING' },
        },
        required: ['question', 'options', 'answerIndex', 'explanation'],
      },
    },
  },
  required: ['mcqs'],
};

export function OPTIONS() {
  return new Response(null, { headers: CORS });
}

export async function POST(request: Request) {
  const denied = await aiGate(request, 'user');
  if (denied) return denied;
  let body: { topic?: string; text?: string; count?: number; avoid?: string[]; rules?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }
  const text = (body.text ?? '').trim().slice(0, 30000);
  if (text.length < 40) return json({ error: 'The topic needs more content before questions can be written.' }, 400);
  const count = Math.min(10, Math.max(1, Number(body.count) || 5));
  const avoid = (body.avoid ?? []).slice(0, 30);

  try {
    const out = await geminiJson<{ mcqs?: { question?: string; options?: string[]; answerIndex?: number; explanation?: string }[] }>({
      system: `You write exam-style multiple-choice questions for dental students. Write exactly ${count} questions based only on the topic text, in the same language as the text. Each has exactly 4 plausible options, answerIndex 0-3 for the single correct option (vary its position), and a one-sentence explanation. Never invent facts that are not in the topic text.${typeof body.rules === 'string' && body.rules.trim() ? ` Rules from the BOOKLIT team: ${body.rules.trim().slice(0, 1000)}` : ''}${avoid.length ? ' Do not repeat these existing questions: ' + avoid.join(' | ') : ''}`,
      parts: [{ text: `Topic: ${body.topic ?? ''}\n\n${text}` }],
      schema: SCHEMA,
      maxTokens: 8192,
      temperature: 0.5,
      kind: 'mcq',
    });
    const mcqs = (out.mcqs ?? [])
      .map((q) => ({
        question: String(q.question ?? '').trim(),
        options: (q.options ?? []).map((o) => String(o).trim()).filter(Boolean).slice(0, 5),
        answerIndex: Number(q.answerIndex),
        explanation: String(q.explanation ?? '').trim(),
      }))
      .filter((q) => q.question && q.options.length >= 2 && Number.isInteger(q.answerIndex) && q.answerIndex >= 0 && q.answerIndex < q.options.length);
    if (!mcqs.length) return json({ error: 'No questions were generated. Try again.' }, 502);
    return json({ mcqs });
  } catch (e) {
    const err = e as GeminiError;
    return json({ error: err.message }, err.status ?? 502);
  }
}
