/**
 * Usage metering for the admin "Usage" page (server only).
 *
 * Every server instance keeps today's counters in memory and saves them as its own small file
 * (usage/day/<date>/<instance>.json), so instances never overwrite each other. Finished days are
 * folded into one summary per month. Measured: AI calls, tokens and estimated cost; API requests;
 * active users per platform. Storage size and account counts are read live when the page opens.
 */
import { getJson, listObjects, putJson, removeObjects, sb } from './supa';

// gemini-3.5-flash-lite, Standard tier (USD per 1M tokens; thinking counts as output).
const PRICE_IN = 0.3;
const PRICE_OUT = 2.5;

export type AiKind = 'ask' | 'edit' | 'mcq' | 'import' | 'bank';
type AiStat = { calls: number; inTok: number; outTok: number; cost: number };
export type DayUsage = { requests: number; ai: Partial<Record<AiKind, AiStat>>; users: Record<string, string[]> };
type MonthSummary = { days: Record<string, DayUsage> };

export type Limits = {
  /** Monthly AI budget in USD. When reached, AI pauses for students (staff keep it). */
  aiBudgetUsd: number;
  /** Expo hosting requests per month included in the plan. */
  hostingRequests: number;
  /** Supabase file storage in MB. */
  storageMb: number;
  /** Supabase monthly active users. */
  accounts: number;
  /** Android app users per month (Expo Update). */
  androidMau: number;
};
export const DEFAULT_LIMITS: Limits = { aiBudgetUsd: 10, hostingRequests: 100_000, storageMb: 1024, accounts: 50_000, androidMau: 1_000 };

const empty = (): DayUsage => ({ requests: 0, ai: {}, users: {} });
const today = () => new Date().toISOString().slice(0, 10);
const instance = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

let day = today();
let cur = empty();
let dirty = 0;
let lastFlush = Date.now();

function rollDay() {
  const d = today();
  if (d !== day) {
    day = d;
    cur = empty();
    dirty = 0;
  }
}

async function flush() {
  if (!dirty) return;
  dirty = 0;
  lastFlush = Date.now();
  try {
    await putJson(`usage/day/${day}/${instance}.json`, cur);
  } catch {
    // Metering must never break the app.
  }
}

/** Count one API request. Saved every ~25 requests or minute (AI calls save at once). */
export async function countRequest() {
  rollDay();
  cur.requests++;
  dirty++;
  if (dirty >= 25 || Date.now() - lastFlush > 60_000) await flush();
}

/** Count an active user (once per day per instance) with the platform they use. */
export async function countUser(id: string, platform: string | null) {
  rollDay();
  const p = platform === 'android' || platform === 'ios' ? platform : 'web';
  const list = (cur.users[p] ??= []);
  if (!list.includes(id)) {
    list.push(id);
    dirty++;
    // A new active user is rare: save at once so the count is right.
    await flush();
  } else if (Date.now() - lastFlush > 60_000) await flush();
}

/** Record one Gemini call from its usageMetadata. */
export async function countAi(kind: AiKind, meta?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number }) {
  rollDay();
  const inTok = meta?.promptTokenCount ?? 0;
  const outTok = (meta?.candidatesTokenCount ?? 0) + (meta?.thoughtsTokenCount ?? 0);
  const s = (cur.ai[kind] ??= { calls: 0, inTok: 0, outTok: 0, cost: 0 });
  s.calls++;
  s.inTok += inTok;
  s.outTok += outTok;
  s.cost += (inTok * PRICE_IN + outTok * PRICE_OUT) / 1_000_000;
  dirty++;
  monthCache = null;
  await flush();
}

function merge(a: DayUsage, b: DayUsage): DayUsage {
  const out: DayUsage = { requests: a.requests + (b.requests || 0), ai: { ...a.ai }, users: { ...a.users } };
  for (const [k, v] of Object.entries(b.ai ?? {}) as [AiKind, AiStat][]) {
    const x = out.ai[k] ?? { calls: 0, inTok: 0, outTok: 0, cost: 0 };
    out.ai[k] = { calls: x.calls + v.calls, inTok: x.inTok + v.inTok, outTok: x.outTok + v.outTok, cost: x.cost + v.cost };
  }
  for (const [p, ids] of Object.entries(b.users ?? {})) out.users[p] = [...new Set([...(out.users[p] ?? []), ...ids])];
  return out;
}

