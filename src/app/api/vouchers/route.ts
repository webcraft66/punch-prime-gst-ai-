import { handle } from '@/lib/api';
import { requireCompany } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { canCreateVoucher } from '@/lib/permissions';
import { createVoucher } from '@/lib/engine/vouchers';
import { voucherSchema } from '@/lib/schemas';
import { audit } from '@/lib/audit';

export const POST = handle(async (req: Request) => {
  const s = await requireCompany();
  const v = voucherSchema.parse(await req.json());
  const db = await getDb();
  if (!canCreateVoucher(s.user.role, v.type)) {
    await audit(db, s.user, 'ACCESS_DENIED', `Blocked: create ${v.type}`, s.companyId);
    throw new AppError('Access denied — your role cannot create this type of voucher.', 403);
  }
  return createVoucher(db, { companyId: s.companyId, actor: s.user }, v);
});
