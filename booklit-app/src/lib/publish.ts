import type { ContentBlock as Block, ImportedBooklet, Mcq } from '@/data/types';
import { API_BASE } from './ai';
import { api, authHeader } from './api';
import { readImage } from './image-store';

const isRemote = (u: string) => /^https?:\/\//.test(u);

async function uploadImage(uri: string, bookletId: string): Promise<string> {
  const { bytes, mime } = await readImage(uri);
  const res = await fetch(`${API_BASE}/api/media`, {
    method: 'POST',
    headers: { ...(await authHeader()), 'Content-Type': mime, 'X-File-Name': bookletId },
    body: bytes as unknown as BodyInit,
  });
  const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!res.ok || !data.url) throw new Error(data.error || `Image upload failed (${res.status})`);
  return data.url;
}

/**
 * Publish a Studio booklet to every student: uploads its pictures (once), then the booklet itself.
 * Returns the booklet with picture links replaced, so the local copy does not upload them again.
 */
export async function publishBooklet(b: ImportedBooklet, extraMcqs: Mcq[], onProgress?: (done: number, total: number) => void): Promise<ImportedBooklet> {
  const local = new Set<string>();
  b.topics.forEach((t) => t.blocks.forEach((bl) => bl.type === 'image' && bl.uri && !isRemote(bl.uri) && local.add(bl.uri)));
  const map = new Map<string, string>();
  let done = 0;
  onProgress?.(0, local.size);
  for (const uri of local) {
    map.set(uri, await uploadImage(uri, b.id));
    onProgress?.(++done, local.size);
  }
  const fix = (bl: Block): Block => (bl.type === 'image' && bl.uri && map.has(bl.uri) ? { ...bl, uri: map.get(bl.uri) } : bl);
  const out: ImportedBooklet = { ...b, topics: b.topics.map((t) => ({ ...t, blocks: t.blocks.map(fix) })) };
  await api('/api/admin', { body: { action: 'content.publish', booklet: out, extraMcqs } });
  return out;
}

export const unpublishBooklet = (id: string) => api('/api/admin', { body: { action: 'content.unpublish', id } });
export const publishBankMcqs = (mcqs: Mcq[]) => api('/api/admin', { body: { action: 'content.mcqs', mcqs } });