async function readDay(d: string): Promise<{ usage: DayUsage; files: string[] }> {
  const files = (await listObjects(`usage/day/${d}`, 1000)).filter((f) => f.name.endsWith('.json')).map((f) => `usage/day/${d}/${f.name}`);
  const parts = await Promise.all(files.map((f) => getJson<DayUsage | null>(f, null)));
  return { usage: parts.reduce<DayUsage>((acc, x) => (x ? merge(acc, x) : acc), empty()), files };
}

/**
 * This month's usage, day by day. Finished days are folded into the month summary
 * (and their per-instance files removed) the first time they are read.
 */
export async function monthUsage(): Promise<Record<string, DayUsage>> {
  await flush();
  const month = today().slice(0, 7);
  const summaryPath = `usage/month/${month}.json`;
  const summary = await getJson<MonthSummary>(summaryPath, { days: {} });
  const folders = (await listObjects('usage/day', 1000)).map((f) => f.name).filter((n) => /^\d{4}-\d{2}-\d{2}$/.test(n));
  let changed = false;
  for (const d of folders.filter((n) => n < today())) {
    const { usage, files } = await readDay(d);
    if (d.startsWith(month)) {
      summary.days[d] = summary.days[d] ? merge(summary.days[d], usage) : usage;
      changed = true;
    } else {
      // A finished day of an earlier month: add it to that month's summary.
      const past = await getJson<MonthSummary>(`usage/month/${d.slice(0, 7)}.json`, { days: {} });
      past.days[d] = past.days[d] ? merge(past.days[d], usage) : usage;
      await putJson(`usage/month/${d.slice(0, 7)}.json`, past);
    }
    await removeObjects('booklit', files);
  }
  if (changed) await putJson(summaryPath, summary);
  const live = await readDay(today());
  return { ...summary.days, [today()]: live.usage };
}

/** Totals for the month. */
export function totals(days: Record<string, DayUsage>) {
  const all = Object.values(days).reduce(merge, empty());
  const ai = Object.values(all.ai).reduce((n, s) => ({ calls: n.calls + s.calls, cost: n.cost + s.cost, inTok: n.inTok + s.inTok, outTok: n.outTok + s.outTok }), { calls: 0, cost: 0, inTok: 0, outTok: 0 });
  const users = new Set(Object.values(all.users).flat());
  return { requests: all.requests, ai, aiByKind: all.ai, activeUsers: users.size, android: (all.users.android ?? []).length, ios: (all.users.ios ?? []).length, web: (all.users.web ?? []).length };
}

// Cached month AI cost so every AI request can check the budget cheaply.
let monthCache: { at: number; cost: number } | null = null;
export async function monthAiCost(): Promise<number> {
  if (monthCache && Date.now() - monthCache.at < 5 * 60_000) return monthCache.cost;
  try {
    const cost = totals(await monthUsage()).ai.cost;
    monthCache = { at: Date.now(), cost };
    return cost;
  } catch {
    return 0;
  }
}

export async function getLimits(): Promise<Limits> {
  return { ...DEFAULT_LIMITS, ...(await getJson<Partial<Limits>>('config/limits.json', {})) };
}

/** Total size (bytes) of everything in a storage bucket. */
export async function bucketSize(bucket: string): Promise<number> {
  let total = 0;
  const walk = async (prefix: string, depth: number): Promise<void> => {
    if (depth > 4) return;
    const res = await sb(`/storage/v1/object/list/${bucket}`, { method: 'POST', body: JSON.stringify({ prefix, limit: 1000, offset: 0 }) });
    if (!res.ok) return;
    const items = (await res.json()) as { name: string; id: string | null; metadata?: { size?: number } | null }[];
    await Promise.all(
      items.map((it) => {
        if (it.id === null) return walk(prefix ? `${prefix}/${it.name}` : it.name, depth + 1); // a folder
        total += it.metadata?.size ?? 0;
        return undefined;
      }),
    );
  };
  await walk('', 0);
  return total;
}
