import { cookies } from 'next/headers';
import { z } from 'zod';
import { handle } from '@/lib/api';
import { COMPANY_COOKIE, requireSession } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { audit } from '@/lib/audit';
import { AppError } from '@/lib/errors';
import { createCompany } from '@/lib/engine/company';
import { stateCode, stateName, validateGstin, validatePan } from '@/lib/gst';

const schema = z.object({
  name: z.string().min(2).max(100), ownerName: z.string().max(80).optional().default(''), state: z.string(), address: z.string().max(300).optional().default(''), pincode: z.string().max(6).optional().default(''),
  gstin: z.string().max(15).optional().default(''), pan: z.string().max(10).optional().default(''), phone: z.string().max(20).optional().default(''), email: z.string().max(100).optional().default(''),
  fyStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), bankName: z.string().max(80).optional().default(''), bankAccount: z.string().max(30).optional().default(''), bankIfsc: z.string().max(15).optional().default(''), upi: z.string().max(60).optional().default(''),
  allowNegativeStock: z.boolean().optional(),
});
function check(b: z.infer<typeof schema>) {
  if (b.gstin) { const g = validateGstin(b.gstin); if (!g.ok) throw new AppError(`GSTIN: ${g.message}`); }
  if (b.pan && !validatePan(b.pan)) throw new AppError('PAN format is invalid (example: ABCDE1234F).');
  if (!stateCode(b.state)) throw new AppError('Choose a valid state.');
}
export const POST = handle(async (req: Request) => {
  const s = await requireSession('company.create');
  const b = schema.parse(await req.json()); check(b);
  const db = await getDb();
  const id = await db.tx((q) => createCompany(q, { ...b, gstin: b.gstin.toUpperCase(), pan: (b.pan || (b.gstin ? b.gstin.slice(2, 12) : '')).toUpperCase() }));
  await audit(db, s.user, 'COMPANY_CREATE', b.name, id);
  cookies().set(COMPANY_COOKIE, id, { path: '/', httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 365 });
  return { id };
});
export const PUT = handle(async (req: Request) => {
  const s = await requireSession('company.edit');
  if (!s.companyId) throw new AppError('No company selected.');
  const b = schema.parse(await req.json()); check(b);
  const db = await getDb();
  await db.query(`UPDATE companies SET name=$2,state=$3,state_code=$4,address=$5,pincode=$6,gstin=$7,pan=$8,phone=$9,email=$10,bank_name=$11,bank_account=$12,bank_ifsc=$13,upi=$14,allow_negative_stock=COALESCE($15,allow_negative_stock),owner_name=$16 WHERE id=$1`,
    [s.companyId, b.name.trim(), stateName(stateCode(b.state)), stateCode(b.state), b.address, b.pincode, b.gstin.toUpperCase(), b.pan.toUpperCase(), b.phone, b.email, b.bankName, b.bankAccount, b.bankIfsc, b.upi, b.allowNegativeStock ?? null, b.ownerName.trim()]);
  await audit(db, s.user, 'COMPANY_EDIT', b.name, s.companyId);
  return { ok: true };
});
