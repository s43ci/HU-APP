/**
 * File -> booklet conversion (runs on EAS Hosting).
 * Accepts PDF, images, Word (.docx), PowerPoint (.pptx) and plain text / Markdown / HTML.
 * Gemini reads the file, keeps the original language and wording, splits it into topics
 * made of content blocks, and writes practice MCQs for every topic.
 */
import { fetchWithRetry, GeminiError } from '@/server/gemini';
import { geminiPart, readUpload } from '@/server/upload';
import { aiGate } from '@/server/supa';

const MODEL = 'gemini-3.5-flash-lite';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-File-Name, X-File-Type, X-Options, X-Options-B64, X-Platform',
};

const PROMPT = `You convert study material into a structured digital booklet for dental students.

Rules:
- Keep the ORIGINAL language and wording of the document. Do not translate, summarize, shorten or add facts. Reproduce the text faithfully.
- Completeness is mandatory: every sentence, list item, table cell, boxed note and figure caption of the source must appear in the blocks exactly once, in the original order. Never drop content, even if it seems minor or repeated.
- Fix only extraction noise: broken line wraps, hyphenation, page numbers, running headers/footers, and the table of contents. Drop those.
- Split the material into topics that follow the document's own sections and headings, in order. Each topic is one coherent section (usually 2-15 topics in total).
- Inside each topic use blocks. Every block has "type" and "text":
  - "heading" for sub-headings (text)
  - "paragraph" for running text (text)
  - "list" for bulleted or numbered lists (items; text = "")
  - "table" for tables: one block per table with "rows" = every row of the table, the header row first (text = "")
  - "callout" for every boxed, framed or highlighted note, "KEY POINT", "Note", "Remember", warning or tip in the document (text = its full content, title = its label such as "Key point", tone = key | warning | tip)
  - "image" for figures, diagrams, photos or charts (text = the figure caption, or a short description of what it shows)
- Only fill the fields that belong to the block's type.
- For PDFs, give every block "page" = the page number (1-based) where it appears; use 0 for other files.
- "title" is the booklet title (from the document; otherwise a short descriptive title). "language" is the document's main language in English (e.g. "English", "Arabic").
- For every topic write 3 to 5 multiple-choice questions in the same language as the document, based only on that topic. Each has exactly 4 options, answerIndex 0-3 for the correct one, and a one-sentence explanation.`;

/** "Original" mode: layout exactly as in the file. */
const ORIGINAL = `

Original layout mode (on):
- Keep the document exactly as it is laid out: same paragraphs, same lists, same tables, same order, same wording.
- Do NOT add anything: no summaries, no "Key points", no "Exam tip" boxes, no new headings, no rewording, no merging or splitting of paragraphs.
- Use "callout" only for boxes that already exist in the file, and "heading" only for headings that already exist.`;

/** "AI design" mode: same facts, clearer booklet structure. */
const ENHANCE = `

AI design mode (on):
- Keep every fact and sentence of the source, but present it like a well-designed study booklet.
- Turn run-on text that lists things (types, signs, causes, steps) into "list" blocks, and side-by-side comparisons into "table" blocks.
- Turn exam-relevant facts that the source states (classic signs, first-line treatments, "most common" facts, numbers worth memorising) into short "callout" blocks with tone "tip" titled "Exam tip", placed right after the paragraph they come from (keep the original sentence too).
- End every topic with one "callout" block, tone "key", title "Key points", whose text is 3-6 short lines (separated by new lines) summarising the topic.
- Use "heading" blocks to break long topics into clear sub-sections.`;

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

const clip = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

const MCQ_STYLE: Record<string, string> = {
  ministry: 'Write ministry-exam style single-best-answer questions: short stem, 4 options, one clearly correct answer, no "all/none of the above".',
  clinical: 'Write clinical-scenario questions: a short patient case in the stem, then 4 options, one clearly correct answer.',
  mixed: 'Mix direct recall questions and short clinical-scenario questions.',
};

/**
 * What the BOOKLIT team asked for: their standing rules (AI settings), the choices made for this file
 * (number of topics, question style) and free-text instructions for this file, which win over everything.
 */
