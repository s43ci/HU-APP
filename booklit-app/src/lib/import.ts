import type { DocumentPickerAsset } from 'expo-document-picker';
import { Directory, File as FsFile, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import { log, logError } from './log';

import type { ContentBlock, ImportedBooklet, Mcq, Topic } from '@/data/types';
import { API_BASE } from './ai';

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
  topics: { title: string; blocks: ContentBlock[]; mcqs: Omit<Mcq, 'id' | 'topicId' | 'source'>[] }[];
};

export type ImportOptions = {
  /** 'enhanced' = AI designs the booklet (lists, tables, exam tips, key points); 'original' = layout as in the file. */
  design: 'enhanced' | 'original';
  questionsPerTopic: number;
  subjectId?: string;
};

/** Send a picked file (+ options) to a Studio API route and return its JSON. */
export async function postFile<T>(path: string, asset: DocumentPickerAsset, options: Record<string, unknown>, area: string, signal?: AbortSignal): Promise<T> {
  const meta = { path, name: asset.name, size: asset.size, type: asset.mimeType, platform: Platform.OS };
  log('info', area, 'Uploading', meta);
  const started = Date.now();
  let res: Response;
  try {
    if (Platform.OS === 'web' && asset.file) {
      const form = new FormData();
      form.append('file', asset.file, asset.name);
      form.append('options', JSON.stringify(options));
      res = await fetch(`${API_BASE}${path}`, { method: 'POST', body: form, signal });
    } else {
      // On iOS/Android send the file as base64 JSON. This works with every fetch
      // implementation (Expo's fetch rejects React Native's { uri } FormData parts).
      let data: string;
      try {
        data = await new FsFile(asset.uri).base64();
      } catch (e) {
        logError(area, e, { ...meta, step: 'read-file' });
        throw new Error('Could not read the file from your phone. Try choosing it again.');
      }
      res = await fetch(`${API_BASE}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: asset.name, mimeType: asset.mimeType ?? '', data, options }),
        signal,
      });
    }
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    if (String((e as Error).message).startsWith('Could not read the file')) throw e;
    logError(area, e, { ...meta, step: 'network' });
    throw new Error(`Network problem: ${(e as Error).message}. Check your internet connection and try again.`);
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string; detail?: string };
  if (!res.ok || data.error) {
    log('error', area, data.error ?? `HTTP ${res.status}`, { ...meta, status: res.status, detail: data.detail, ms: Date.now() - started });
    throw new Error(data.error ?? `Upload failed (${res.status}).`);
  }
  log('info', area, 'Done', { ...meta, ms: Date.now() - started });
  return data;
}

/** Upload a picked file and turn the server's result into an ImportedBooklet. */
export async function convertFile(
  asset: DocumentPickerAsset,
  options: ImportOptions,
  signal?: AbortSignal,
): Promise<{ booklet: ImportedBooklet; truncated: boolean }> {
  const data = await postFile<{ booklet: ServerBooklet; images?: { ref: number; mime: string; data: string }[]; truncated?: boolean }>(
    '/api/import',
    asset,
    { design: options.design, questionsPerTopic: options.questionsPerTopic },
    'upload',
    signal,
  );
  log('info', 'upload', 'Converted', { topics: data.booklet.topics.length, truncated: !!data.truncated, images: data.images?.length ?? 0 });

  const id = `upload-${Date.now().toString(36)}`;
  const imageUris = await saveImages(id, data.images ?? []);
  log('info', 'upload', 'Images', { extracted: data.images?.length ?? 0, saved: Object.keys(imageUris).length });
  const withImages = (blocks: ContentBlock[]) =>
    blocks
      .map((b) => {
        const ref = (b as { imageRef?: number }).imageRef;
        if (b.type !== 'image' || ref == null) return b;
        const { imageRef: _drop, ...rest } = b as ContentBlock & { imageRef?: number };
        void _drop;
        return imageUris[ref] ? { ...rest, uri: imageUris[ref] } : rest;
      })
      // A figure block that lost its picture and has no caption is empty: drop it.
      .filter((b) => b.type !== 'image' || !!b.uri || !!b.caption);
  const topics: Topic[] = [];
  const mcqs: Mcq[] = [];
  data.booklet.topics.forEach((t, i) => {
    const topicId = `${id}--t${i + 1}`;
    const words = t.blocks.reduce((n, b) => n + JSON.stringify(b).split(/\s+/).length, 0);
    topics.push({ id: topicId, bookletId: id, title: t.title, order: i + 1, minutes: Math.max(1, Math.round(words / 200)), blocks: withImages(t.blocks) });
    t.mcqs.forEach((q, k) => mcqs.push({ ...q, id: `${topicId}--q${k + 1}`, topicId, source: 'generated' }));
  });

  return {
    booklet: { id, title: data.booklet.title, fileName: asset.name, language: data.booklet.language, createdAt: Date.now(), topics, mcqs, subjectId: options.subjectId },
    truncated: !!data.truncated,
  };
}

/** Store extracted PDF pictures as files (native) or data URIs (web). Returns ref -> uri. */
async function saveImages(bookletId: string, images: { ref: number; mime: string; data: string }[]) {
  const out: Record<number, string> = {};
  if (!images.length) return out;
  if (Platform.OS === 'web') {
    for (const im of images) out[im.ref] = `data:${im.mime};base64,${im.data}`;
    return out;
  }
  try {
    const dir = new Directory(Paths.document, 'booklit-images', bookletId);
    dir.create({ idempotent: true, intermediates: true });
    for (const im of images) {
      try {
        const file = new FsFile(dir, `img-${im.ref}.${im.mime === 'image/png' ? 'png' : 'jpg'}`);
        file.create({ overwrite: true });
        await file.write(im.data, { encoding: 'base64' });
        out[im.ref] = file.uri;
      } catch (e) {
        logError('upload', e, { step: 'save-image', ref: im.ref });
      }
    }
  } catch (e) {
    logError('upload', e, { step: 'image-dir' });
  }
  return out;
}

export type BankQuestion = { question: string; options: string[]; answerIndex: number; answerFromAi: boolean; explanation: string; topicId: string };

/** Upload a question bank; the server extracts every MCQ and assigns it to one of the given topics. */
export async function importMcqBank(asset: DocumentPickerAsset, topics: { id: string; title: string }[], signal?: AbortSignal) {
  return postFile<{ questions: BankQuestion[]; truncated?: boolean }>('/api/mcq-bank', asset, { topics }, 'mcq-bank', signal);
}
