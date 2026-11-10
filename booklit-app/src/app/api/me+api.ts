import {
  finalPrice,
  getPlans,
  handle,
  HttpError,
  json,
  newId,
  optionsHandler,
  requireUser,
  updateUser,
  type SubRequest,
} from '@/server/supa';
import { countUser } from '@/server/usage';

/**
 * The signed-in student.
 * GET   → { account, plans, request }  (request = their latest subscription request)
 * PATCH → update name / stage
 * POST  → { plan: 'pro' | 'premium' } request a subscription (free plans activate immediately)
 */
export const OPTIONS = optionsHandler;

export const GET = handle(async (request) => {
  const account = await requireUser(request);
  await countUser(account.id, request.headers.get('x-platform'));
  return json({ account, plans: await getPlans(), request: account.request });
});

export const PATCH = handle(async (request) => {
  const me = await requireUser(request);
  const b = (await request.json().catch(() => ({}))) as { name?: string; stageId?: string };
  const meta: Record<string, string> = {};
  if (b.name !== undefined) {
    const name = b.name.trim().slice(0, 60);
    if (name.length < 2) throw new HttpError(400, 'Please write your full name.');
    meta.name = name;
  }
  if (b.stageId && /^stage[1-5]$/.test(b.stageId)) meta.stageId = b.stageId;
  return json({ account: await updateUser(me.id, { meta }) });
});

export const POST = handle(async (request) => {
  const me = await requireUser(request);
  const b = (await request.json().catch(() => ({}))) as { plan?: string };
  if (b.plan !== 'pro' && b.plan !== 'premium') throw new HttpError(400, 'Choose a plan.');
  const plans = await getPlans();
  const price = finalPrice(plans, b.plan);
  const now = new Date();

  // Free plan (set by the admin): activate straight away.
  if (price === 0) {
    const until = new Date(now.getTime() + plans.plans[b.plan].days * 86400000).toISOString();
    const account = await updateUser(me.id, { app: { plan: b.plan, planUntil: until } });
    return json({ account, request: null, activated: true });
  }

  const prev = me.request;
  if (prev?.status === 'pending' && prev.plan === b.plan) return json({ account: me, request: prev });

  // The request lives on the student's own account: no clashes, and the admin reads all of them in one call.
  const req: SubRequest = {
    id: `${now.getTime()}-${newId()}`,
    userId: me.id,
    name: me.name,
    email: me.email,
    stageId: me.stageId,
    plan: b.plan,
    price,
    status: 'pending',
    createdAt: now.toISOString(),
  };
  const account = await updateUser(me.id, { app: { request: req } });
  return json({ account, request: req });
});