function guidance(o: Record<string, unknown>) {
  const rules = (o.rules ?? {}) as Record<string, unknown>;
  const parts: string[] = [
    `

Accuracy (always):
- Use ONLY what is written in the document. Never invent facts, numbers, classifications, drug doses or references that are not in it.
- Questions, answers and explanations must be answerable from the topic's own text. If the text is too short for good questions, write fewer.`,
  ];
  const topics = Number(o.topics);
  if (topics >= 1 && topics <= 40) parts.push(`\n\nNumber of topics: split the material into exactly ${Math.round(topics)} topics, in the document's order, each a coherent part of it.`);
  if (typeof o.mcqStyle === 'string' && MCQ_STYLE[o.mcqStyle]) parts.push(`\n\nQuestion style: ${MCQ_STYLE[o.mcqStyle]}`);
  const split = clip(rules.split, 1000);
  const design = clip(rules.design, 1000);
  const mcq = clip(rules.mcq, 1000);
  if (split || design || mcq) {
    parts.push('\n\nRules from the BOOKLIT team (follow them unless they conflict with the accuracy rules):');
    if (split) parts.push(`\n- Splitting into topics: ${split}`);
    if (design && o.design !== 'original') parts.push(`\n- Design: ${design}`);
    if (mcq) parts.push(`\n- Questions: ${mcq}`);
  }
  const extra = clip(o.instructions, 1500);
  if (extra) parts.push(`\n\nInstructions for THIS file (highest priority after accuracy; follow them exactly, including any topic titles or order given):\n${extra}`);
  return parts.join('');
}

type RawBlock = { page?: number; type?: string; text?: string; items?: string[]; headers?: string[]; rows?: string[][]; title?: string; tone?: string; caption?: string };
type RawMcq = { question?: string; options?: string[]; answerIndex?: number; explanation?: string };
type RawBooklet = { title?: string; language?: string; topics?: { title?: string; blocks?: RawBlock[]; mcqs?: RawMcq[] }[] };

export function OPTIONS() {
  return new Response(null, { headers: CORS });
}

export async function POST(request: Request) {
  const denied = await aiGate(request, 'files');
  if (denied) return denied;
  const key = process.env.GEMINI_API_KEY;
  if (!key) return json({ error: 'The conversion service is not configured.' }, 500);

  const read = await readUpload(request);
  if (!read.ok) return json({ error: read.error }, read.status);
  const upload = read.upload;
  const { name, options } = upload;
  const enhanced = options.design !== 'original';
  const perTopic = Math.min(8, Math.max(2, Number(options.questionsPerTopic) || 4));
  const prompt = PROMPT.replace('3 to 5 multiple-choice questions', `${perTopic} multiple-choice questions`) + (enhanced ? ENHANCE : ORIGINAL) + guidance(options);

  // Images are extracted by the app itself (src/lib/pdf-images.ts), so the server only forwards the file.
  let part: Record<string, unknown>;
  let cleanup = async () => {};
  try {
    ({ part, cleanup } = await geminiPart(upload, key));
  } catch (e) {
    return json({ error: (e as Error).message || 'Could not send the file to the AI service.' }, 502);
  }

  let res: Response;
  try {
    res = await fetchWithRetry(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: prompt }] },
        contents: [{ role: 'user', parts: [part, { text: 'Convert this file into the booklet JSON.' }] }],
        generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA, maxOutputTokens: 65536, temperature: 0.2 },
      }),
    }, part.fileData ? 2 : 3, 'import'); // small files can retry once more within the host's call limit
  } catch (e) {
    await cleanup();
    return json({ error: (e as GeminiError).message }, 503);
  }
  await cleanup();
  if (res.status === 429 || res.status === 503) return json({ error: 'The AI service is busy right now. Please try again in a minute.' }, 503);
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    return json({ error: `Conversion failed (${res.status}).`, detail: detail.slice(0, 300) }, 502);
  }

  const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[] };
  const cand = data.candidates?.[0];
  const raw = (cand?.content?.parts ?? []).map((p) => p.text ?? '').join('');
  let parsed: RawBooklet;
  try {
    parsed = JSON.parse(raw) as RawBooklet;
  } catch {
    return json(
      { error: cand?.finishReason === 'MAX_TOKENS' ? 'This file is too long to convert in one go. Please split it into smaller parts.' : 'The conversion returned an unreadable result. Please try again.' },
      502,
    );
  }

  const booklet = clean(parsed, name);
  if (!booklet.topics.length) return json({ error: 'No readable content was found in this file.' }, 422);
  // Each block keeps its PDF page number ("page") so the app can place the images it extracted.
  for (const t of booklet.topics)
    for (const b of t.blocks as { _page?: number; page?: number }[]) {
      b.page = b._page ?? 0;
      delete b._page;
    }
  return json({ booklet, truncated: cand?.finishReason === 'MAX_TOKENS' });
}

// ---------- helpers ----------

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
