import { cookies } from 'next/headers';
import { handle } from '@/lib/api';
import { getSession, SESSION_COOKIE } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { audit } from '@/lib/audit';

export const POST = handle(async () => {
  const s = await getSession();
  if (s) await audit(await getDb(), s.user, 'LOGOUT', 'Signed out', s.companyId);
  cookies().delete(SESSION_COOKIE);
  return { ok: true };
});
