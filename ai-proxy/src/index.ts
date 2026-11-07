/**
 * BOOKLIT AI proxy (Cloudflare Worker).
 * The app sends the open topic + chat history; this worker calls Claude with the API key,
 * which is stored as a Worker secret (never inside the mobile app).
 *
 *   npx wrangler secret put ANTHROPIC_API_KEY
 *   npm run deploy
 */
import Anthropic from '@anthropic-ai/sdk';

interface Env {
  ANTHROPIC_API_KEY: string;
}

type ChatMessage = { role: 'user' | 'assistant'; content: string };
type Body = { subject: string; booklet: string; topic: string; topicText: string; messages: ChatMessage[] };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const SYSTEM = `You are BOOKLIT's study assistant for dental students in Iraq.
The student is reading a specific topic in a booklet. Answer questions about that topic and its subject.
- Base your answer on the booklet text provided first; add standard textbook knowledge when it helps, and say when something goes beyond the booklet.
- Be accurate and exam-focused: definitions, classifications, key signs, first-line management.
- Keep answers short and scannable (short paragraphs or bullet points). Use plain text, not Markdown headings or tables.
- Reply in the language the student writes in (Arabic or English). Keep medical terms in English.
- If the question is unrelated to dentistry or medicine, politely steer back to the subject.`;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (request.method !== 'POST') return json({ error: 'POST only' }, 405);

    let body: Body;
    try {
      body = (await request.json()) as Body;
    } catch {
      return json({ error: 'Invalid JSON' }, 400);
    }
    const messages = (body.messages ?? [])
      .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
      .slice(-12)
      .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));
    if (!messages.length || messages[0].role !== 'user') return json({ error: 'messages must start with a user turn' }, 400);

    const context = `Subject: ${body.subject}\nBooklet: ${body.booklet}\nTopic: ${body.topic}\n\nBooklet text:\n${(body.topicText ?? '').slice(0, 20000)}`;

    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    try {
      const response = await client.beta.messages.create({
        model: 'claude-opus-5-5',
        max_tokens: 16000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'low' },
        system: [
          { type: 'text', text: SYSTEM },
          { type: 'text', text: context, cache_control: { type: 'ephemeral' } },
        ],
        messages,
      });

      if (response.stop_reason === 'refusal') {
        return json({ answer: "I can't help with that one. Try asking about the topic you're studying." });
      }
      const answer = response.content
        .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('\n')
        .trim();
      return json({ answer: answer || 'No answer was returned. Please try again.' });
    } catch (error) {
      if (error instanceof Anthropic.RateLimitError) return json({ error: 'Too many requests, try again in a minute.' }, 429);
      if (error instanceof Anthropic.AuthenticationError) return json({ error: 'AI service is not configured.' }, 500);
      if (error instanceof Anthropic.APIError) return json({ error: `AI service error (${error.status})` }, 502);
      return json({ error: 'AI service unavailable' }, 502);
    }
  },
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...CORS } });
}
