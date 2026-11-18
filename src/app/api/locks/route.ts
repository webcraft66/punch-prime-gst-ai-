import { z } from 'zod';
import { handle } from '@/lib/api';
import { requireCompany } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { audit } from '@/lib/audit';
import { AppError } from '@/lib/errors';

export const POST = handle(async (req: Request) => {
  const s = await requireCompany('datalock.manage');
  const b = z.object({ from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), note: z.string().max(120).optional().default('') }).parse(await req.json());
  if (b.to < b.from) throw new AppError('"To" date must be after "From" date.');
  const db = await getDb();
  await db.query('INSERT INTO data_locks (company_id,from_date,to_date,note,created_by) VALUES ($1,$2,$3,$4,$5)', [s.companyId, b.from, b.to, b.note, s.user.username]);
  await audit(db, s.user, 'LOCK_ADD', `${b.from} to ${b.to}`, s.companyId);
  return { ok: true };
});
export const DELETE = handle(async (req: Request) => {
  const s = await requireCompany('datalock.manage');
  const id = new URL(req.url).searchParams.get('id') ?? '';
  const db = await getDb();
  const r = await db.query('DELETE FROM data_locks WHERE id=$1 AND company_id=$2 RETURNING from_date,to_date', [id, s.companyId]);
  if (!r.length) throw new AppError('Lock not found.', 404);
  await audit(db, s.user, 'LOCK_REMOVE', `${r[0].from_date} to ${r[0].to_date}`, s.companyId);
  return { ok: true };
});
