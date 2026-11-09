import type { DocumentPickerAsset } from 'expo-document-picker';
import { File as FsFile } from 'expo-file-system';
import { Platform } from 'react-native';

import type { ContentBlock, ImportedBooklet, Mcq, Topic } from '@/data/types';
import { API_BASE } from './ai';
import { saveImage } from './image-store';
import { log, logError } from './log';
import { extractPdfImages, type ExtractedImage } from './pdf-images';
import { consume } from './usage';

export const ACCEPTED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/*',
  'text/plain',
  'text/markdown',
  'text/html',
  'text/csv',
];

export const MAX_UPLOAD_MB = 18;

type ServerBooklet = {
  title: string;
  language: string;
  topics: { title: string; blocks: (ContentBlock & { page?: number })[]; mcqs: Omit<Mcq, 'id' | 'topicId' | 'source'>[] }[];
};

export type ImportOptions = {
  /** 'enhanced' = AI designs the booklet (lists, tables, exam tips, key points); 'original' = layout as in the file. */
  design: 'enhanced' | 'original';
  questionsPerTopic: number;
  subjectId?: string;
  /** Admin uploads are not counted against the daily allowance. */
  unlimited?: boolean;
};

/** Read the picked file into memory (web: the File object; iOS/Android: from disk). */
export async function readAssetBytes(asset: DocumentPickerAsset): Promise<Uint8Array> {
  if (Platform.OS === 'web' && asset.file) return new Uint8Array(await asset.file.arrayBuffer());
  return await new FsFile(asset.uri).bytes();
}

/**
 * Send a picked file (+ options) to a Studio API route and return its JSON.
 * The file goes as raw bytes (no base64, no form parsing) so the server does almost no work.
 * If raw upload is not possible on this device, it falls back to base64 JSON.
 */
