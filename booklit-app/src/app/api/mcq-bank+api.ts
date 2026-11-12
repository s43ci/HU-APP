/**
 * Studio production line: upload a question bank (e.g. ministry MCQs) and split it by topic.
 * Every question is extracted as written, its answer is taken from the file when marked
 * (or worked out by the AI and flagged), and it is assigned to the best-matching topic.
 */
import { AiError, runAi, type AiResult, type GSchema } from '@/server/ai';
import { CORS, json } from '@/server/gemini';
import { geminiPart, readUpload } from '@/server/upload';
import { aiGate } from '@/server/supa';

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    questions: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          question: { type: 'STRING' },
          options: { type: 'ARRAY', items: { type: 'STRING' } },
          answerIndex: { type: 'INTEGER', description: 'index of the correct option' },
          answerSource: { type: 'STRING', enum: ['document', 'ai'], description: '"document" if the file marks the answer, "ai" if you worked it out' },
          explanation: { type: 'STRING' },
          topicId: { type: 'STRING', description: 'id of the best matching topic, or "" if none fits' },
        },
        required: ['question', 'options', 'answerIndex', 'answerSource', 'explanation', 'topicId'],
      },
    },
  },
  required: ['questions'],
};

export function OPTIONS() {
  return new Response(null, { headers: CORS });
}

export async function POST(request: Request) {
  const gate = await aiGate(request, 'files');
  if (gate.denied) return gate.denied;
  const key = process.env.GEMINI_API_KEY;
  if (!key) return json({ error: 'The AI service is not configured.' }, 500);
  const read = await readUpload(request);
  if (!read.ok) return json({ error: read.error }, read.status);
  const { options } = read.upload;

  const topics = (Array.isArray(options.topics) ? options.topics : [])
    .map((t: { id?: string; title?: string }) => ({ id: String(t.id ?? ''), title: String(t.title ?? '') }))
    .filter((t: { id: string; title: string }) => t.id && t.title)
    .slice(0, 200);
  if (!topics.length) return json({ error: 'Choose the booklet the questions belong to.' }, 400);

  const system = `You process a bank of multiple-choice questions for dental students.
Extract EVERY multiple-choice question in the file, in order. Do not skip, merge or invent questions.
- Copy the question and options exactly as written (same language). Remove numbering such as "1." or "a)" from the start.
- answerIndex: if the file marks the correct answer (answer key, "Ans:", bold, underline, asterisk, tick), use it and set answerSource "document". Otherwise work out the correct answer yourself and set answerSource "ai".
- explanation: the explanation from the file if there is one, otherwise one short sentence explaining the answer.
- topicId: the id of the topic below that the question belongs to. Use "" only if no topic fits.

Topics:
${topics.map((t: { id: string; title: string }) => `${t.id} = ${t.title}`).join('\n')}`;

  let part: Record<string, unknown>;
  let cleanup = async () => {};
  try {
    ({ part, cleanup } = await geminiPart(read.upload, key));
  } catch (e) {
    return json({ error: (e as Error).message || 'Could not send the file to the AI service.' }, 502);
  }

  // Gemini -> backup Gemini model (small files only, host call limit) -> Claude.
  let out: AiResult;
  try {
    out = await runAi({
      staff: gate.staff,
      kind: 'bank',
      system,
      messages: [{ role: 'user', text: 'Extract and assign all questions.' }],
      file: { geminiPart: part, bytes: read.upload.bytes, mime: read.upload.fileMime, text: read.upload.text },
      schema: SCHEMA as GSchema,
      maxTokens: 65536,
      temperature: 0.1,
      backup: !part.fileData,
      effort: 'medium',
    });
  } catch (e) {
    await cleanup();
    const err = e as AiError;
    return json({ error: err.finish === 'MAX_TOKENS' ? 'This bank is too long for one upload. Split it into smaller files.' : err.message }, err.status ?? 503);
  }
  await cleanup();
  let parsed: { questions?: { question?: string; options?: string[]; answerIndex?: number; answerSource?: string; explanation?: string; topicId?: string }[] };
  try {
    parsed = JSON.parse(out.text);
  } catch {
    return json({ error: out.finish === 'MAX_TOKENS' ? 'This bank is too long for one upload. Split it into smaller files.' : 'The result could not be read. Please try again.' }, 502);
  }

  const ids = new Set(topics.map((t: { id: string }) => t.id));
  const questions = (parsed.questions ?? [])
    .map((q) => {
      const opts = (q.options ?? []).map((o) => String(o).trim()).filter(Boolean).slice(0, 6);
      const idx = Number(q.answerIndex);
      return {
        question: String(q.question ?? '').trim(),
        options: opts,
        answerIndex: Number.isInteger(idx) && idx >= 0 && idx < opts.length ? idx : 0,
        answerFromAi: q.answerSource !== 'document' || !(Number.isInteger(idx) && idx >= 0 && idx < opts.length),
        explanation: String(q.explanation ?? '').trim(),
        topicId: ids.has(String(q.topicId)) ? String(q.topicId) : '',
      };
    })
    .filter((q) => q.question && q.options.length >= 2);
  if (!questions.length) return json({ error: 'No multiple-choice questions were found in this file.' }, 422);
  return json({ questions, truncated: out.finish === 'MAX_TOKENS' });
}
