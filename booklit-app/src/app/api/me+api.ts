import {
  finalPrice,
  getJson,
  getPlans,
  handle,
  HttpError,
  json,
  newId,
  optionsHandler,
  putJson,
  requireUser,
  updateUser,
  type SubRequest,
} from '@/server/supa';

/**
 * The signed-in student.
 * GET   → { account, plans, request }  (request = their latest subscription request)
 * PATCH → update name / stage
 * POST  → { plan: 'pro' | 'premium' } request a subscription (free plans activate immediately)
 */
export const OPTIONS = optionsHandler;

async function latestRequest(userId: string) {
  return getJson<SubRequest | null>(`requests/by-user/${userId}.json`, null);
}

export const GET = handle(async (request) => {
  const account = await requireUser(request);
  const [plans, req] = await Promise.all([getPlans(), latestRequest(account.id)]);
  return json({ account, plans, request: req });
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

  const prev = await latestRequest(me.id);
  if (prev?.status === 'pending' && prev.plan === b.plan) return json({ account: me, request: prev });

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
  // A replaced pending request is marked as cancelled so the dashboard does not show it twice.
  if (prev?.status === 'pending') await putJson(`requests/all/${prev.id}.json`, { ...prev, status: 'rejected', note: 'Replaced by a new request' });
  await Promise.all([putJson(`requests/all/${req.id}.json`, req), putJson(`requests/by-user/${me.id}.json`, req)]);
  return json({ account: me, request: req });
});
