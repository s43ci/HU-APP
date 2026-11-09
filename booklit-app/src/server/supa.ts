/**
 * BOOKLIT backend on Supabase (server only: never import from app screens).
 *
 * - Accounts live in Supabase Auth. Who someone is (student / staff / admin), their plan,
 *   staff permissions and the blocked flag live in `app_metadata`, which only this server can change.
 * - Everything else (plans & prices, subscription requests, published booklets) is JSON in a private
 *   Storage bucket. Images of published booklets go to a public bucket so every device can load them.
 */
import { CORS, json } from './gemini';

export { CORS, json };

export const PERMS = ['content', 'requests', 'students', 'pricing', 'stats'] as const;
export type Perm = (typeof PERMS)[number];
export type Plan = 'free' | 'pro' | 'premium';
export type Kind = 'student' | 'staff' | 'admin';

export type Account = {
  id: string;
  email: string;
  name: string;
  stageId: string;
  kind: Kind;
  plan: Plan;
  planUntil: string | null;
  perms: Perm[];
  blocked: boolean;
  createdAt: string;
  lastSignIn: string | null;
};

export type PlanConfig = {
  currency: string;
  /** Shown to students under the plans: how to pay (Zain Cash number, office, …). */
  paymentNote: string;
  plans: Record<'pro' | 'premium', { price: number; discountPct: number; free: boolean; days: number }>;
};

export const DEFAULT_PLANS: PlanConfig = {
  currency: 'IQD',
  paymentNote: '',
  plans: {
    pro: { price: 15000, discountPct: 0, free: false, days: 365 },
    premium: { price: 25000, discountPct: 0, free: false, days: 365 },
  },
};

export type SubRequest = {
  id: string;
  userId: string;
  name: string;
  email: string;
  stageId: string;
  plan: 'pro' | 'premium';
  price: number;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  decidedAt?: string;
  decidedBy?: string;
  note?: string;
};

const BUCKET = 'booklit';
export const MEDIA = 'booklit-media';

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function env() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const secret = process.env.SUPABASE_SECRET_KEY;
  const pub = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !secret || !pub) throw new HttpError(500, 'Accounts are not configured on the server.');
  return { url, secret, pub };
}

/** Call Supabase with the secret key (full access). */
export async function sb(path: string, init: RequestInit = {}) {
  const { url, secret } = env();
  const headers = new Headers(init.headers);
  headers.set('apikey', secret);
  headers.set('Authorization', `Bearer ${secret}`);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  return fetch(`${url}${path}`, { ...init, headers });
}

/** Call Supabase Auth as the public app (used for password sign-in and token refresh). */
export async function sbPublic(path: string, init: RequestInit = {}, token?: string) {
  const { url, pub } = env();
  const headers = new Headers(init.headers);
  headers.set('apikey', pub);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  return fetch(`${url}${path}`, { ...init, headers });
}

export async function sbJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const d = data as { msg?: string; message?: string; error_description?: string; error?: string } | null;
    throw new HttpError(res.status >= 500 ? 502 : res.status, d?.msg || d?.error_description || d?.message || (typeof d?.error === 'string' ? d.error : '') || `Request failed (${res.status})`);
  }
  return data as T;
}

// ---------- accounts ----------

type SbUser = {
  id: string;
  email?: string;
  created_at: string;
  last_sign_in_at?: string | null;
  user_metadata?: { name?: string; stageId?: string };
  app_metadata?: { kind?: Kind; plan?: Plan; planUntil?: string | null; perms?: Perm[]; blocked?: boolean };
};

export function toAccount(u: SbUser): Account {
  const am = u.app_metadata ?? {};
  const until = am.planUntil ?? null;
  const expired = !!until && new Date(until).getTime() < Date.now();
  const kind: Kind = am.kind === 'admin' || am.kind === 'staff' ? am.kind : 'student';
  return {
    id: u.id,
    email: u.email ?? '',
    name: u.user_metadata?.name ?? '',
    stageId: u.user_metadata?.stageId ?? 'stage5',
    kind,
    plan: expired ? 'free' : am.plan === 'pro' || am.plan === 'premium' ? am.plan : 'free',
    planUntil: until,
    perms: kind === 'admin' ? [...PERMS] : (am.perms ?? []).filter((p): p is Perm => (PERMS as readonly string[]).includes(p)),
    blocked: !!am.blocked,
    createdAt: u.created_at,
    lastSignIn: u.last_sign_in_at ?? null,
  };
}

export async function getUserById(id: string) {
  return sbJson<SbUser>(await sb(`/auth/v1/admin/users/${id}`));
}

