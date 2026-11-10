/**
 * Usage metering for the admin "Usage" page (server only).
 *
 * The host allows only ~8 outgoing calls per request, so usage is stored as tiny empty files whose
 * NAMES carry the numbers (usage/e/<month>/...): one list call reads up to 1,000 of them. From time
 * to time they are folded into a monthly summary (usage/month/<month>.json) and removed.
 *   r~<day>~<count>~<id>                              API requests (saved in batches)
 *   a~<day>~<kind>~<micro-USD>~<in-tokens>~<out-tokens>~<id>   one AI call
 *   u~<platform>~<user id>                            an active user this month (same name = counted once)
 */
import { getJson, listObjects, putJson, putMarker, removeObjects } from './supa';

// gemini-3.5-flash-lite, Standard tier (USD per 1M tokens; thinking counts as output).
const PRICE_IN = 0.3;
const PRICE_OUT = 2.5;

export type AiKind = 'ask' | 'edit' | 'mcq' | 'import' | 'bank';
type AiStat = { calls: number; inTok: number; outTok: number; cost: number };
type Day = { requests: number; ai: Partial<Record<AiKind, AiStat>> };
export type MonthUsage = { days: Record<string, Day>; users: Record<string, string[]> };

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

const day = () => new Date().toISOString().slice(0, 10);
const month = () => day().slice(0, 7);
const rid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const dir = (m = month()) => `usage/e/${m}`;

let pending = 0;
let lastFlush = Date.now();
const seenUsers = new Set<string>();
let seenDay = day();

/**
 * Count one API request. Saved in batches (~25 requests or a minute).
 * Heavy routes pass `canSave = false` so they keep their outgoing calls for the real work.
 */
export async function countRequest(canSave = true) {
  pending++;
  if (!canSave || (pending < 25 && Date.now() - lastFlush < 60_000)) return;
  const n = pending;
  pending = 0;
  lastFlush = Date.now();
  try {
    await putMarker(`${dir()}/r~${day()}~${n}~${rid()}`);
  } catch {
    pending += n;
  }
}

/** Count an active user (written once per server instance per day; the same name is never counted twice). */
export async function countUser(id: string, platform: string | null) {
  if (seenDay !== day()) {
    seenDay = day();
    seenUsers.clear();
  }
  const p = platform === 'android' || platform === 'ios' ? platform : 'web';
  const key = `${p}~${id}`;
  if (seenUsers.has(key)) return;
  seenUsers.add(key);
  await putMarker(`${dir()}/u~${key}`).catch(() => seenUsers.delete(key));
}

/** Record one Gemini call from its usageMetadata. */
export async function countAi(kind: AiKind, meta?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number }) {
  const inTok = meta?.promptTokenCount ?? 0;
  const outTok = (meta?.candidatesTokenCount ?? 0) + (meta?.thoughtsTokenCount ?? 0);
  const cost = (inTok * PRICE_IN + outTok * PRICE_OUT) / 1_000_000;
  if (monthCache) monthCache.cost += cost;
  await putMarker(`${dir()}/a~${day()}~${kind}~${Math.round(cost * 1e6)}~${inTok}~${outTok}~${rid()}`).catch(() => {});
}

const emptyMonth = (): MonthUsage => ({ days: {}, users: {} });

/** Add the events in these file names to a month summary. */
function addEvents(m: MonthUsage, names: string[]) {
  for (const name of names) {
    const f = name.split('~');
    if (f[0] === 'r') {
      const d = (m.days[f[1]] ??= { requests: 0, ai: {} });
      d.requests += Number(f[2]) || 0;
    } else if (f[0] === 'a') {
      const d = (m.days[f[1]] ??= { requests: 0, ai: {} });
      const s = (d.ai[f[2] as AiKind] ??= { calls: 0, inTok: 0, outTok: 0, cost: 0 });
      s.calls++;
      s.cost += (Number(f[3]) || 0) / 1e6;
      s.inTok += Number(f[4]) || 0;
      s.outTok += Number(f[5]) || 0;
    } else if (f[0] === 'u') {
      const list = (m.users[f[1]] ??= []);
      if (!list.includes(f[2])) list.push(f[2]);
    }
  }
}

/** This month: the folded summary plus up to 1,000 newer events. 2 outgoing calls. */
export async function monthUsage(): Promise<{ usage: MonthUsage; needsFold: boolean }> {
  const [summary, events] = await Promise.all([getJson<MonthUsage>(`usage/month/${month()}.json`, emptyMonth()), listObjects(dir(), 1000)]);
  const usage: MonthUsage = { days: summary.days ?? {}, users: summary.users ?? {} };
  addEvents(usage, events.map((e) => e.name));
  return { usage, needsFold: events.length >= 800 };
}

/** Fold up to 1,000 events into the month summary and remove them. 4 outgoing calls. */
export async function foldUsage(): Promise<{ folded: number }> {
  const path = `usage/month/${month()}.json`;
  const [summary, events] = await Promise.all([getJson<MonthUsage>(path, emptyMonth()), listObjects(dir(), 1000)]);
  if (!events.length) return { folded: 0 };
  const usage: MonthUsage = { days: summary.days ?? {}, users: summary.users ?? {} };
  const names = events.map((e) => e.name);
  addEvents(usage, names);
  await putJson(path, usage);
  await removeObjects('booklit', names.map((n) => `${dir()}/${n}`));
  monthCache = null;
  return { folded: names.length };
}

/** Totals for the month. */
export function totals(u: MonthUsage) {
  const days = Object.values(u.days);
  const ai = { calls: 0, cost: 0, inTok: 0, outTok: 0 };
  const aiByKind: Partial<Record<AiKind, AiStat>> = {};
  let requests = 0;
  for (const d of days) {
    requests += d.requests;
    for (const [k, s] of Object.entries(d.ai) as [AiKind, AiStat][]) {
      const x = (aiByKind[k] ??= { calls: 0, inTok: 0, outTok: 0, cost: 0 });
      x.calls += s.calls;
      x.inTok += s.inTok;
      x.outTok += s.outTok;
      x.cost += s.cost;
      ai.calls += s.calls;
      ai.cost += s.cost;
      ai.inTok += s.inTok;
      ai.outTok += s.outTok;
    }
  }
  const users = new Set(Object.values(u.users).flat());
  return { requests, ai, aiByKind, activeUsers: users.size, android: (u.users.android ?? []).length, ios: (u.users.ios ?? []).length, web: (u.users.web ?? []).length };
}

// Cached month AI cost so AI requests can check the budget cheaply (refreshed at most every 5 minutes).
let monthCache: { at: number; cost: number } | null = null;
export async function monthAiCost(canRefresh = true): Promise<number> {
  if (monthCache && (Date.now() - monthCache.at < 5 * 60_000 || !canRefresh)) return monthCache.cost;
  if (!canRefresh) return 0;
  try {
    const cost = totals((await monthUsage()).usage).ai.cost;
    monthCache = { at: Date.now(), cost };
    return cost;
  } catch {
    return monthCache?.cost ?? 0;
  }
}

export async function getLimits(): Promise<Limits> {
  return { ...DEFAULT_LIMITS, ...(await getJson<Partial<Limits>>('config/limits.json', {})) };
}

/** Uploaded image bytes (a running total; uploads are rare and done by the team). */
export async function addMediaBytes(n: number) {
  try {
    const cur = await getJson<{ bytes: number }>('usage/media.json', { bytes: 0 });
    await putJson('usage/media.json', { bytes: cur.bytes + n });
  } catch {}
}
export const mediaBytes = async () => (await getJson<{ bytes: number }>('usage/media.json', { bytes: 0 })).bytes;
