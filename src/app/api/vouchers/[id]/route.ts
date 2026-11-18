import { handle } from '@/lib/api';
import { requireCompany } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { deleteVoucher, updateVoucher } from '@/lib/engine/vouchers';
import { voucherSchema } from '@/lib/schemas';

export const PUT = handle(async (req: Request, { params }: { params: { id: string } }) => {
  const s = await requireCompany('voucher.edit');
  return updateVoucher(await getDb(), { companyId: s.companyId, actor: s.user }, params.id, voucherSchema.parse(await req.json()));
});
export const DELETE = handle(async (_req: Request, { params }: { params: { id: string } }) => {
  const s = await requireCompany('voucher.delete');
  await deleteVoucher(await getDb(), { companyId: s.companyId, actor: s.user }, params.id);
  return { ok: true };
});
