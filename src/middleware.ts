import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify, SignJWT } from 'jose';

const COOKIE = 'pp_session';
const IDLE_MINUTES = Number(process.env.IDLE_MINUTES || 30);
const PUBLIC = ['/login', '/setup', '/api/auth/login', '/api/auth/setup'];

function secret(): Uint8Array | null {
  const s = process.env.AUTH_SECRET?.trim();
  if (s) return new TextEncoder().encode(s);
  if (!process.env.DATABASE_URL) return new TextEncoder().encode('punch-prime-local-only-secret-change-me-0123456789');
  return null;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname === p)) return NextResponse.next();
  const key = secret();
  let uid: string | null = null, iat = 0;
  const tok = req.cookies.get(COOKIE)?.value;
  if (tok && key) {
    try { const { payload } = await jwtVerify(tok, key); if (typeof payload.uid === 'string') { uid = payload.uid; iat = Number(payload.iat); } } catch { /* expired */ }
  }
  if (!uid) {
    if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });
    const url = req.nextUrl.clone(); url.pathname = '/login';
    url.search = pathname !== '/' ? `?next=${encodeURIComponent(pathname + req.nextUrl.search)}` : '';
    return NextResponse.redirect(url);
  }
  const res = NextResponse.next();
  // Sliding session: while the user is active the cookie is renewed, so only IDLE_MINUTES of inactivity logs them out.
  if (key && Date.now() / 1000 - iat > 120) {
    const fresh = await new SignJWT({ uid }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime(`${IDLE_MINUTES}m`).sign(key);
    res.cookies.set(COOKIE, fresh, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: IDLE_MINUTES * 60, secure: process.env.NODE_ENV === 'production' && !!process.env.DATABASE_URL });
  }
  return res;
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
