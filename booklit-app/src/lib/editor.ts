import { Directory, File as FsFile, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import { topicPlainText } from '@/data/content';
import type { ContentBlock, ImportedBooklet, Mcq, Topic } from '@/data/types';
import { API_BASE } from './ai';
import { deleteImages, persistWebImage } from './image-store';
import { log, logError } from './log';
import { consume } from './usage';

export type AiAction = 'simplify' | 'fix' | 'translate' | 'bullets' | 'note' | 'expand';

async function post<T>(path: string, body: unknown, area: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  } catch (e) {
    logError(area, e, { step: 'network' });
    throw new Error('Network problem. Check your internet connection.');
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok || data.error) {
    log('error', area, data.error ?? `HTTP ${res.status}`, { status: res.status });
    throw new Error(data.error ?? `Request failed (${res.status}).`);
  }
  return data;
}

export async function aiEdit(action: AiAction, text: string, topic?: string) {
  await consume('edit');
  return post<{ text?: string; items?: string[] }>('/api/edit', { action, text, topic }, 'editor-ai');
}

export async function generateMcqs(topic: Topic, existing: Mcq[], count = 5): Promise<Mcq[]> {
  await consume('mcq');
  const out = await post<{ mcqs: Omit<Mcq, 'id' | 'topicId' | 'source'>[] }>(
    '/api/mcq',
    { topic: topic.title, text: topicPlainText(topic), count, avoid: existing.map((q) => q.question) },
    'editor-mcq',
  );
  return out.mcqs.map((q) => ({ ...q, id: newId(`${topic.id}--q`), topicId: topic.id, source: 'generated' as const }));
}

export function newId(prefix: string) {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Pick a photo (gallery or camera) and keep a private copy so it survives app restarts. */
export async function pickImage(source: 'library' | 'camera' = 'library', bookletId = 'picked'): Promise<string | null> {
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new Error('Camera permission was not granted.');
  }
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.8, allowsEditing: true };
  const res = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (res.canceled || !res.assets?.[0]) return null;
  const uri = res.assets[0].uri;
  if (Platform.OS === 'web') return persistWebImage(bookletId, uri);
  try {
    const dir = new Directory(Paths.document, 'booklit-images');
    dir.create({ idempotent: true, intermediates: true });
    const ext = (uri.split('.').pop() ?? 'jpg').split('?')[0].slice(0, 5);
    const dest = new FsFile(dir, `${newId('img-')}.${ext}`);
    await new FsFile(uri).copy(dest);
    return dest.uri;
  } catch (e) {
    logError('editor-image', e);
    return uri;
  }
}

export const BLOCK_LABELS: Record<ContentBlock['type'], string> = {
  heading: 'Heading',
  paragraph: 'Paragraph',
  list: 'List',
  table: 'Table',
  callout: 'Note',
  image: 'Figure',
};

export function emptyBlock(type: ContentBlock['type']): ContentBlock {
  switch (type) {
    case 'heading':
      return { type, text: '' };
    case 'paragraph':
      return { type, text: '' };
    case 'list':
      return { type, items: [''] };
    case 'table':
      return { type, headers: ['', ''], rows: [['', '']] };
    case 'callout':
      return { type, tone: 'key', title: 'Key point', text: '' };
    case 'image':
      return { type, caption: '', icon: 'image' };
  }
}

/** Plain text of a block, used for AI actions and type conversion. */
export function blockToText(b: ContentBlock) {
  switch (b.type) {
    case 'list':
      return b.items.join('\n');
    case 'table':
      return [b.headers.join(' | '), ...b.rows.map((r) => r.join(' | '))].join('\n');
    case 'callout':
      return b.text;
    case 'image':
      return b.caption;
    default:
      return b.text;
  }
}

/** Convert a block to another type, carrying its text across. */
export function convertBlock(b: ContentBlock, to: ContentBlock['type']): ContentBlock {
  const text = blockToText(b);
  switch (to) {
    case 'heading':
      return { type: 'heading', text: text.split('\n')[0] };
    case 'paragraph':
      return { type: 'paragraph', text };
    case 'list':
      return { type: 'list', items: text.split('\n').map((s) => s.trim()).filter(Boolean).length ? text.split('\n').map((s) => s.trim()).filter(Boolean) : [''] };
    case 'callout':
      return { type: 'callout', tone: b.type === 'callout' ? b.tone : 'key', title: b.type === 'callout' ? b.title : 'Key point', text };
    case 'image':
      return { type: 'image', icon: 'image', caption: text };
    case 'table':
      return b.type === 'table' ? b : { type: 'table', headers: ['', ''], rows: [[text, '']] };
  }
}

export function newBlankBooklet(): ImportedBooklet {
  const id = `upload-${Date.now().toString(36)}`;
  return {
    id,
    title: 'Untitled booklet',
    fileName: 'Created in the editor',
    language: 'English',
    createdAt: Date.now(),
    topics: [{ id: `${id}--t1`, bookletId: id, title: 'New topic', order: 1, minutes: 1, blocks: [{ type: 'paragraph', text: '' }] }],
    mcqs: [],
  };
}

/** Delete the image files that belong to a booklet. */
export function deleteBookletImages(bookletId: string) {
  void deleteImages(bookletId);
}
