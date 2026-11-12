/**
 * One way to ask the AI, with automatic backups (server only).
 *
 *   1. Gemini (main model)
 *   2. Gemini (backup model, separate capacity) — when the request can afford one more outgoing call
 *   3. Claude (Anthropic) — only if ANTHROPIC_API_KEY is set
 *
 * The next one is tried when the previous is busy (429 / 5xx / network), or its answer is unusable
 * (empty, stopped by a filter, or not the JSON asked for). Every call is metered for the Usage page.
 */
import Anthropic from '@anthropic-ai/sdk';

import { fetchWithRetry, GeminiError, GEMINI_MODEL } from './gemini';
import { countAi, type AiKind } from './usage';

/** Backup Gemini model: a different model has its own capacity, so it is rarely busy at the same time. */
export const GEMINI_BACKUP_MODEL = 'gemini-3.1-flash-lite';
/** Claude model used when both Gemini models fail. */
export const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-opus-5-5';
// USD per 1M tokens (input, output) for the Usage page.
const CLAUDE_PRICES: Record<string, { in: number; out: number }> = {
  'claude-opus-5-5': { in: 4, out: 20 },
  'claude-sonnet-5-5': { in: 2, out: 10 },
  'claude-haiku-5-5': { in: 0.1, out: 0.5 },
};
const GEMINI_PRICES: Record<string, { in: number; out: number }> = {
  [GEMINI_MODEL]: { in: 0.3, out: 2.5 },
  [GEMINI_BACKUP_MODEL]: { in: 0.25, out: 1.5 },
};

/** Gemini-style response schema (type names in capitals). */
export type GSchema = { type: string; properties?: Record<string, GSchema>; items?: GSchema; required?: string[]; enum?: string[]; description?: string; minItems?: number; maxItems?: number };

export type AiInput = {
  kind: AiKind;
  system: string;
  /** The conversation; the last message is the user's request. */
  messages: { role: 'user' | 'assistant'; text: string }[];
  /** A file sent with the last user message. */
  file?: { geminiPart: Record<string, unknown>; bytes: Uint8Array; mime: string; text: string | null };
  /** JSON shape of the answer (Gemini format; converted for Claude). */
  schema?: GSchema;
  maxTokens: number;
  temperature?: number;
  /** Try the backup Gemini model too (costs one more outgoing call; skip for big files). */
  backup?: boolean;
  /** Claude thinking effort: low for quick replies, medium for building booklets. */
  effort?: 'low' | 'medium' | 'high';
};

export type AiResult = { text: string; finish: string; provider: string };

export class AiError extends Error {
  constructor(message: string, public status: number, public finish = '') {
    super(message);
  }
}

const BUSY = 'The AI service is busy right now. Please try again in a minute.';

/** Gemini answer -> text + why it stopped. */
async function askGemini(model: string, input: AiInput): Promise<AiResult> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new AiError('The AI service is not configured.', 500);
  // Testing only (never set in production): AI_SIMULATE_BUSY=<model,...> makes these models act busy.
  if ((process.env.AI_SIMULATE_BUSY ?? '').split(',').includes(model)) throw new AiError(BUSY, 503);
  const contents = input.messages.map((m, i) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [...(input.file && i === input.messages.length - 1 ? [input.file.geminiPart] : []), { text: m.text }],
  }));
  let res: Response;
  try {
    res = await fetchWithRetry(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: input.system }] },
          contents,
          generationConfig: {
            maxOutputTokens: input.maxTokens,
            temperature: input.temperature ?? 0.3,
            ...(input.schema ? { responseMimeType: 'application/json', responseSchema: input.schema } : {}),
          },
        }),
      },
      1, // no retry here: the next model in the chain is the retry
    );
  } catch (e) {
    throw new AiError((e as GeminiError).message || BUSY, 503);
  }
  if (res.status === 429 || res.status >= 500) throw new AiError(BUSY, 503);
  if (!res.ok) throw new AiError(`AI service error (${res.status}).`, 502);
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
  };
  await countAi(input.kind, data.usageMetadata, GEMINI_PRICES[model]);
  const cand = data.candidates?.[0];
  const text = (cand?.content?.parts ?? []).map((p) => p.text ?? '').join('');
  return { text, finish: cand?.finishReason ?? '', provider: model };
}

/** Gemini response schema -> JSON Schema for Claude's structured outputs. */
function toJsonSchema(s: GSchema): Record<string, unknown> {
  const t = s.type.toLowerCase();
  const out: Record<string, unknown> = { type: t };
  if (s.description) out.description = s.description;
  if (s.enum) out.enum = s.enum;
  if (t === 'array' && s.items) out.items = toJsonSchema(s.items);
  if (t === 'object') {
    out.properties = Object.fromEntries(Object.entries(s.properties ?? {}).map(([k, v]) => [k, toJsonSchema(v)]));
    out.required = s.required ?? [];
    out.additionalProperties = false;
  }
  return out;
}

let claude: Anthropic | null = null;

