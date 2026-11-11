import {
  can,
  createUser,
  finalPrice,
  getJson,
  getPlans,
  getUserById,
  handle,
  HttpError,
  isStaff,
  json,
  listUsers,
  optionsHandler,
  PERMS,
  putJson,
  removeObjects,
  requirePerm,
  requireUser,
  toAccount,
  updateUser,
  type Account,
  type Perm,
  type PlanConfig,
  type SubRequest,
} from '@/server/supa';
import { DEFAULT_LIMITS, foldUsage, getLimits, mediaBytes, monthUsage, totals, type Limits } from '@/server/usage';

/**
 * Admin dashboard API. Every call: POST { action, ...params } with the staff member's token.
 * Each action checks its own permission; managing staff is for the admin only.
 */
type Body = Record<string, unknown> & { action?: string };

export type PublishedIndex = { updatedAt: number; booklets: { id: string; title: string; subjectId?: string; topics: number; updatedAt: number; by: string }[] };
const EMPTY_INDEX: PublishedIndex = { updatedAt: 0, booklets: [] };

const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const num = (v: unknown, min: number, max: number, def: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};
const cleanPerms = (v: unknown): Perm[] => (Array.isArray(v) ? v.filter((p): p is Perm => (PERMS as readonly string[]).includes(p as string)) : []);