export async function postFile<T>(path: string, asset: DocumentPickerAsset, options: Record<string, unknown>, area: string, signal?: AbortSignal, bytes?: Uint8Array): Promise<T> {
  const meta = { path, name: asset.name, size: asset.size, type: asset.mimeType, platform: Platform.OS };
  log('info', area, 'Uploading', meta);
  const started = Date.now();
  let data: Uint8Array;
  try {
    data = bytes ?? (await readAssetBytes(asset));
  } catch (e) {
    logError(area, e, { ...meta, step: 'read-file' });
    throw new Error('Could not read the file from your device. Try choosing it again.');
  }
  const headers = {
    'Content-Type': 'application/octet-stream',
    'X-File-Name': encodeURIComponent(asset.name),
    'X-File-Type': encodeURIComponent(asset.mimeType ?? ''),
    'X-Options': encodeURIComponent(JSON.stringify(options)),
  };
  let res: Response;
  try {
    try {
      const body = Platform.OS === 'web' && asset.file ? asset.file : (data as unknown as BodyInit);
      res = await fetch(`${API_BASE}${path}`, { method: 'POST', headers, body, signal });
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw e;
      // Some fetch implementations cannot send binary bodies: fall back to base64 JSON.
      log('warn', area, 'Raw upload failed, retrying as base64', { ...meta, reason: (e as Error).message });
      const b64 = Platform.OS === 'web' ? '' : await new FsFile(asset.uri).base64();
      res = await fetch(`${API_BASE}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: asset.name, mimeType: asset.mimeType ?? '', data: b64, options }),
        signal,
      });
    }
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    logError(area, e, { ...meta, step: 'network' });
    throw new Error(`Network problem: ${(e as Error).message}. Check your internet connection and try again.`);
  }
  const out = (await res.json().catch(() => ({}))) as T & { error?: string; detail?: string };
  if (!res.ok || out.error) {
    const msg =
      out.error ??
      (res.status === 504 || res.status === 503 ? 'The server took too long with this file. Please try again; if it keeps failing, split the file into parts.' : `Upload failed (${res.status}).`);
    log('error', area, out.error ?? `HTTP ${res.status}`, { ...meta, status: res.status, detail: out.detail, ms: Date.now() - started });
    throw new Error(msg);
  }
  log('info', area, 'Done', { ...meta, ms: Date.now() - started });
  return out;
}

/** Upload a picked file and turn the server's result into an ImportedBooklet. */
export async function convertFile(
  asset: DocumentPickerAsset,
  options: ImportOptions,
  signal?: AbortSignal,
  onStage?: (stage: 'uploading' | 'images') => void,
): Promise<{ booklet: ImportedBooklet; truncated: boolean }> {
  await consume('convert', options.unlimited);
  onStage?.('uploading');
  const bytes = await readAssetBytes(asset).catch(() => undefined);
  const data = await postFile<{ booklet: ServerBooklet; truncated?: boolean }>(
    '/api/import',
    asset,
    { design: options.design, questionsPerTopic: options.questionsPerTopic },
    'upload',
    signal,
    bytes,
  );
  log('info', 'upload', 'Converted', { topics: data.booklet.topics.length, truncated: !!data.truncated });

  const id = `upload-${Date.now().toString(36)}`;

  // Pictures are pulled out of the PDF here on the device (keeps the server fast).
  onStage?.('images');
  const isPdf = /\.pdf$/i.test(asset.name) || asset.mimeType === 'application/pdf';
  let images: ExtractedImage[] = [];
  if (isPdf && bytes) {
    try {
      images = await extractPdfImages(bytes);
    } catch (e) {
      logError('upload', e, { step: 'extract-images' });
    }
  }
  const uris: string[] = [];
  for (const [i, im] of images.entries()) {
    try {
      uris[i] = await saveImage(id, `img-${i}`, im.data, im.mime);
    } catch (e) {
      logError('upload', e, { step: 'save-image', ref: i });
    }
  }
  placeImages(data.booklet.topics, images, uris);
  log('info', 'upload', 'Images', { extracted: images.length, saved: uris.filter(Boolean).length });

  const topics: Topic[] = [];
  const mcqs: Mcq[] = [];
  data.booklet.topics.forEach((t, i) => {
    const topicId = `${id}--t${i + 1}`;
    const blocks = t.blocks
      .map(({ page: _p, ...b }) => {
        void _p;
        return b as ContentBlock;
      })
      // A figure without a picture and without a caption is empty: drop it.
      .filter((b) => b.type !== 'image' || !!b.uri || !!b.caption);
    const words = blocks.reduce((n, b) => n + JSON.stringify(b).split(/\s+/).length, 0);
    topics.push({ id: topicId, bookletId: id, title: t.title, order: i + 1, minutes: Math.max(1, Math.round(words / 200)), blocks });
    t.mcqs.forEach((q, k) => mcqs.push({ ...q, id: `${topicId}--q${k + 1}`, topicId, source: 'generated' }));
  });

  return {
    booklet: { id, title: data.booklet.title, fileName: asset.name, language: data.booklet.language, createdAt: Date.now(), topics, mcqs, subjectId: options.subjectId },
    truncated: !!data.truncated,
  };
}

type PageBlock = ContentBlock & { page?: number };

/**
 * Put each extracted picture into the booklet:
 * 1) into a figure block from the same page (in order), else
 * 2) as a new figure right after the last block from that page (or an earlier one), else
 * 3) proportionally through the booklet when the AI gave no page numbers.
 */
function placeImages(topics: { blocks: PageBlock[] }[], images: ExtractedImage[], uris: string[]) {
  if (!images.length) return;
  const pages = Math.max(1, ...images.map((im) => im.page));
  const known = topics.some((t) => t.blocks.some((b) => (b.page ?? 0) > 0));
  images.forEach((im, i) => {
    const uri = uris[i];
    if (!uri) return;
    for (const t of topics) {
      const fig = t.blocks.find((b) => b.type === 'image' && !b.uri && b.page === im.page);
      if (fig && fig.type === 'image') {
        fig.uri = uri;
        return;
      }
    }
    const block: PageBlock = { type: 'image', caption: '', icon: 'image', uri, page: im.page };
    if (known) {
      let target: { t: number; i: number } | null = null;
      topics.forEach((t, ti) =>
        t.blocks.forEach((b, bi) => {
          if ((b.page ?? 0) > 0 && (b.page ?? 0) <= im.page) target = { t: ti, i: bi };
        }),
      );
      const tg = target as { t: number; i: number } | null;
      if (tg) {
        topics[tg.t].blocks.splice(tg.i + 1, 0, block);
        return;
      }
    }
    const ti = Math.min(topics.length - 1, Math.floor(((im.page - 1) / pages) * topics.length));
    topics[ti].blocks.push(block);
  });
}

export type BankQuestion = { question: string; options: string[]; answerIndex: number; answerFromAi: boolean; explanation: string; topicId: string };

/** Upload a question bank; the server extracts every MCQ and assigns it to one of the given topics. */
export async function importMcqBank(asset: DocumentPickerAsset, topics: { id: string; title: string }[], signal?: AbortSignal) {
  return postFile<{ questions: BankQuestion[]; truncated?: boolean }>('/api/mcq-bank', asset, { topics }, 'mcq-bank', signal);
}
