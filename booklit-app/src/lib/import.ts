import type { DocumentPickerAsset } from 'expo-document-picker';
import { File as FsFile } from 'expo-file-system';
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

/** Upload a picked file and turn the server's result into an ImportedBooklet. */
export async function convertFile(asset: DocumentPickerAsset, signal?: AbortSignal): Promise<{ booklet: ImportedBooklet; truncated: boolean }> {
  const meta = { name: asset.name, size: asset.size, type: asset.mimeType, platform: Platform.OS };
  log('info', 'upload', 'Starting conversion', meta);
  const started = Date.now();

  let res: Response;
  try {
    if (Platform.OS === 'web' && asset.file) {
      const form = new FormData();
      form.append('file', asset.file, asset.name);
      res = await fetch(`${API_BASE}/api/import`, { method: 'POST', body: form, signal });
    } else {
      // On iOS/Android send the file as base64 JSON. This works with every fetch
      // implementation (Expo's fetch rejects React Native's { uri } FormData parts).
      let data: string;
      try {
        data = await new FsFile(asset.uri).base64();
      } catch (e) {
        logError('upload', e, { ...meta, step: 'read-file' });
        throw new Error('Could not read the file from your phone. Try choosing it again.');
      }
      res = await fetch(`${API_BASE}/api/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: asset.name, mimeType: asset.mimeType ?? '', data }),
        signal,
      });
    }
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    logError('upload', e, { ...meta, step: 'network' });
    throw new Error(`Network problem: ${(e as Error).message}. Check your internet connection and try again.`);
  }

  const data = (await res.json().catch(() => ({}))) as { booklet?: ServerBooklet; truncated?: boolean; error?: string; detail?: string };
  if (!res.ok || !data.booklet) {
    log('error', 'upload', data.error ?? `HTTP ${res.status}`, { ...meta, status: res.status, detail: data.detail, ms: Date.now() - started });
    throw new Error(data.error ?? `Upload failed (${res.status}).`);
  }
  log('info', 'upload', 'Converted', { ...meta, topics: data.booklet.topics.length, truncated: !!data.truncated, ms: Date.now() - started });

  const id = `upload-${Date.now().toString(36)}`;
  const topics: Topic[] = [];
  const mcqs: Mcq[] = [];
  data.booklet.topics.forEach((t, i) => {
    const topicId = `${id}--t${i + 1}`;
    const words = t.blocks.reduce((n, b) => n + JSON.stringify(b).split(/\s+/).length, 0);
    topics.push({ id: topicId, bookletId: id, title: t.title, order: i + 1, minutes: Math.max(1, Math.round(words / 200)), blocks: t.blocks });
    t.mcqs.forEach((q, k) => mcqs.push({ ...q, id: `${topicId}--q${k + 1}`, topicId, source: 'generated' }));
  });

  return {
    booklet: { id, title: data.booklet.title, fileName: asset.name, language: data.booklet.language, createdAt: Date.now(), topics, mcqs },
    truncated: !!data.truncated,
  };
}
