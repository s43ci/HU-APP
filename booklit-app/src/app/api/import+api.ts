/**
 * File -> booklet conversion (runs on EAS Hosting).
 * Accepts PDF, images, Word (.docx), PowerPoint (.pptx) and plain text / Markdown / HTML.
 * Gemini follows ONE fixed prompt (src/server/prompt.ts, the ENKIDU method) or, for a single booklet,
 * the prompt written for it; the app output format is always added. MCQs are written for every topic.
 */
import { AiError, runAi, type AiResult, type GSchema } from '@/server/ai';
import { geminiPart, readUpload } from '@/server/upload';
import { appFormat, ENKIDU_PROMPT } from '@/server/prompt';
import { aiGate } from '@/server/supa';


const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-File-Name, X-File-Type, X-Options, X-Options-B64, X-Platform',
};

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING' },
    language: { type: 'STRING' },
    topics: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING' },
          blocks: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                type: { type: 'STRING', enum: ['heading', 'paragraph', 'list', 'table', 'callout', 'image'] },
                text: { type: 'STRING', description: 'heading/paragraph/callout text, or the figure caption; "" for list and table' },
                items: { type: 'ARRAY', items: { type: 'STRING' }, description: 'list items (list blocks only)' },
                rows: {
                  type: 'ARRAY',
                  items: { type: 'ARRAY', items: { type: 'STRING' } },
                  description: 'table blocks only: ALL rows of the table, the header row first, one array of cell strings per row',
                },
                title: { type: 'STRING', description: 'callout label, e.g. "Key point" (callout blocks only)' },
                tone: { type: 'STRING', enum: ['key', 'warning', 'tip'], description: 'callout blocks only' },
                page: { type: 'INTEGER', description: 'PDF page number where the block appears, 0 if unknown' },
              },
              required: ['type', 'text'],
            },
          },
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
        required: ['title', 'blocks', 'mcqs'],
      },
    },
  },
  required: ['title', 'language', 'topics'],
};

type RawBlock = { page?: number; type?: string; text?: string; items?: string[]; headers?: string[]; rows?: string[][]; title?: string; tone?: string; caption?: string };
type RawMcq = { question?: string; options?: string[]; answerIndex?: number; explanation?: string };
type RawBooklet = { title?: string; language?: string; topics?: { title?: string; blocks?: RawBlock[]; mcqs?: RawMcq[] }[] };

export function OPTIONS() {
  return new Response(null, { headers: CORS });
}

export async function POST(request: Request) {
  const gate = await aiGate(request, 'files');
  if (gate.denied) return gate.denied;
  const key = process.env.GEMINI_API_KEY;
  if (!key) return json({ error: 'The conversion service is not configured.' }, 500);

  const read = await readUpload(request);
  if (!read.ok) return json({ error: read.error }, read.status);
  const upload = read.upload;
  const { name, options } = upload;
  const perTopic = Math.min(8, Math.max(2, Number(options.questionsPerTopic) || 4));
  const n = Math.round(Number(options.topics));
  const topics = n >= 1 && n <= 40 ? n : null;
  // The fixed prompt, unless this booklet has its own; the app format is always added.
  const own = typeof options.prompt === 'string' ? options.prompt.trim().slice(0, 8000) : '';
  const prompt = (own || ENKIDU_PROMPT) + appFormat({ topics, perTopic });
  // The number of topics is also enforced by the response shape.
  const schema = topics ? { ...SCHEMA, properties: { ...SCHEMA.properties, topics: { ...SCHEMA.properties.topics, minItems: topics, maxItems: topics } } } : SCHEMA;

  // Images are extracted by the app itself (src/lib/pdf-images.ts), so the server only forwards the file.
  let part: Record<string, unknown>;
  let cleanup = async () => {};
  try {
    ({ part, cleanup } = await geminiPart(upload, key));
  } catch (e) {
    return json({ error: (e as Error).message || 'Could not send the file to the AI service.' }, 502);
  }

  // Gemini -> backup Gemini model -> Claude. Big files (sent through Gemini's file upload) skip the
  // backup Gemini model: the host allows only ~8 outgoing calls per request and the upload uses some.
  let out: AiResult;
  try {
    out = await runAi({
      staff: gate.staff,
      kind: 'import',
      system: prompt,
      messages: [{ role: 'user', text: topics ? `Convert this file into the booklet JSON with exactly ${topics} topics.` : 'Convert this file into the booklet JSON.' }],
      file: { geminiPart: part, bytes: upload.bytes, mime: upload.fileMime, text: upload.text },
      schema: schema as GSchema,
      maxTokens: 65536,
      temperature: 0.2,
      backup: !part.fileData,
      effort: 'medium',
    });
  } catch (e) {
    await cleanup();
    const err = e as AiError;
    const why =
      err.finish === 'MAX_TOKENS'
        ? 'This file is too long to convert in one go. Please split it into smaller parts.'
        : err.finish === 'RECITATION'
          ? "The AI stopped because it would copy long passages word for word (Google's copyright filter). Try again, or split the file into smaller parts."
          : err.finish === 'SAFETY' || err.finish === 'PROHIBITED_CONTENT'
            ? 'The AI refused this file (safety filter). Try again, or remove the pages that may trigger it.'
            : err.message;
    return json({ error: why, detail: err.finish ? `finishReason: ${err.finish}` : undefined }, err.status ?? 503);
  }
  await cleanup();
  let parsed: RawBooklet;
  try {
    parsed = JSON.parse(out.text) as RawBooklet;
  } catch {
    return json({ error: out.finish === 'MAX_TOKENS' ? 'This file is too long to convert in one go. Please split it into smaller parts.' : 'The conversion returned an unreadable result. Please try again.', detail: `finishReason: ${out.finish}` }, 502);
  }
  const cand = { finishReason: out.finish };

  const booklet = clean(parsed, name);
  if (!booklet.topics.length) return json({ error: 'No readable content was found in this file.' }, 422);
  if (topics && booklet.topics.length > topics) booklet.topics = mergeTopics(booklet.topics, topics);
  // Each block keeps its PDF page number ("page") so the app can place the images it extracted.
  for (const t of booklet.topics)
    for (const b of t.blocks as { _page?: number; page?: number }[]) {
      b.page = b._page ?? 0;
      delete b._page;
    }
  return json({ booklet, truncated: cand?.finishReason === 'MAX_TOKENS' });
}