/** Every student's latest subscription request (stored on their account), newest first. */
const requestsOf = (users: Account[]) =>
  users
    .filter((u) => u.request)
    .map((u) => ({ ...(u.request as SubRequest), userId: u.id, name: u.name || u.request!.name, email: u.email }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

/** Usage against plan limits, with warnings at 80% and 100%. */
async function usageReport() {
  // The host allows only ~8 outgoing calls per request: this report needs 4 (+1 to check the admin).
  const [{ usage, needsFold }, limits, media] = await Promise.all([monthUsage(), getLimits(), mediaBytes()]);
  const t = totals(usage);
  const days = usage.days;
  const storageMb = media / 1024 / 1024;
  const meters = [
    { key: 'ai', label: 'AI (Gemini) this month', used: Math.round(t.ai.cost * 10000) / 10000, limit: limits.aiBudgetUsd, unit: 'USD' },
    { key: 'hosting', label: 'Server requests (Expo Hosting)', used: t.requests, limit: limits.hostingRequests, unit: 'requests' },
    { key: 'storage', label: 'Uploaded images (Supabase)', used: Math.round(storageMb * 10) / 10, limit: limits.storageMb, unit: 'MB' },
    { key: 'accounts', label: 'Active accounts (Supabase)', used: t.activeUsers, limit: limits.accounts, unit: 'users' },
    { key: 'android', label: 'Android app users (Expo Update)', used: t.android, limit: limits.androidMau, unit: 'users' },
  ].map((m) => ({ ...m, pct: m.limit > 0 ? m.used / m.limit : 1 }));
  const alerts = meters.filter((m) => m.pct >= 0.8).map((m) => ({ key: m.key, label: m.label, pct: m.pct, level: m.pct >= 1 ? 'over' : 'near' }));
  const daily = Object.entries(days)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([d, u]) => ({ day: d, requests: u.requests, ai: Object.values(u.ai).reduce((n, x) => n + (x?.cost ?? 0), 0), aiCalls: Object.values(u.ai).reduce((n, x) => n + (x?.calls ?? 0), 0) }));
  return { needsFold, meters, alerts, limits, ai: t.ai, aiByKind: t.aiByKind, platforms: { web: t.web, android: t.android, ios: t.ios }, daily };
}

export const OPTIONS = optionsHandler;

export const POST = handle(async (request) => {
  const b = (await request.json().catch(() => ({}))) as Body;

  switch (b.action) {
    // ----- overview -----
    case 'me': {
      const me = await requireUser(request);
      if (!isStaff(me)) throw new HttpError(403, 'You do not have permission for this.');
      return json({ account: me });
    }
    case 'overview': {
      const me = await requireUser(request);
      if (!isStaff(me)) throw new HttpError(403, 'You do not have permission for this.');
      const showStats = can(me, 'stats');
      const [users, plans] = await Promise.all([listUsers(), getPlans()]);
      const reqs = requestsOf(users);
      const students = users.filter((u) => u.kind === 'student');
      const weekAgo = Date.now() - 7 * 86400000;
      const approved = reqs.filter((r) => r.status === 'approved');
      return json({
        stats: showStats
          ? {
              students: students.length,
              newThisWeek: students.filter((u) => new Date(u.createdAt).getTime() > weekAgo).length,
              pro: students.filter((u) => u.plan === 'pro').length,
              premium: students.filter((u) => u.plan === 'premium').length,
              free: students.filter((u) => u.plan === 'free').length,
              blocked: users.filter((u) => u.blocked).length,
              staff: users.filter((u) => u.kind !== 'student').length,
              revenue: users.reduce((n, u) => n + u.paidTotal, 0),
              approved: approved.length,
            }
          : null,
        pending: reqs.filter((r) => r.status === 'pending').length,
        plans,
      });
    }

    // ----- usage & limits -----
    case 'usage': {
      const me = await requireUser(request);
      if (!can(me, 'stats')) throw new HttpError(403, 'You do not have permission for this.');
      return json(await usageReport());
    }
    case 'usage.fold': {
      const me = await requireUser(request);
      if (!can(me, 'stats')) throw new HttpError(403, 'You do not have permission for this.');
      return json(await foldUsage());
    }
    case 'limits.save': {
      await requirePerm(request, 'admin');
      const inp = (b.limits ?? {}) as Partial<Limits>;
      const cur = await getLimits();
      const next = Object.fromEntries(
        (Object.keys(DEFAULT_LIMITS) as (keyof Limits)[]).map((k) => [k, num(inp[k], 0, 1e9, cur[k])]),
      ) as Limits;
      await putJson('config/limits.json', next);
      return json({ limits: next });
    }

    // ----- subscription requests -----
    case 'requests.list': {
      await requirePerm(request, 'requests');
      return json({ requests: requestsOf(await listUsers()) });
    }
    case 'requests.decide': {
      const me = await requirePerm(request, 'requests');
      const user = toAccount(await getUserById(str(b.userId, 80)));
      const req = user.request;
      if (!req || (b.id && req.id !== b.id)) throw new HttpError(404, 'Request not found.');
      if (req.status !== 'pending') throw new HttpError(409, 'This request was already handled.');
      const approve = b.approve === true;
      const decided: SubRequest = { ...req, status: approve ? 'approved' : 'rejected', decidedAt: new Date().toISOString(), decidedBy: me.name || me.email, note: str(b.note, 300) || undefined };
      const app: Record<string, unknown> = { request: decided };
      if (approve) {
        const plans = await getPlans();
        const days = num(b.days, 1, 3650, plans.plans[req.plan].days);
        Object.assign(app, { plan: req.plan, planUntil: new Date(Date.now() + days * 86400000).toISOString(), paidTotal: user.paidTotal + (req.price || 0) });
      }
      await updateUser(user.id, { app });
      return json({ request: decided });
    }

    // ----- students -----
    case 'users.list': {
      await requirePerm(request, 'students');
      const users = await listUsers();
      return json({ users: users.filter((u) => u.kind === 'student').sort((a, c) => c.createdAt.localeCompare(a.createdAt)) });
    }
    case 'users.update': {
      await requirePerm(request, 'students');
      const target = toAccount(await getUserById(str(b.id, 80)));
      if (target.kind !== 'student') throw new HttpError(403, 'Staff accounts are managed in the Staff section.');
      const app: Record<string, unknown> = {};
      if (typeof b.blocked === 'boolean') app.blocked = b.blocked;
      if (b.plan === 'free') Object.assign(app, { plan: 'free', planUntil: null });
      else if (b.plan === 'pro' || b.plan === 'premium') {
        const plans = await getPlans();
        const days = num(b.days, 1, 3650, plans.plans[b.plan].days);
        Object.assign(app, { plan: b.plan, planUntil: new Date(Date.now() + days * 86400000).toISOString() });
      }
      return json({ user: await updateUser(target.id, { app }) });
    }

    // ----- plans & prices -----
    case 'plans.get': {
      const me = await requireUser(request);
      if (!isStaff(me)) throw new HttpError(403, 'You do not have permission for this.');
      return json({ plans: await getPlans() });
    }
    case 'plans.save': {
      await requirePerm(request, 'pricing');
      const cur = await getPlans();
      const inp = (b.plans ?? {}) as Partial<PlanConfig>;
      const plan = (k: 'pro' | 'premium') => {
        const x = (inp.plans?.[k] ?? {}) as Partial<PlanConfig['plans']['pro']>;
        const c = cur.plans[k];
        return {
          price: Math.round(num(x.price, 0, 100000000, c.price)),
          discountPct: Math.round(num(x.discountPct, 0, 100, c.discountPct)),
          free: typeof x.free === 'boolean' ? x.free : c.free,
          days: Math.round(num(x.days, 1, 3650, c.days)),
        };
      };
      const next: PlanConfig = {
        currency: str(inp.currency, 8) || cur.currency,
        paymentNote: typeof inp.paymentNote === 'string' ? inp.paymentNote.slice(0, 600) : cur.paymentNote,
        plans: { pro: plan('pro'), premium: plan('premium') },
      };
      await putJson('config/plans.json', next);
      return json({ plans: next, prices: { pro: finalPrice(next, 'pro'), premium: finalPrice(next, 'premium') } });
    }

    // ----- which plan opens each subject -----
    case 'subjects.save': {
      await requirePerm(request, 'pricing');
      const inp = (b.access ?? {}) as Record<string, unknown>;
      const access: Record<string, string> = {};
      Object.entries(inp).forEach(([k, v]) => {
        if (/^[\w-]{1,60}$/.test(k) && (v === 'free' || v === 'pro' || v === 'premium')) access[k] = v;
      });
      await putJson('config/subjects.json', access);
      return json({ access });
    }

    // ----- catalog: subjects, booklet order, universities, AI rules -----
    case 'catalog.save': {
      await requirePerm(request, 'content');
      const c = (b.catalog ?? {}) as Record<string, unknown>;
      const id = (v: unknown) => str(v, 60).replace(/[^\w-]/g, '');
      const stage = (v: unknown) => (typeof v === 'string' && /^stage[1-5]$/.test(v) ? v : 'stage1');
      const arr = (v: unknown, max: number) => (Array.isArray(v) ? v.slice(0, max) : []);
      const catalog = {
        subjects: arr(c.subjects, 200)
          .map((x) => x as Record<string, unknown>)
          .filter((x) => id(x.id) && str(x.name, 80))
          .map((x) => ({
            id: id(x.id),
            name: str(x.name, 80),
            stageId: stage(x.stageId),
            color: '#493BEA',
            icon: 'book',
            isFree: x.isFree !== false,
            description: str(x.description, 200),
            image: /^https:\/\//.test(String(x.image ?? '')) ? str(x.image, 500) : undefined,
          })),
        hiddenSubjects: arr(c.hiddenSubjects, 300).map(id).filter(Boolean),
        order: Object.fromEntries(
          Object.entries((c.order ?? {}) as Record<string, unknown>)
            .slice(0, 300)
            .map(([k, v]) => [id(k), arr(v, 200).map((x) => str(x, 120)).filter(Boolean)]),
        ),
        universities: arr(c.universities, 100)
          .map((x) => x as Record<string, unknown>)
          .filter((x) => id(x.id) && str(x.name, 100))
          .map((x) => ({
            id: id(x.id),
            name: str(x.name, 100),
            subjects: Object.fromEntries(
              Object.entries((x.subjects ?? {}) as Record<string, unknown>)
                .filter(([k]) => /^stage[1-5]$/.test(k))
                .map(([k, v]) => [k, arr(v, 100).map(id).filter(Boolean)]),
            ),
          })),
        ai: {
          split: typeof (c.ai as Record<string, unknown>)?.split === 'string' ? str((c.ai as Record<string, string>).split, 3000) : '',
          design: typeof (c.ai as Record<string, unknown>)?.design === 'string' ? str((c.ai as Record<string, string>).design, 3000) : '',
          mcq: typeof (c.ai as Record<string, unknown>)?.mcq === 'string' ? str((c.ai as Record<string, string>).mcq, 3000) : '',
        },
      };
      await putJson('config/catalog.json', catalog);
      return json({ catalog });
    }
    case 'universities.stats': {
      const me = await requireUser(request);
      if (!isStaff(me)) throw new HttpError(403, 'You do not have permission for this.');
      const counts: Record<string, number> = {};
      for (const u of await listUsers()) if (u.kind === 'student') counts[u.universityId ?? ''] = (counts[u.universityId ?? ''] ?? 0) + 1;
      return json({ counts });
    }

    // ----- staff (admin only) -----
    case 'staff.list': {
      await requirePerm(request, 'admin');
      const users = await listUsers();
      return json({ staff: users.filter((u) => u.kind !== 'student') });
    }
    case 'staff.create': {
      await requirePerm(request, 'admin');
      const email = str(b.email, 120).toLowerCase();
      const password = typeof b.password === 'string' ? b.password : '';
      const name = str(b.name, 60);
      if (name.length < 2) throw new HttpError(400, 'Please write the name.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Please enter a valid email.');
      if (password.length < 8) throw new HttpError(400, 'Password must be at least 8 characters.');
      const acc = await createUser(email, password, { name, stageId: 'stage5' }, { kind: 'staff', plan: 'premium', perms: cleanPerms(b.perms) });
      return json({ staff: acc });
    }
    case 'staff.update': {
      const me = await requirePerm(request, 'admin');
      const target = toAccount(await getUserById(str(b.id, 80)));
      if (target.kind === 'admin' || target.id === me.id) throw new HttpError(403, 'The admin account cannot be changed here.');
      if (target.kind !== 'staff') throw new HttpError(400, 'Not a staff account.');
      const app: Record<string, unknown> = {};
      if (b.perms !== undefined) app.perms = cleanPerms(b.perms);
      if (typeof b.blocked === 'boolean') app.blocked = b.blocked;
      const password = typeof b.password === 'string' && b.password ? b.password : undefined;
      if (password && password.length < 8) throw new HttpError(400, 'Password must be at least 8 characters.');
      return json({ staff: await updateUser(target.id, { app, password }) });
    }
    case 'staff.remove': {
      const me = await requirePerm(request, 'admin');
      const target = toAccount(await getUserById(str(b.id, 80)));
      if (target.kind === 'admin' || target.id === me.id) throw new HttpError(403, 'The admin account cannot be removed.');
      // Demote to a normal (blocked) account rather than deleting, so nothing they published is lost.
      return json({ staff: await updateUser(target.id, { app: { kind: 'student', perms: [], blocked: true, plan: 'free', planUntil: null } }) });
    }

    // ----- publishing -----
    case 'content.publish': {
      const me = await requirePerm(request, 'content');
      const booklet = b.booklet as { id?: string; title?: string; subjectId?: string; topics?: unknown[] } | undefined;
      if (!booklet?.id || !Array.isArray(booklet.topics)) throw new HttpError(400, 'Missing booklet');
      const body = JSON.stringify(b);
      if (body.length > 8_000_000) throw new HttpError(413, 'This booklet is too large to publish.');
      const id = booklet.id.replace(/[^\w-]/g, '').slice(0, 80);
      const now = Date.now();
      await putJson(`content/booklets/${id}.json`, { booklet: { ...booklet, id }, extraMcqs: Array.isArray(b.extraMcqs) ? b.extraMcqs : [], updatedAt: now });
      const index = await getJson<PublishedIndex>('content/index.json', EMPTY_INDEX);
      const entry = { id, title: str(booklet.title, 200), subjectId: booklet.subjectId, topics: booklet.topics.length, updatedAt: now, by: me.name || me.email };
      const next: PublishedIndex = { updatedAt: now, booklets: [entry, ...index.booklets.filter((x) => x.id !== id)] };
      await putJson('content/index.json', next);
      return json({ ok: true, entry });
    }
    case 'content.unpublish': {
      await requirePerm(request, 'content');
      const id = str(b.id, 80);
      const index = await getJson<PublishedIndex>('content/index.json', EMPTY_INDEX);
      await putJson('content/index.json', { updatedAt: Date.now(), booklets: index.booklets.filter((x) => x.id !== id) });
      await removeObjects('booklit', [`content/booklets/${id}.json`]);
      return json({ ok: true });
    }
    case 'content.hide': {
      // Delete (hide) a built-in booklet for every student, or restore it.
      await requirePerm(request, 'content');
      const id = str(b.id, 120);
      const cur = await getJson<string[]>('config/hidden.json', []);
      const next = b.hidden === false ? cur.filter((x) => x !== id) : [...new Set([...cur, id])];
      await putJson('config/hidden.json', next);
      return json({ hidden: next });
    }
    case 'content.mcqs': {
      // Question-bank MCQs added to the built-in course topics.
      await requirePerm(request, 'content');
      if (!Array.isArray(b.mcqs)) throw new HttpError(400, 'Missing questions');
      const now = Date.now();
      await putJson('content/mcqs.json', { updatedAt: now, mcqs: b.mcqs });
      const index = await getJson<PublishedIndex>('content/index.json', EMPTY_INDEX);
      await putJson('content/index.json', { ...index, updatedAt: now });
      return json({ ok: true });
    }
    default:
      throw new HttpError(400, 'Unknown action');
  }
});
