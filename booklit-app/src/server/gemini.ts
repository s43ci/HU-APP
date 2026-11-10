/** Small helper for server routes that call Gemini with a JSON response schema. */
import { countAi, type AiKind } from './usage';
export const GEMINI_MODEL = 'gemini-3.5-flash-lite';

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-File-Name, X-File-Type, X-Options, X-Platform',
};

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...CORS } });
}

/**
 * fetch with one automatic retry for network errors, 429 and 5xx responses
 * (transient Gemini hiccups), so a single blip does not fail the request.
 */
export async function fetchWithRetry(url: string, init: RequestInit, attempts = 2, kind?: AiKind): Promise<Response> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, init);
      if ((res.status === 429 || res.status >= 500) && i < attempts - 1) {
        await new Promise((r) => setTimeout(r, 1200 * (i + 1)));
        continue;
      }
      // Meter tokens and cost for the admin Usage page.
      if (kind && res.ok) {
        const meta = await res
          .clone()
          .json()
          .then((d: { usageMetadata?: Parameters<typeof countAi>[1] }) => d.usageMetadata)
          .catch(() => undefined);
        await countAi(kind, meta);
      }
      return res;
    } catch (e) {
      lastError = e;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, 1200 * (i + 1)));
    }
  }
  throw new GeminiError(`Could not reach the AI service (${(lastError as Error)?.message ?? 'network error'}). Please try again.`, 503);
}

export class GeminiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export async function geminiJson<T>(opts: { system: string; parts: Record<string, unknown>[]; schema: unknown; maxTokens?: number; temperature?: number; kind?: AiKind }): Promise<T> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new GeminiError('The AI service is not configured.', 500);
  const res = await fetchWithRetry(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: opts.system }] },
      contents: [{ role: 'user', parts: opts.parts }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: opts.schema,
        maxOutputTokens: opts.maxTokens ?? 8192,
        temperature: opts.temperature ?? 0.3,
      },
    }),
  }, 2, opts.kind ?? 'edit');
  if (res.status === 429) throw new GeminiError('The AI service is busy. Try again in a minute.', 429);
  if (!res.ok) throw new GeminiError(`AI service error (${res.status}).`, 502);
  const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const raw = (data.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('');
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new GeminiError('The AI returned an unreadable result. Please try again.', 502);
  }
}