// ---------- helpers ----------

type CleanTopic = ReturnType<typeof clean>['topics'][number];

/** Join neighbouring topics (in order) until there are exactly `n`; each joined part keeps its title as a heading. */
function mergeTopics(list: CleanTopic[], n: number): CleanTopic[] {
  const out: CleanTopic[] = [];
  const size = list.length / n;
  for (let g = 0; g < n; g++) {
    const part = list.slice(Math.round(g * size), Math.round((g + 1) * size));
    if (!part.length) continue;
    const [first, ...rest] = part;
    out.push({
      title: first.title,
      blocks: [...first.blocks, ...rest.flatMap((t) => [{ type: 'heading', text: t.title, _page: (t.blocks[0] as { _page?: number })?._page ?? 0 }, ...t.blocks])],
      mcqs: part.flatMap((t) => t.mcqs),
    } as CleanTopic);
  }
  return out;
}

function clean(b: RawBooklet, fileName: string) {
  const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const topics = (b.topics ?? [])
    .map((t) => {
      const blocks = (t.blocks ?? [])
        .map((x) => {
          switch (x.type) {
            case 'heading':
            case 'paragraph':
              return s(x.text) ? { type: x.type, text: s(x.text) } : null;
            case 'list': {
              const items = (x.items ?? []).map(s).filter(Boolean);
              return items.length ? { type: 'list', items } : null;
            }
            case 'table': {
              const all = (x.rows ?? []).map((r) => (r ?? []).map(s)).filter((r) => r.some(Boolean));
              // Header row comes first in "rows" (older responses may still use "headers").
              const headers = x.headers?.length ? x.headers.map(s) : (all[0] ?? []);
              const rows = x.headers?.length ? all : all.slice(1);
              if (!headers.length || (!rows.length && headers.length < 2)) return null;
              const width = Math.max(headers.length, ...rows.map((r) => r.length));
              const pad = (r: string[]) => [...r, ...Array(Math.max(0, width - r.length)).fill('')];
              return { type: 'table', headers: pad(headers), rows: rows.map(pad) };
            }
            case 'callout': {
              const tone = x.tone === 'warning' || x.tone === 'tip' ? x.tone : 'key';
              return s(x.text) ? { type: 'callout', tone, title: s(x.title) || 'Key point', text: s(x.text) } : null;
            }
            case 'image':
              return s(x.caption) || s(x.text) ? { type: 'image', caption: s(x.caption) || s(x.text), icon: 'image' } : null;
            default:
              return s(x.text) ? { type: 'paragraph', text: s(x.text) } : null;
          }
        })
        .map((blk, k) => (blk ? { ...blk, _page: Number((t.blocks ?? [])[k]?.page) || 0 } : null))
        .filter(Boolean);
      const mcqs = (t.mcqs ?? [])
        .map((q) => ({
          question: s(q.question),
          options: (q.options ?? []).map(s).filter(Boolean).slice(0, 5),
          answerIndex: Number.isInteger(q.answerIndex) ? Number(q.answerIndex) : 0,
          explanation: s(q.explanation),
        }))
        .filter((q) => q.question && q.options.length >= 2 && q.answerIndex >= 0 && q.answerIndex < q.options.length);
      const title = s(t.title) || 'Untitled section';
      // The reader already shows the topic title, so drop a leading heading that repeats it.
      const first = blocks[0] as { type: string; text?: string } | undefined;
      if (first?.type === 'heading' && first.text?.toLowerCase() === title.toLowerCase()) blocks.shift();
      return { title, blocks, mcqs };
    })
    .filter((t) => t.blocks.length);
  return { title: s(b.title) || fileName.replace(/\.[^.]+$/, ''), language: s(b.language) || 'Unknown', topics };
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...CORS } });
}
