import { z } from 'zod';
import { handle } from '@/lib/api';
import { requireCompany } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { audit } from '@/lib/audit';
import { AppError } from '@/lib/errors';
import { createVoucher } from '@/lib/engine/vouchers';
import { saveItem, saveLedger } from '@/lib/engine/masters';
import { validateGstin } from '@/lib/gst';

const schema = z.object({
  sellerName: z.string().min(2).max(120), sellerGstin: z.string().max(15).optional().default(''), invoiceNo: z.string().min(1).max(60), invoiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  items: z.array(z.object({ name: z.string().min(1).max(150), qty: z.coerce.number().positive(), rate: z.coerce.number().min(0), hsn: z.string().max(10).optional().default(''), gstRate: z.coerce.number().min(0).max(100) })).min(1),
  total: z.coerce.number().optional().default(0),
});
export const POST = handle(async (req: Request, { params }: { params: { id: string } }) => {
  const s = await requireCompany('punch.review');
  const b = schema.parse(await req.json());
  const db = await getDb();
  const p = await db.one<any>('SELECT * FROM punches WHERE id=$1 AND company_id=$2', [params.id, s.companyId]);
  if (!p) throw new AppError('Punch not found.', 404);
  if (p.status === 'approved') throw new AppError('This bill is already posted.', 409);
  const gstin = b.sellerGstin.trim().toUpperCase();
  if (gstin) { const g = validateGstin(gstin); if (!g.ok) throw new AppError(`Supplier GSTIN: ${g.message}`); }
  // match / create supplier
  let sup = gstin ? await db.one<any>(`SELECT id FROM ledgers WHERE company_id=$1 AND gstin=$2 AND group_key='sundry_creditors'`, [s.companyId, gstin]) : null;
  sup ??= await db.one<any>(`SELECT id FROM ledgers WHERE company_id=$1 AND lower(name)=lower($2) AND group_key='sundry_creditors'`, [s.companyId, b.sellerName.trim()]);
  const supplierId: string = sup?.id ?? (await saveLedger(db, s.companyId, { name: b.sellerName, group: 'sundry_creditors', gstin, stateCode: gstin ? undefined : (await db.one<any>('SELECT state_code FROM companies WHERE id=$1', [s.companyId]))!.state_code }));
  // match / create items
  const lines = [];
  for (const it of b.items) {
    let row = await db.one<any>('SELECT id FROM items WHERE company_id=$1 AND lower(name)=lower($2)', [s.companyId, it.name.trim()]);
    const itemId = row?.id ?? (await saveItem(db, s.companyId, { name: it.name, hsn: it.hsn, gstRate: it.gstRate, purchaseRate: it.rate, salesRate: Math.round(it.rate * 1.2) }));
    lines.push({ itemId, qty: it.qty, rate: it.rate, gstRate: it.gstRate, hsn: it.hsn });
  }
  const v = await createVoucher(db, { companyId: s.companyId, actor: s.user }, { type: 'purchase', date: b.invoiceDate, partyId: supplierId, refNo: b.invoiceNo, narration: `AI Punch #${p.seq}`, lines, punchId: p.id });
  await db.query(`UPDATE punches SET status='approved', voucher_id=$2, data=$3, reviewed_by=$4, reviewed_at=now() WHERE id=$1`, [p.id, v.id, JSON.stringify(b), s.user.username]);
  await audit(db, s.user, 'PUNCH_APPROVE', `#${p.seq} → ${v.number}`, s.companyId);
  return { voucherId: v.id, number: v.number };
});
