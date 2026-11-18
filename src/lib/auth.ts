import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { cookies, headers } from 'next/headers';
import { getDb } from './db';
import { audit } from './audit';
import { AppError } from './errors';
import { can, type Action } from './permissions';

export const SESSION_COOKIE = 'pp_session';
export const COMPANY_COOKIE = 'pp_company';
export const IDLE_MINUTES = Number(process.env.IDLE_MINUTES || 30);
export const MAX_FAILS = Number(process.env.MAX_LOGIN_FAILS || 5);
export const LOCK_MINUTES = Number(process.env.LOCK_MINUTES || 10);

export function authSecret(): Uint8Array {
  const s = process.env.AUTH_SECRET?.trim();
  if (s) return new TextEncoder().encode(s);
  // Local mode (embedded database, no DATABASE_URL): a built-in secret is fine because nothing is exposed to the internet.
  if (!process.env.DATABASE_URL) return new TextEncoder().encode('punch-prime-local-only-secret-change-me-0123456789');
  throw new Error('AUTH_SECRET is not set. Add a long random text as AUTH_SECRET in your hosting environment variables.');
}

export const hashPassword = (p: string) => bcrypt.hash(p, 10);
export const verifyPassword = (p: string, h: string) => bcrypt.compare(p, h);

export async function signSession(uid: string): Promise<string> {
  return new SignJWT({ uid }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime(`${IDLE_MINUTES}m`).sign(authSecret());
}
export async function readSessionToken(token: string | undefined): Promise<{ uid: string; iat: number } | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, authSecret());
    return typeof payload.uid === 'string' ? { uid: payload.uid, iat: Number(payload.iat) } : null;
  } catch { return null; }
}
export function setSessionCookie(store: ReturnType<typeof cookies>, token: string) {
  store.set(SESSION_COOKIE, token, {
    httpOnly: true, sameSite: 'lax', path: '/', maxAge: IDLE_MINUTES * 60,
    secure: process.env.NODE_ENV === 'production' && !!process.env.DATABASE_URL,
  });
}

export interface SessionUser {
  id: string; username: string; name: string; role: number; email: string; mobile: string;
}
export interface Session { user: SessionUser; companyId: string | null }

/** Current signed-in user (re-read from the database so role changes / disabling apply immediately). */
export async function getSession(): Promise<Session | null> {
  const store = cookies();
  const tok = await readSessionToken(store.get(SESSION_COOKIE)?.value);
  if (!tok) return null;
  const db = await getDb();
  const u = await db.one<any>('SELECT id, username, name, role, email, mobile, active FROM users WHERE id = $1', [tok.uid]);
  if (!u || !u.active) return null;
  const wanted = store.get(COMPANY_COOKIE)?.value || null;
  let companyId: string | null = null;
  if (wanted) {
    const c = await db.one<any>('SELECT id FROM companies WHERE id = $1', [wanted]).catch(() => null);
    companyId = c?.id ?? null;
  }
  if (!companyId) {
    const c = await db.one<any>('SELECT id FROM companies ORDER BY created_at LIMIT 1');
    companyId = c?.id ?? null;
  }
  return { user: { id: u.id, username: u.username, name: u.name, role: u.role, email: u.email, mobile: u.mobile }, companyId };
}

/** For API routes: returns the session or throws 401 / 403. */
export async function requireSession(action?: Action): Promise<Session> {
  const s = await getSession();
  if (!s) throw new AppError('Please sign in again.', 401);
  if (action && !can(s.user.role, action)) {
    const db = await getDb();
    await audit(db, s.user, 'ACCESS_DENIED', `Blocked action: ${action}`, s.companyId);
    throw new AppError('Access denied — your role does not allow this action.', 403);
  }
  return s;
}
export async function requireCompany(action?: Action): Promise<Session & { companyId: string }> {
  const s = await requireSession(action);
  if (!s.companyId) throw new AppError('Create a company first.', 400);
  return s as Session & { companyId: string };
}

export function clientIp(): string {
  try { return (headers().get('x-forwarded-for') || '').split(',')[0].trim(); } catch { return ''; }
}

export async function attemptLogin(username: string, password: string): Promise<{ ok: true; uid: string } | { ok: false; message: string }> {
  const db = await getDb();
  const uname = username.trim().toLowerCase();
  const u = await db.one<any>('SELECT * FROM users WHERE username = $1', [uname]);
  const ip = clientIp();
  const bad = 'Incorrect username or password.';
  if (!u) { await audit(db, null, 'LOGIN_FAIL', `Unknown user "${uname}"`, null, ip); return { ok: false, message: bad }; }
  if (!u.active) return { ok: false, message: 'This account has been disabled. Contact your administrator.' };
  if (u.locked_until && new Date(u.locked_until).getTime() > Date.now()) {
    const mins = Math.ceil((new Date(u.locked_until).getTime() - Date.now()) / 60000);
    return { ok: false, message: `Account locked after too many failed attempts. Try again in ${mins} minute${mins > 1 ? 's' : ''}.` };
  }
  const good = await verifyPassword(password, u.pass_hash);
  if (!good) {
    const fails = (u.fails || 0) + 1;
    if (fails >= MAX_FAILS) {
      await db.query(`UPDATE users SET fails = 0, locked_until = now() + ($2 || ' minutes')::interval WHERE id = $1`, [u.id, String(LOCK_MINUTES)]);
      await audit(db, { id: u.id, username: u.username, role: u.role }, 'LOGIN_LOCK', `Locked for ${LOCK_MINUTES} minutes`, null, ip);
      return { ok: false, message: `Too many failed attempts. Account locked for ${LOCK_MINUTES} minutes.` };
    }
    await db.query('UPDATE users SET fails = $2 WHERE id = $1', [u.id, fails]);
    await audit(db, { id: u.id, username: u.username, role: u.role }, 'LOGIN_FAIL', `Wrong password (${fails}/${MAX_FAILS})`, null, ip);
    return { ok: false, message: `${bad} ${MAX_FAILS - fails} attempt${MAX_FAILS - fails > 1 ? 's' : ''} left.` };
  }
  await db.query('UPDATE users SET fails = 0, locked_until = NULL, last_login = now(), last_seen = now() WHERE id = $1', [u.id]);
  await audit(db, { id: u.id, username: u.username, role: u.role }, 'LOGIN', 'Signed in', null, ip);
  return { ok: true, uid: u.id };
}
