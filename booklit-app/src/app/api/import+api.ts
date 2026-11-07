/**
 * File -> booklet conversion (runs on EAS Hosting).
 * Accepts PDF, images, Word (.docx), PowerPoint (.pptx) and plain text / Markdown / HTML.
 * Gemini reads the file, keeps the original language and wording, splits it into topics
 * made of content blocks, and writes practice MCQs for every topic.
 */
import { strFromU8, unzipSync } from 'fflate';

const MODEL = 'gemini-3.5-flash-lite';
const MAX_BYTES = 18 * 1024 * 1024;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const INLINE_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
};
const TEXT_EXT = ['txt', 'md', 'markdown', 'csv', 'html', 'htm', 'rtf'];

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
  - "table" for tables (headers + rows; every row has the same number of cells as headers; text = "")
  - "callout" for every boxed, framed or highlighted note, "KEY POINT", "Note", "Remember", warning or tip in the document (text = its full content, title = its label such as "Key point", tone = key | warning | tip)
  - "image" for figures, diagrams, photos or charts (text = the figure caption, or a short description of what it shows)
- "title" is the booklet title (from the document; otherwise a short descriptive title). "language" is the document's main language in English (e.g. "English", "Arabic").
- For every topic write 3 to 5 multiple-choice questions in the same language as the document, based only on that topic. Each has exactly 4 options, answerIndex 0-3 for the correct one, and a one-sentence explanation.`;

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
                text: { type: 'STRING' },
                items: { type: 'ARRAY', items: { type: 'STRING' } },
                headers: { type: 'ARRAY', items: { type: 'STRING' } },
                rows: { type: 'ARRAY', items: { type: 'ARRAY', items: { type: 'STRING' } } },
                title: { type: 'STRING' },
                tone: { type: 'STRING', enum: ['key', 'warning', 'tip'] },
                caption: { type: 'STRING' },
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

type RawBlock = { type?: string; text?: string; items?: string[]; headers?: string[]; rows?: string[][]; title?: string; tone?: string; caption?: string };
type RawMcq = { question?: string; options?: string[]; answerIndex?: number; explanation?: string };
type RawBooklet = { title?: string; language?: string; topics?: { title?: string; blocks?: RawBlock[]; mcqs?: RawMcq[] }[] };

export function OPTIONS() {
  return new Response(null, { headers: CORS });
}

export async function POST(request: Request) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return json({ error: 'The conversion service is not configured.' }, 500);

  let file: File | null = null;
  try {
    const form = await request.formData();
    const f = (form as unknown as { get(name: string): unknown }).get('file');
    if (f && typeof f !== 'string') file = f as File;
  } catch {
    return json({ error: 'Send the file as multipart form data in a field named "file".' }, 400);
  }
  if (!file) return json({ error: 'No file received.' }, 400);
  if (file.size > MAX_BYTES) return json({ error: 'This file is larger than 18 MB. Please upload a smaller file or split it.' }, 413);

  const name = file.name || 'document';
  const ext = name.toLowerCase().split('.').pop() ?? '';
  const bytes = new Uint8Array(await file.arrayBuffer());

  let part: Record<string, unknown>;
  try {
    if (INLINE_TYPES[ext] || file.type === 'application/pdf' || file.type.startsWith('image/')) {
      part = { inlineData: { mimeType: INLINE_TYPES[ext] ?? file.type, data: toBase64(bytes) } };
    } else if (ext === 'docx') {
      part = { text: `Document "${name}":\n\n${docxText(bytes)}` };
    } else if (ext === 'pptx') {
      part = { text: `Slides "${name}":\n\n${pptxText(bytes)}` };
    } else if (TEXT_EXT.includes(ext) || file.type.startsWith('text/')) {
      part = { text: `Document "${name}":\n\n${new TextDecoder().decode(bytes)}` };
    } else {
      return json({ error: 'Unsupported file type. Use PDF, Word (.docx), PowerPoint (.pptx), an image, or a text file.' }, 415);
    }
  } catch {
    return json({ error: 'Could not read this file. Is it damaged or password-protected?' }, 422);
  }
  if ('text' in part && String(part.text).trim().length < 40) {
    return json({ error: 'The file has almost no readable text.' }, 422);
  }

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: PROMPT }] },
      contents: [{ role: 'user', parts: [part, { text: 'Convert this file into the booklet JSON.' }] }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA, maxOutputTokens: 65536, temperature: 0.2 },
    }),
  });
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
              const headers = (x.headers ?? []).map(s);
              const rows = (x.rows ?? []).map((r) => (r ?? []).map(s)).filter((r) => r.some(Boolean));
              if (!headers.length && !rows.length) return null;
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

function toBase64(bytes: Uint8Array) {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(bin);
}

function decodeXml(s: string) {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, '&');
}

/** Word: paragraphs, headings and tables (as "a | b | c" rows) in reading order. */
function docxText(bytes: Uint8Array) {
  const files = unzipSync(bytes, { filter: (f) => f.name === 'word/document.xml' });
  const xml = files['word/document.xml'];
  if (!xml) throw new Error('not a docx');
  const doc = strFromU8(xml);
  const out: string[] = [];
  const body = doc.replace(/<w:tbl>[\s\S]*?<\/w:tbl>/g, (tbl) => {
    const rows = [...tbl.matchAll(/<w:tr[ >][\s\S]*?<\/w:tr>/g)].map((r) =>
      [...r[0].matchAll(/<w:tc>[\s\S]*?<\/w:tc>/g)].map((c) => runs(c[0]).trim()).join(' | '),
    );
    return `<w:p><w:r><w:t>[TABLE]\n${rows.join('\n')}\n[/TABLE]</w:t></w:r></w:p>`;
  });
  for (const m of body.matchAll(/<w:p[ >][\s\S]*?<\/w:p>/g)) {
    const p = m[0];
    const text = runs(p).trim();
    if (!text) continue;
    const style = /<w:pStyle w:val="([^"]+)"/.exec(p)?.[1] ?? '';
    const isList = /<w:numPr>/.test(p);
    out.push(/heading|title/i.test(style) ? `\n## ${text}` : isList ? `- ${text}` : text);
  }
  return out.join('\n');
}

/** Text of all runs inside a Word XML fragment (text, tabs and line breaks). */
function runs(xml: string) {
  const parts: string[] = [];
  for (const m of xml.matchAll(/<w:(t|tab|br)(?: [^>]*)?(?:\/>|>([\s\S]*?)<\/w:t>)/g)) {
    parts.push(m[1] === 't' ? (m[2] ?? '') : m[1] === 'tab' ? '\t' : '\n');
  }
  return decodeXml(parts.join(''));
}

/** PowerPoint: text of every slide, in slide order. */
function pptxText(bytes: Uint8Array) {
  const files = unzipSync(bytes, { filter: (f) => /^ppt\/slides\/slide\d+\.xml$/.test(f.name) });
  const names = Object.keys(files).sort((a, b) => Number(/(\d+)\.xml/.exec(a)![1]) - Number(/(\d+)\.xml/.exec(b)![1]));
  if (!names.length) throw new Error('not a pptx');
  return names
    .map((n, i) => {
      const xml = strFromU8(files[n]);
      const paras = [...xml.matchAll(/<a:p>[\s\S]*?<\/a:p>/g)]
        .map((p) => decodeXml([...p[0].matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((t) => t[1]).join('')).trim())
        .filter(Boolean);
      return `--- Slide ${i + 1} ---\n${paras.join('\n')}`;
    })
    .join('\n\n');
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...CORS } });
}
