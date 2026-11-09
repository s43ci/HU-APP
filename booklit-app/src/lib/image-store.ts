/**
 * Where booklet pictures live on the device.
 * - iOS/Android: files in the app's document folder (file:// URIs).
 * - Web: IndexedDB blobs, referenced as "idb:<key>" (localStorage is far too small for images).
 */
import { Directory, File as FsFile, Paths } from 'expo-file-system';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { logError } from './log';

const DB = 'booklit-images';
const STORE = 'images';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idb<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Save image bytes for a booklet and return a URI the app can display. */
export async function saveImage(bookletId: string, name: string, bytes: Uint8Array, mime: string): Promise<string> {
  if (Platform.OS === 'web') {
    const key = `${bookletId}/${name}`;
    await idb('readwrite', (s) => s.put(new Blob([bytes as unknown as BlobPart], { type: mime }), key));
    return `idb:${key}`;
  }
  const dir = new Directory(Paths.document, 'booklit-images', bookletId);
  dir.create({ idempotent: true, intermediates: true });
  const file = new FsFile(dir, `${name}.${mime === 'image/png' ? 'png' : 'jpg'}`);
  file.create({ overwrite: true });
  file.write(bytes);
  return file.uri;
}

/** Keep a picked web image (blob:/data: URI) permanently in IndexedDB. */
export async function persistWebImage(bookletId: string, uri: string): Promise<string> {
  if (Platform.OS !== 'web' || uri.startsWith('idb:')) return uri;
  const blob = await (await fetch(uri)).blob();
  const key = `${bookletId}/pick-${Date.now().toString(36)}`;
  await idb('readwrite', (s) => s.put(blob, key));
  return `idb:${key}`;
}

/** Remove every picture of a booklet. */
export async function deleteImages(bookletId: string) {
  try {
    if (Platform.OS === 'web') {
      const keys = (await idb('readonly', (s) => s.getAllKeys())) as string[];
      await Promise.all(keys.filter((k) => k.startsWith(`${bookletId}/`)).map((k) => idb('readwrite', (s) => s.delete(k))));
      return;
    }
    const dir = new Directory(Paths.document, 'booklit-images', bookletId);
    if (dir.exists) dir.delete();
  } catch (e) {
    logError('images', e, { step: 'delete', bookletId });
  }
}

const cache = new Map<string, string>();

/** Turn a stored image URI into something <Image> can show (resolves "idb:" keys on web). */
export function useImageUri(uri: string | undefined): string | undefined {
  const [loaded, setLoaded] = useState<{ key: string; url: string } | null>(null);
  useEffect(() => {
    if (!uri || !uri.startsWith('idb:') || cache.has(uri)) return;
    let alive = true;
    idb<Blob | undefined>('readonly', (s) => s.get(uri.slice(4)) as IDBRequest<Blob | undefined>)
      .then((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        cache.set(uri, url);
        if (alive) setLoaded({ key: uri, url });
      })
      .catch((e) => logError('images', e, { step: 'load' }));
    return () => {
      alive = false;
    };
  }, [uri]);
  if (!uri) return undefined;
  if (!uri.startsWith('idb:')) return uri;
  return cache.get(uri) ?? (loaded?.key === uri ? loaded.url : undefined);
}

/** Bytes + type of a stored image (for publishing it to the server). */
export async function readImage(uri: string): Promise<{ bytes: Uint8Array; mime: string }> {
  if (uri.startsWith('idb:')) {
    const blob = await idb<Blob | undefined>('readonly', (s) => s.get(uri.slice(4)) as IDBRequest<Blob | undefined>);
    if (!blob) throw new Error('Image not found on this device');
    return { bytes: new Uint8Array(await blob.arrayBuffer()), mime: blob.type || 'image/png' };
  }
  if (Platform.OS === 'web' || uri.startsWith('blob:') || uri.startsWith('data:')) {
    const blob = await (await fetch(uri)).blob();
    return { bytes: new Uint8Array(await blob.arrayBuffer()), mime: blob.type || 'image/png' };
  }
  const f = new FsFile(uri);
  const ext = uri.split('.').pop()?.toLowerCase();
  return { bytes: await f.bytes(), mime: ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : 'image/png' };
}
