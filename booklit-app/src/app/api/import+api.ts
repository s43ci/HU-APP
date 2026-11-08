/**
 * File -> booklet conversion (runs on EAS Hosting).
 * Accepts PDF, images, Word (.docx), PowerPoint (.pptx) and plain text / Markdown / HTML.
 * Gemini reads the file, keeps the original language and wording, splits it into topics
 * made of content blocks, and writes practice MCQs for every topic.
 */
import { fetchWithRetry, GeminiError } from '@/server/gemini';
import { extractPdfImages, type ExtractedImage } from '@/server/pdf-images';
import { readUpload, toBase64 } from '@/server/upload';

const MODEL = 'gemini-3.5-flash-lite';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
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

type RawBlock = { page?: number; type?: string; text?: string; items?: string[]; headers?: string[]; rows?: string[][]; title?: string; tone?: string; caption?: string };
type RawMcq = { question?: string; options?: string[]; answerIndex?: number; explanation?: string };
type RawBooklet = { title?: string; language?: string; topics?: { title?: string; blocks?: RawBlock[]; mcqs?: RawMcq[] }[] };

export function OPTIONS() {
  return new Response(null, { headers: CORS });
}

export async function POST(request: Request) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return json({ error: 'The conversion service is not configured.' }, 500);

  const read = await readUpload(request);
  if (!read.ok) return json({ error: read.error }, read.status);
  const { name, mime, ext, bytes, part, options } = read.upload;
  const enhanced = options.design !== 'original';
  const perTopic = Math.min(8, Math.max(2, Number(options.questionsPerTopic) || 4));
  const prompt = PROMPT.replace('3 to 5 multiple-choice questions', `${perTopic} multiple-choice questions`) + (enhanced ? ENHANCE : '');

  // Pull pictures out of PDFs while the AI reads the text.
  const isPdf = ext === 'pdf' || mime === 'application/pdf';
  const imagesPromise: Promise<ExtractedImage[]> = isPdf ? extractPdfImages(bytes).catch(() => []) : Promise.resolve([]);

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
    });
  } catch (e) {
    return json({ error: (e as GeminiError).message }, 503);
  }
  if (res.status === 429) return json({ error: 'The service is busy. Try again in a minute.' }, 429);
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
  const images = await imagesPromise;
  placeImages(booklet.topics, images);
  for (const t of booklet.topics) for (const b of t.blocks as { _page?: number }[]) delete b._page;
  return json({
    booklet,
    images: images.map((im, i) => ({ ref: i, mime: im.mime, data: toBase64(im.data) })),
    truncated: cand?.finishReason === 'MAX_TOKENS',
  });
}

// ---------- helpers ----------

type PlacedBlock = { type: string; caption?: string; imageRef?: number; icon?: string; _page?: number };

/**
 * Put each extracted picture into the booklet:
 * 1) into a figure block from the same page (in order), else
 * 2) as a new figure right after the last block from that page (or an earlier one).
 */
function placeImages(topics: { blocks: unknown[] }[], images: ExtractedImage[]) {
  if (!images.length) return;
  const pages = Math.max(1, ...images.map((im) => im.page));
  const known = topics.some((t) => (t.blocks as PlacedBlock[]).some((b) => (b._page ?? 0) > 0));
  images.forEach((im, ref) => {
    for (const t of topics) {
      const fig = (t.blocks as PlacedBlock[]).find((b) => b.type === 'image' && b.imageRef == null && b._page === im.page);
      if (fig) {
        fig.imageRef = ref;
        return;
      }
    }
    const block: PlacedBlock = { type: 'image', caption: '', icon: 'image', imageRef: ref, _page: im.page };
    if (known) {
      let target: { t: number; i: number } | null = null;
      topics.forEach((t, ti) =>
        (t.blocks as PlacedBlock[]).forEach((b, bi) => {
          if ((b._page ?? 0) > 0 && (b._page ?? 0) <= im.page) target = { t: ti, i: bi };
        }),
      );
      const tg = target as { t: number; i: number } | null;
      if (tg) {
        topics[tg.t].blocks.splice(tg.i + 1, 0, block);
        return;
      }
    }
    // No page information: place proportionally through the booklet.
    const ti = Math.min(topics.length - 1, Math.floor(((im.page - 1) / pages) * topics.length));
    topics[ti].blocks.push(block);
  });
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
