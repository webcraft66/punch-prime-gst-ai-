import { z } from 'zod';
import { handle } from '@/lib/api';
import { hashPassword, requireSession } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { audit } from '@/lib/audit';
import { AppError } from '@/lib/errors';
import { passwordPolicy } from '@/lib/permissions';

async function guardOwner(db: any, id: string, selfId: string, becomesNonOwner: boolean) {
  if (!becomesNonOwner) return;
  if (id === selfId) throw new AppError('You cannot remove your own Owner access, disable or delete yourself.');
  const u = await db.one('SELECT role FROM users WHERE id=$1', [id]);
  if (u?.role === 1) { const n = await db.one(`SELECT COUNT(*)::int c FROM users WHERE role=1 AND active`); if (n.c <= 1) throw new AppError('At least one active Owner is required.'); }
}
export const PATCH = handle(async (req: Request, { params }: { params: { id: string } }) => {
  const s = await requireSession('user.manage');
  const b = z.object({ role: z.coerce.number().int().min(1).max(4).optional(), active: z.boolean().optional(), name: z.string().min(2).max(80).optional(), password: z.string().optional() }).parse(await req.json());
  const db = await getDb();
  const u = await db.one<any>('SELECT * FROM users WHERE id=$1', [params.id]);
  if (!u) throw new AppError('User not found.', 404);
  if ((b.role !== undefined && b.role !== 1) || b.active === false) await guardOwner(db, params.id, s.user.id, true);
  if (b.password) { const bad = passwordPolicy(b.password); if (bad) throw new AppError(bad); await db.query('UPDATE users SET pass_hash=$2, fails=0, locked_until=NULL WHERE id=$1', [params.id, await hashPassword(b.password)]); await audit(db, s.user, 'USER_RESET_PW', u.username, s.companyId); }
  if (b.role !== undefined) { await db.query('UPDATE users SET role=$2 WHERE id=$1', [params.id, b.role]); await audit(db, s.user, 'USER_ROLE', `${u.username} → ${b.role}`, s.companyId); }
  if (b.active !== undefined) { await db.query('UPDATE users SET active=$2, fails=0, locked_until=NULL WHERE id=$1', [params.id, b.active]); await audit(db, s.user, b.active ? 'USER_ENABLE' : 'USER_DISABLE', u.username, s.companyId); }
  if (b.name) await db.query('UPDATE users SET name=$2 WHERE id=$1', [params.id, b.name.trim()]);
  return { ok: true };
});
export const DELETE = handle(async (_r: Request, { params }: { params: { id: string } }) => {
  const s = await requireSession('user.manage');
  const db = await getDb();
  await guardOwner(db, params.id, s.user.id, true);
  const u = await db.one<any>('DELETE FROM users WHERE id=$1 RETURNING username', [params.id]);
  if (!u) throw new AppError('User not found.', 404);
  await audit(db, s.user, 'USER_DELETE', u.username, s.companyId);
  return { ok: true };
});
