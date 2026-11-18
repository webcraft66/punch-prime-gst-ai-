import { handle } from '@/lib/api';
import { requireCompany } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { audit } from '@/lib/audit';
import { AppError } from '@/lib/errors';

export const POST = handle(async (req: Request, { params }: { params: { id: string } }) => {
  const s = await requireCompany('punch.review');
  const db = await getDb();
  const reason = String((await req.json().catch(() => ({}))).reason ?? '').slice(0, 200);
  const r = await db.query(`UPDATE punches SET status='rejected', note=$3, reviewed_by=$4, reviewed_at=now() WHERE id=$1 AND company_id=$2 AND status='pending' RETURNING seq`, [params.id, s.companyId, reason, s.user.username]);
  if (!r.length) throw new AppError('Only pending bills can be rejected.', 409);
  await audit(db, s.user, 'PUNCH_REJECT', `#${r[0].seq} ${reason}`, s.companyId);
  return { ok: true };
});
