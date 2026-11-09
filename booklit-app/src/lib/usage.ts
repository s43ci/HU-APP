/**
 * Daily AI allowance per device, so the Gemini bill stays small.
 * (When accounts move to the server, the same limits are enforced there per user.)
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export type UsageKind = 'ask' | 'edit' | 'mcq' | 'convert';

export const DAILY_LIMITS: Record<UsageKind, number> = {
  ask: 40, // Ask AI messages
  edit: 60, // translate / simplify / fix in the editor and reader
  mcq: 25, // AI question generation
  convert: 8, // file -> booklet conversions
};

const KEY = 'booklit.usage.v1';
const today = () => new Date().toISOString().slice(0, 10);

type Usage = { day: string; counts: Partial<Record<UsageKind, number>> };

async function read(): Promise<Usage> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const u = raw ? (JSON.parse(raw) as Usage) : null;
    if (u && u.day === today()) return u;
  } catch {
    // ignore: start a fresh day
  }
  return { day: today(), counts: {} };
}

/** Count one AI use; throws a friendly error when today's allowance is used up. */
export async function consume(kind: UsageKind, unlimited = false) {
  const u = await read();
  const used = u.counts[kind] ?? 0;
  if (!unlimited && used >= DAILY_LIMITS[kind]) {
    throw new Error(`You have used today's AI allowance (${DAILY_LIMITS[kind]}). It resets tomorrow.`);
  }
  u.counts[kind] = used + 1;
  await AsyncStorage.setItem(KEY, JSON.stringify(u)).catch(() => {});
}

export async function remaining(kind: UsageKind) {
  const u = await read();
  return Math.max(0, DAILY_LIMITS[kind] - (u.counts[kind] ?? 0));
}
