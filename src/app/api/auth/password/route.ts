import { z } from 'zod';
import { handle } from '@/lib/api';
import { hashPassword, requireSession, verifyPassword } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { audit } from '@/lib/audit';
import { AppError } from '@/lib/errors';
import { passwordPolicy } from '@/lib/permissions';

export const POST = handle(async (req: Request) => {
  const s = await requireSession();
  const b = z.object({ current: z.string(), next: z.string() }).parse(await req.json());
  const db = await getDb();
  const u = await db.one<any>('SELECT pass_hash FROM users WHERE id=$1', [s.user.id]);
  if (!u || !(await verifyPassword(b.current, u.pass_hash))) throw new AppError('Your current password is incorrect.');
  const bad = passwordPolicy(b.next); if (bad) throw new AppError(bad);
  await db.query('UPDATE users SET pass_hash=$2 WHERE id=$1', [s.user.id, await hashPassword(b.next)]);
  await audit(db, s.user, 'PASSWORD', 'Changed own password', s.companyId);
  return { ok: true };
});
