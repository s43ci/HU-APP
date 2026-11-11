/** Shared file intake for the Studio routes (booklet import and MCQ banks). */
import { strFromU8, unzipSync } from 'fflate';

export const MAX_BYTES = 18 * 1024 * 1024;

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

export type Upload = {
  name: string;
  mime: string;
  ext: string;
  bytes: Uint8Array;
  /** Text extracted on the server (Word, PowerPoint, text files). Null for PDF/images. */
  text: string | null;
  /** MIME type sent to Gemini for PDF/images. */
  fileMime: string;
  /** Extra options sent with the file. */
  options: Record<string, unknown>;
};

const decodeHeader = (v: string | null) => {
  if (!v) return '';
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
};

/**
 * Read an uploaded file. Three ways in:
 * - raw bytes (Content-Type: application/octet-stream) with X-File-Name / X-File-Type / X-Options headers
 *   (used by the apps: no base64 or form parsing, so the server does almost no work);
 * - multipart form data ("file" + "options");
 * - JSON { name, mimeType, data: base64, options } (older app versions).
 */
export async function readUpload(request: Request): Promise<{ ok: true; upload: Upload } | { ok: false; error: string; status: number }> {
  let name = 'document';
  let mime = '';
  let bytes: Uint8Array;
  let options: Record<string, unknown> = {};
  const ctype = request.headers.get('content-type') ?? '';
  try {
    if (ctype.includes('application/octet-stream')) {
      name = decodeHeader(request.headers.get('x-file-name')) || name;
      mime = decodeHeader(request.headers.get('x-file-type'));
      const b64 = request.headers.get('x-options-b64');
      const o = b64 ? new TextDecoder().decode(fromBase64(b64)) : decodeHeader(request.headers.get('x-options'));
      if (o) options = JSON.parse(o);
      bytes = new Uint8Array(await request.arrayBuffer());
    } else if (ctype.includes('application/json')) {
      const body = (await request.json()) as { name?: string; mimeType?: string; data?: string; options?: Record<string, unknown> };
      if (!body.data) return { ok: false, error: 'No file received.', status: 400 };
      name = body.name || name;
      mime = body.mimeType || '';
      bytes = fromBase64(body.data);
      options = body.options ?? {};
    } else {
      const form = (await request.formData()) as unknown as { get(name: string): unknown };
      const f = form.get('file');
      if (!f || typeof f === 'string') return { ok: false, error: 'No file received.', status: 400 };
      const file = f as File;
      name = file.name || name;
      mime = file.type || '';
      bytes = new Uint8Array(await file.arrayBuffer());
      const o = form.get('options');
      if (typeof o === 'string') options = JSON.parse(o);
    }
  } catch {
    return { ok: false, error: 'The file could not be received. Please try again.', status: 400 };
  }
  if (bytes.length > MAX_BYTES) return { ok: false, error: 'This file is larger than 18 MB. Please upload a smaller file or split it.', status: 413 };
  if (!bytes.length) return { ok: false, error: 'The file is empty.', status: 400 };

  const ext = name.toLowerCase().split('.').pop() ?? '';
  let text: string | null = null;
  let fileMime = '';
  try {
    if (INLINE_TYPES[ext] || mime === 'application/pdf' || mime.startsWith('image/')) {
      fileMime = INLINE_TYPES[ext] ?? mime;
    } else if (ext === 'docx') {
      text = `Document "${name}":\n\n${docxText(bytes)}`;
    } else if (ext === 'pptx') {
      text = `Slides "${name}":\n\n${pptxText(bytes)}`;
    } else if (TEXT_EXT.includes(ext) || mime.startsWith('text/')) {
      text = `Document "${name}":\n\n${new TextDecoder().decode(bytes)}`;
    } else {
      return { ok: false, error: 'Unsupported file type. Use PDF, Word (.docx), PowerPoint (.pptx), an image, or a text file.', status: 415 };
    }
  } catch {
    return { ok: false, error: 'Could not read this file. Is it damaged or password-protected?', status: 422 };
  }
  if (text !== null && text.trim().length < 40) return { ok: false, error: 'The file has almost no readable text.', status: 422 };
  return { ok: true, upload: { name, mime, ext, bytes, text, fileMime, options } };
}

const INLINE_LIMIT = 3 * 1024 * 1024;

/**
 * Turn the upload into a Gemini content part. Small files go inline; larger PDFs/images are
 * streamed to the Gemini Files API so this server never base64-encodes big files
 * (that work used to hit the hosting CPU limit and return 504).
 * Returns a cleanup function that deletes the temporary Gemini file.
 */
export async function geminiPart(up: Upload, key: string): Promise<{ part: Record<string, unknown>; cleanup: () => Promise<void> }> {
  const none = async () => {};
  if (up.text !== null) return { part: { text: up.text }, cleanup: none };
  if (up.bytes.length <= INLINE_LIMIT) return { part: { inlineData: { mimeType: up.fileMime, data: toBase64(up.bytes) } }, cleanup: none };

  const start = await fetch('https://generativelanguage.googleapis.com/upload/v1beta/files', {
    method: 'POST',
    headers: {
      'x-goog-api-key': key,
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(up.bytes.length),
      'X-Goog-Upload-Header-Content-Type': up.fileMime,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ file: { display_name: up.name.slice(0, 100) } }),
  });
  const uploadUrl = start.headers.get('x-goog-upload-url');
  if (!start.ok || !uploadUrl) throw new Error(`File upload to the AI service failed (${start.status}).`);
  const done = await fetch(uploadUrl, {
    method: 'POST',
    headers: { 'X-Goog-Upload-Offset': '0', 'X-Goog-Upload-Command': 'upload, finalize' },
    body: up.bytes as unknown as BodyInit,
  });
  if (!done.ok) throw new Error(`File upload to the AI service failed (${done.status}).`);
  let file = ((await done.json()) as { file: { name: string; uri: string; state: string } }).file;
  // Large PDFs can need a moment of processing before they can be used.
  // At most 2 checks: the host allows only a few outgoing calls per request.
  for (let i = 0; i < 2 && file.state === 'PROCESSING'; i++) {
    await new Promise((r) => setTimeout(r, 2500));
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/${file.name}`, { headers: { 'x-goog-api-key': key } });
    file = (await r.json()) as typeof file;
  }
  if (file.state === 'FAILED') throw new Error('The AI service could not read this file.');
  return {
    part: { fileData: { mimeType: up.fileMime, fileUri: file.uri } },
    // Gemini removes uploaded files by itself after 48 hours; deleting here would cost an extra call.
    cleanup: none,
  };
}

export function fromBase64(b64: string) {
  const bin = atob(b64.replace(/^data:[^,]*,/, '').replace(/\s/g, ''));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function toBase64(bytes: Uint8Array) {
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
export function docxText(bytes: Uint8Array) {
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
export function pptxText(bytes: Uint8Array) {
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

