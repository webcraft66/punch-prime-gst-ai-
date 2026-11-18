import { cookies } from 'next/headers';
import { handle } from '@/lib/api';
import { COMPANY_COOKIE, requireSession } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { seedDemo } from '@/lib/demo';
import { audit } from '@/lib/audit';

export const maxDuration = 60;
export const POST = handle(async () => {
  const s = await requireSession('company.create');
  const db = await getDb();
  const id = await seedDemo(db, s.user, s.user.name);
  cookies().set(COMPANY_COOKIE, id, { path: '/', httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 365 });
  await audit(db, s.user, 'DEMO', 'Loaded demo company', id);
  return { ok: true, id };
});