/** Update a user. `app` is merged into app_metadata by Supabase. */
export async function updateUser(id: string, patch: { app?: Record<string, unknown>; meta?: Record<string, unknown>; password?: string; email?: string }) {
  const body: Record<string, unknown> = {};
  if (patch.app) body.app_metadata = patch.app;
  if (patch.meta) body.user_metadata = patch.meta;
  if (patch.password) body.password = patch.password;
  if (patch.email) body.email = patch.email;
  return toAccount(await sbJson<SbUser>(await sb(`/auth/v1/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(body) })));
}

export async function createUser(email: string, password: string, meta: Record<string, unknown>, app: Record<string, unknown>) {
  const res = await sb('/auth/v1/admin/users', {
    method: 'POST',
    body: JSON.stringify({ email, password, email_confirm: true, user_metadata: meta, app_metadata: app }),
  });
  if (res.status === 422 || res.status === 409) {
    const t = await res.text();
    if (/already|registered|exists/i.test(t)) throw new HttpError(409, 'This email already has an account. Sign in instead.');
    throw new HttpError(400, /password/i.test(t) ? 'Password is too weak. Use at least 8 characters.' : 'Please check the email and password.');
  }
  return toAccount(await sbJson<SbUser>(res));
}

export async function listUsers(): Promise<Account[]> {
  const all: Account[] = [];
  for (let page = 1; page <= 20; page++) {
    const data = await sbJson<{ users: SbUser[] }>(await sb(`/auth/v1/admin/users?page=${page}&per_page=1000`));
    all.push(...data.users.map(toAccount));
    if (data.users.length < 1000) break;
  }
  return all;
}

/** The signed-in account for this request (from its `Authorization: Bearer` token). */
export async function requireUser(request: Request): Promise<Account> {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) throw new HttpError(401, 'Please sign in.');
  const res = await sbPublic('/auth/v1/user', {}, token);
  if (res.status === 401 || res.status === 403) throw new HttpError(401, 'Your session has expired. Please sign in again.');
  const acc = toAccount(await sbJson<SbUser>(res));
  if (acc.blocked) throw new HttpError(403, 'This account has been suspended. Contact the BOOKLIT team.');
  return acc;
}

export const isStaff = (a: Account) => a.kind === 'admin' || a.kind === 'staff';
export const can = (a: Account, perm: Perm) => a.kind === 'admin' || (a.kind === 'staff' && a.perms.includes(perm));

export async function requirePerm(request: Request, perm: Perm | 'admin') {
  const a = await requireUser(request);
  if (perm === 'admin' ? a.kind !== 'admin' : !can(a, perm)) throw new HttpError(403, 'You do not have permission for this.');
  return a;
}

// ---------- storage ----------

let bucketsReady: Promise<void> | null = null;
function ensureBuckets() {
  bucketsReady ??= (async () => {
    for (const [id, pub] of [
      [BUCKET, false],
      [MEDIA, true],
    ] as const) {
      const res = await sb('/storage/v1/bucket', { method: 'POST', body: JSON.stringify({ id, name: id, public: pub }) });
      if (!res.ok && res.status !== 409 && res.status !== 400) throw new HttpError(502, `Storage error (${res.status})`);
    }
  })().catch((e) => {
    bucketsReady = null;
    throw e;
  });
  return bucketsReady;
}

export async function getJson<T>(path: string, fallback: T): Promise<T> {
  const res = await sb(`/storage/v1/object/${BUCKET}/${path}?t=${Date.now()}`, { headers: { 'Cache-Control': 'no-cache' } });
  if (res.status === 404 || res.status === 400) return fallback;
  if (!res.ok) throw new HttpError(502, `Storage error (${res.status})`);
  return (await res.json()) as T;
}

export async function putJson(path: string, data: unknown) {
  await ensureBuckets();
  const res = await sb(`/storage/v1/object/${BUCKET}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-upsert': 'true', 'cache-control': 'max-age=0' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new HttpError(502, `Storage error (${res.status}): ${(await res.text()).slice(0, 120)}`);
}

export async function removeObjects(bucket: string, paths: string[]) {
  if (!paths.length) return;
  await ensureBuckets();
  await sb(`/storage/v1/object/${bucket}`, { method: 'DELETE', body: JSON.stringify({ prefixes: paths }) });
}

export async function listObjects(prefix: string, limit = 200): Promise<{ name: string; created_at: string }[]> {
  const res = await sb(`/storage/v1/object/list/${BUCKET}`, {
    method: 'POST',
    body: JSON.stringify({ prefix, limit, offset: 0, sortBy: { column: 'created_at', order: 'desc' } }),
  });
  if (res.status === 400 || res.status === 404) return [];
  return sbJson(res);
}

export async function putMedia(path: string, bytes: Uint8Array, mime: string) {
  await ensureBuckets();
  const res = await sb(`/storage/v1/object/${MEDIA}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': mime, 'x-upsert': 'true', 'cache-control': 'max-age=31536000' },
    body: bytes as unknown as BodyInit,
  });
  if (!res.ok) throw new HttpError(502, `Upload failed (${res.status})`);
  return `${env().url}/storage/v1/object/public/${MEDIA}/${path}`;
}

export async function getPlans(): Promise<PlanConfig> {
  const c = await getJson<Partial<PlanConfig>>('config/plans.json', DEFAULT_PLANS);
  return {
    ...DEFAULT_PLANS,
    ...c,
    plans: { pro: { ...DEFAULT_PLANS.plans.pro, ...c.plans?.pro }, premium: { ...DEFAULT_PLANS.plans.premium, ...c.plans?.premium } },
  };
}

export const finalPrice = (c: PlanConfig, plan: 'pro' | 'premium') => {
  const p = c.plans[plan];
  return p.free ? 0 : Math.round(p.price * (1 - Math.min(100, Math.max(0, p.discountPct)) / 100));
};

export const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/** Wrap an API handler: JSON errors with the right status, CORS everywhere. */
export function handle(fn: (request: Request) => Promise<Response>) {
  return async (request: Request) => {
    try {
      return await fn(request);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status);
      return json({ error: (e as Error).message || 'Server error' }, 500);
    }
  };
}

export const optionsHandler = () => new Response(null, { headers: CORS });

/**
 * Gate for the AI routes (they spend the Gemini budget).
 * 'user': any signed-in, non-blocked account. 'files': Premium students and staff who can upload.
 * Returns an error Response, or null when allowed.
 */
export async function aiGate(request: Request, level: 'user' | 'files'): Promise<Response | null> {
  try {
    const a = await requireUser(request);
    if (level === 'files' && !(a.plan === 'premium' || can(a, 'content'))) return json({ error: 'Converting your own files is part of Premium.' }, 403);
    return null;
  } catch (e) {
    return json({ error: (e as Error).message }, e instanceof HttpError ? e.status : 401);
  }
}
