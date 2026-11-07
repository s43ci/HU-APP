/** Small helper for server routes that call Gemini with a JSON response schema. */
export const GEMINI_MODEL = 'gemini-3.5-flash-lite';

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...CORS } });
}

export class GeminiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export async function geminiJson<T>(opts: { system: string; parts: Record<string, unknown>[]; schema: unknown; maxTokens?: number; temperature?: number }): Promise<T> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new GeminiError('The AI service is not configured.', 500);
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
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
  });
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
