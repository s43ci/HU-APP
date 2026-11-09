import { t } from '@/i18n';
import { API_BASE } from './ai';

/**
 * BOOKLIT server calls with the signed-in session.
 * The store owns the session (and saves it); this module holds the live copy so any
 * library function can add the token, and refreshes it when it is about to expire.
 */
export type Session = { access: string; refresh: string; expiresAt: number };

let current: Session | null = null;
let onChange: ((s: Session | null) => void) | null = null;
let refreshing: Promise<Session | null> | null = null;

export function setSession(s: Session | null) {
  current = s;
}
export function onSessionChange(fn: (s: Session | null) => void) {
  onChange = fn;
}
export const getSession = () => current;

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function refresh(): Promise<Session | null> {
  if (!current) return null;
  refreshing ??= (async () => {
    try {
      const res = await fetch(`${API_BASE}/api/auth`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'refresh', refresh: current!.refresh }) });
      if (res.status === 401 || res.status === 403) {
        current = null;
        onChange?.(null);
        return null;
      }
      if (!res.ok) return current; // offline / server hiccup: keep the old session
      const data = (await res.json()) as { session: Session };
      current = data.session;
      onChange?.(current);
      return current;
    } catch {
      return current;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

/** Authorization header for the current session (refreshed first if it expires within a minute). */
export async function authHeader(): Promise<Record<string, string>> {
  if (current && current.expiresAt - Date.now() < 60_000) await refresh();
  return current ? { Authorization: `Bearer ${current.access}` } : {};
}

export async function api<T>(path: string, init: { method?: string; body?: unknown; auth?: boolean } = {}): Promise<T> {
  const send = async () => {
    const headers: Record<string, string> = { ...(init.auth === false ? {} : await authHeader()) };
    if (init.body !== undefined) headers['Content-Type'] = 'application/json';
    return fetch(`${API_BASE}${path}`, { method: init.method ?? (init.body !== undefined ? 'POST' : 'GET'), headers, body: init.body !== undefined ? JSON.stringify(init.body) : undefined });
  };
  let res: Response;
  try {
    res = await send();
    if (res.status === 401 && init.auth !== false && current) {
      if (await refresh()) res = await send();
    }
  } catch {
    throw new ApiError('No internet connection. Please try again.', 0);
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    if (res.status === 403 && /suspended/i.test(data.error ?? '')) {
      current = null;
      onChange?.(null);
    }
    throw new ApiError(data.error || `Request failed (${res.status})`, res.status);
  }
  return data;
}

// ---------- shared types (mirror of src/server/supa.ts) ----------
export type Perm = 'content' | 'requests' | 'students' | 'pricing' | 'stats';
export type Plan = 'free' | 'pro' | 'premium';
export type Account = {
  id: string;
  email: string;
  name: string;
  stageId: string;
  kind: 'student' | 'staff' | 'admin';
  plan: Plan;
  planUntil: string | null;
  perms: Perm[];
  blocked: boolean;
  createdAt: string;
  lastSignIn: string | null;
};
export type PlanConfig = {
  currency: string;
  paymentNote: string;
  plans: Record<'pro' | 'premium', { price: number; discountPct: number; free: boolean; days: number }>;
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
export const PERM_LABELS: Record<Perm, { title: string; text: string }> = {
  content: { title: 'Booklets & question banks', text: 'Upload, design, edit and publish content' },
  requests: { title: 'Subscription requests', text: 'Approve or reject Pro and Premium requests' },
  students: { title: 'Students', text: 'See students, change plans, block accounts' },
  pricing: { title: 'Prices & discounts', text: 'Set prices, discounts and free plans' },
  stats: { title: 'Statistics', text: 'Registrations, subscribers and income' },
};

export const finalPrice = (c: PlanConfig, plan: 'pro' | 'premium') => {
  const p = c.plans[plan];
  return p.free ? 0 : Math.round(p.price * (1 - Math.min(100, Math.max(0, p.discountPct)) / 100));
};

export const formatPrice = (n: number, currency: string) => `${n.toLocaleString('en-US')} ${currency === 'IQD' ? t('IQD') : currency}`;
