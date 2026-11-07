import type { DocumentPickerAsset } from 'expo-document-picker';
import { Platform } from 'react-native';

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
  const form = new FormData();
  if (Platform.OS === 'web' && asset.file) {
    form.append('file', asset.file, asset.name);
  } else {
    // React Native's FormData accepts a { uri, name, type } descriptor for files.
    form.append('file', { uri: asset.uri, name: asset.name, type: asset.mimeType ?? 'application/octet-stream' } as unknown as Blob);
  }

  const res = await fetch(`${API_BASE}/api/import`, { method: 'POST', body: form, signal });
  const data = (await res.json().catch(() => ({}))) as { booklet?: ServerBooklet; truncated?: boolean; error?: string };
  if (!res.ok || !data.booklet) throw new Error(data.error ?? `Upload failed (${res.status}).`);

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