/** Claude answer (only used when both Gemini models failed). */
async function askClaude(input: AiInput): Promise<AiResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new AiError(BUSY, 503);
  // maxRetries 0: each retry would be one more outgoing call, and the host allows only a few per request.
  claude ??= new Anthropic({ apiKey, maxRetries: 0 });

  const fileBlock = (): Anthropic.Beta.BetaContentBlockParam[] => {
    const f = input.file;
    if (!f) return [];
    if (f.text !== null) return [{ type: 'text', text: f.text }];
    const data = toB64(f.bytes);
    if (f.mime === 'application/pdf') return [{ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } }];
    if (/^image\/(jpeg|png|gif|webp)$/.test(f.mime))
      return [{ type: 'image', source: { type: 'base64', media_type: f.mime as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp', data } }];
    return [];
  };
  const messages: Anthropic.Beta.BetaMessageParam[] = input.messages.map((m, i) => ({
    role: m.role,
    content: i === input.messages.length - 1 && m.role === 'user' ? [...fileBlock(), { type: 'text', text: m.text }] : m.text,
  }));

  const params = {
    model: CLAUDE_MODEL,
    max_tokens: input.maxTokens,
    system: input.system,
    messages,
    output_config: {
      effort: input.effort ?? 'medium',
      ...(input.schema ? { format: { type: 'json_schema' as const, schema: toJsonSchema(input.schema) } } : {}),
    },
    // If Claude declines on a safety classifier, the API re-runs the request on a suitable model.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default' as const,
  };
  let msg: Anthropic.Beta.BetaMessage;
  try {
    // Long answers (whole booklets) are streamed so the request does not time out.
    msg = input.maxTokens > 16000 ? await claude.beta.messages.stream(params).finalMessage() : await claude.beta.messages.create(params);
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError || e instanceof Anthropic.InternalServerError || e instanceof Anthropic.APIConnectionError) throw new AiError(BUSY, 503);
    if (e instanceof Anthropic.APIError) throw new AiError(`Backup AI error (${e.status ?? 'network'}).`, 502);
    throw new AiError(BUSY, 503);
  }
  const prices = CLAUDE_PRICES[CLAUDE_MODEL] ?? CLAUDE_PRICES['claude-opus-5-5'];
  await countAi(input.kind, { promptTokenCount: msg.usage.input_tokens, candidatesTokenCount: msg.usage.output_tokens }, prices);
  const text = msg.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
  const finish = msg.stop_reason === 'max_tokens' ? 'MAX_TOKENS' : msg.stop_reason === 'refusal' ? 'SAFETY' : 'STOP';
  return { text, finish, provider: CLAUDE_MODEL };
}

function toB64(bytes: Uint8Array) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

/** An answer is usable when it has text and, if JSON was asked for, the text is valid JSON. */
function usable(r: AiResult, json: boolean) {
  if (r.finish === 'MAX_TOKENS') return true; // the caller explains "file too long"; another model would not help
  if (!r.text.trim()) return false;
  if (!json) return true;
  try {
    JSON.parse(r.text);
    return true;
  } catch {
    return false;
  }
}

/** Ask the AI: Gemini, then the backup Gemini model, then Claude. Throws AiError when all fail. */
export async function runAi(input: AiInput): Promise<AiResult> {
  const steps: (() => Promise<AiResult>)[] = [() => askGemini(GEMINI_MODEL, input)];
  if (input.backup !== false) steps.push(() => askGemini(GEMINI_BACKUP_MODEL, input));
  if (process.env.ANTHROPIC_API_KEY) steps.push(() => askClaude(input));
  let last: AiError = new AiError(BUSY, 503);
  let lastResult: AiResult | null = null;
  for (const step of steps) {
    try {
      const r = await step();
      if (usable(r, !!input.schema)) return r;
      lastResult = r;
      last = new AiError('The AI returned an unreadable result. Please try again.', 502, r.finish || 'BROKEN');
    } catch (e) {
      last = e instanceof AiError ? e : new AiError(BUSY, 503);
    }
  }
  if (lastResult && lastResult.finish) last.finish = lastResult.finish;
  throw last;
}

/** Ask for JSON in the given shape (translate, editor tools, question writing). */
export async function geminiJson<T>(opts: { system: string; parts: Record<string, unknown>[]; schema: unknown; maxTokens?: number; temperature?: number; kind?: AiKind }): Promise<T> {
  // Gemini -> backup Gemini model -> Claude.
  try {
    const r = await runAi({
      kind: opts.kind ?? 'edit',
      system: opts.system,
      messages: [{ role: 'user', text: opts.parts.map((p) => (typeof p.text === 'string' ? p.text : '')).join('\n\n') }],
      schema: opts.schema as GSchema,
      maxTokens: opts.maxTokens ?? 8192,
      temperature: opts.temperature,
      effort: 'low',
    });
    return JSON.parse(r.text) as T;
  } catch (e) {
    if (e instanceof AiError) throw new GeminiError(e.message, e.status);
    throw new GeminiError('The AI returned an unreadable result. Please try again.', 502);
  }
}
