import { createUser, handle, HttpError, json, optionsHandler, sbJson, sbPublic, toAccount, updateUser, requireUser } from '@/server/supa';

/**
 * Accounts: { action: 'signup' | 'login' | 'refresh' | 'password', ... }
 * Returns { session: { access, refresh, expiresAt }, account }.
 */
type Body = { action?: string; email?: string; password?: string; name?: string; stageId?: string; universityId?: string; refresh?: string; current?: string; next?: string };
type Token = { access_token: string; refresh_token: string; expires_in: number; user: Parameters<typeof toAccount>[0] };

const STAGES = ['stage1', 'stage2', 'stage3', 'stage4', 'stage5'];
const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

async function passwordLogin(email: string, password: string) {
  const res = await sbPublic('/auth/v1/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email, password }) });
  if (res.status === 400 || res.status === 401) throw new HttpError(401, 'Wrong email or password.');
  return sbJson<Token>(res);
}

function session(t: Token) {
  const account = toAccount(t.user);
  if (account.blocked) throw new HttpError(403, 'This account has been suspended. Contact the BOOKLIT team.');
  return { session: { access: t.access_token, refresh: t.refresh_token, expiresAt: Date.now() + t.expires_in * 1000 }, account };
}

export const OPTIONS = optionsHandler;

export const POST = handle(async (request) => {
  const b = (await request.json().catch(() => ({}))) as Body;
  const email = (b.email ?? '').trim().toLowerCase();
  const password = b.password ?? '';

  switch (b.action) {
    case 'signup': {
      const name = (b.name ?? '').trim().slice(0, 60);
      if (name.length < 2) throw new HttpError(400, 'Please write your full name.');
      if (!emailOk(email)) throw new HttpError(400, 'Please enter a valid email.');
      if (password.length < 8) throw new HttpError(400, 'Password must be at least 8 characters.');
      const stageId = STAGES.includes(b.stageId ?? '') ? b.stageId! : 'stage5';
      const universityId = (b.universityId ?? '').replace(/[^\w-]/g, '').slice(0, 60);
      await createUser(email, password, { name, stageId, universityId }, { kind: 'student', plan: 'free' });
      return json(session(await passwordLogin(email, password)));
    }
    case 'login': {
      if (!email || !password) throw new HttpError(400, 'Enter your email and password.');
      return json(session(await passwordLogin(email, password)));
    }
    case 'refresh': {
      if (!b.refresh) throw new HttpError(400, 'Missing refresh token');
      const res = await sbPublic('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: JSON.stringify({ refresh_token: b.refresh }) });
      if (res.status === 400 || res.status === 401) throw new HttpError(401, 'Your session has expired. Please sign in again.');
      return json(session(await sbJson<Token>(res)));
    }
    case 'password': {
      const me = await requireUser(request);
      if ((b.next ?? '').length < 8) throw new HttpError(400, 'Password must be at least 8 characters.');
      await passwordLogin(me.email, b.current ?? '').catch(() => {
        throw new HttpError(400, 'Your current password is not correct.');
      });
      await updateUser(me.id, { password: b.next });
      return json(session(await passwordLogin(me.email, b.next!)));
    }
    default:
      throw new HttpError(400, 'Unknown action');
  }
});
