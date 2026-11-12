/** AI tools for the booklet editor: rewrite one block of text. */
import { geminiJson } from '@/server/ai';
import { CORS, GeminiError, json } from '@/server/gemini';
import { aiGate } from '@/server/supa';

type Action = 'simplify' | 'fix' | 'translate' | 'bullets' | 'note' | 'expand';

const INSTRUCTIONS: Record<Action, string> = {
  simplify: 'Rewrite the text in simpler, clearer words for a dental student. Keep every fact and all medical terms. Keep the same language.',
  fix: 'Fix spelling, grammar, punctuation, broken line wraps and spacing. Do not change the meaning or the wording beyond what is needed. Keep the same language.',
  translate: 'Translate the text. If it is English translate it to clear Modern Standard Arabic (not a dialect); otherwise translate it to English. Keep medical terms in English inside Arabic text.',
  bullets: 'Turn the text into concise bullet points (items). Keep every fact. Keep the same language.',
  note: 'Condense the text into one short key-point note a student must remember (1-2 sentences). Keep the same language.',
  expand: 'Explain the text in more detail for a dental student, adding standard textbook context. Keep it accurate and in the same language.',
};

const SCHEMA = {
  type: 'OBJECT',
  properties: { text: { type: 'STRING' }, items: { type: 'ARRAY', items: { type: 'STRING' } } },
  required: ['text', 'items'],
};

export function OPTIONS() {
  return new Response(null, { headers: CORS });
}

export async function POST(request: Request) {
  const gate = await aiGate(request, 'user');
  if (gate.denied) return gate.denied;
  let body: { action?: Action; text?: string; topic?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }
  const action = body.action;
  const text = (body.text ?? '').trim().slice(0, 12000);
  if (!action || !INSTRUCTIONS[action]) return json({ error: 'Unknown action' }, 400);
  if (!text) return json({ error: 'Nothing to edit' }, 400);

  const wantsItems = action === 'bullets';
  try {
    const out = await geminiJson<{ text?: string; items?: string[] }>({
      staff: gate.staff,
      system: `You edit study material for BOOKLIT, a dental education app.\n${INSTRUCTIONS[action]}\nReturn JSON: ${wantsItems ? '"items" = the bullet points, "text" = ""' : '"text" = the result as plain text (no Markdown), "items" = []'}.`,
      parts: [{ text: `${body.topic ? `Topic: ${body.topic}\n\n` : ''}Text:\n${text}` }],
      schema: SCHEMA,
      maxTokens: 4096,
    });
    const items = (out.items ?? []).map((s) => String(s).trim()).filter(Boolean);
    const result = String(out.text ?? '').replace(/\*\*(.+?)\*\*/g, '$1').trim();
    if (wantsItems ? !items.length : !result) return json({ error: 'The AI returned an empty result.' }, 502);
    return json(wantsItems ? { items } : { text: result });
  } catch (e) {
    const err = e as GeminiError;
    return json({ error: err.message }, err.status ?? 502);
  }
}
