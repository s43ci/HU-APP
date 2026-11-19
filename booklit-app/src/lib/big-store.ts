/**
 * Storage for the big parts of the app's saved state (booklets, question banks).
 * - Web: IndexedDB (hundreds of MB; localStorage allows only ~5 MB, which a few dozen booklets fill).
 * - iOS/Android: one file per key in the app's document folder (AsyncStorage on Android is limited to
 *   ~6 MB in total and cannot read back a single value over ~2 MB).
 */
import { Directory, File as FsFile, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

const DB = 'booklit-data';
const STORE = 'kv';

let dbPromise: Promise<IDBDatabase> | null = null;
function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
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

const fileOf = (key: string) => {
  const dir = new Directory(Paths.document, 'booklit-data');
  dir.create({ idempotent: true, intermediates: true });
  return new FsFile(dir, `${key.replace(/[^\w-]/g, '_')}.json`);
};

/** The saved text for a key, or null when nothing was saved. */
export async function loadBig(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    if (typeof indexedDB === 'undefined') return null;
    const v = await idb<unknown>('readonly', (s) => s.get(key));
    return typeof v === 'string' ? v : null;
  }
  const f = fileOf(key);
  return f.exists ? await f.text() : null;
}

/** Save text for a key (replaces what was there). */
export async function saveBig(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof indexedDB === 'undefined') return;
    await idb('readwrite', (s) => s.put(value, key));
    return;
  }
  const f = fileOf(key);
  f.create({ overwrite: true });
  f.write(value);
}
