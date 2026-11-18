import { handle } from '@/lib/api';
import { requireCompany } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { audit } from '@/lib/audit';
import { deleteLedger, saveLedger } from '@/lib/engine/masters';
import { ledgerSchema } from '@/lib/schemas';

export const PUT = handle(async (req: Request, { params }: { params: { id: string } }) => {
  const s = await requireCompany('master.edit');
  const b = ledgerSchema.parse(await req.json());
  const db = await getDb();
  await saveLedger(db, s.companyId, b, params.id);
  await audit(db, s.user, 'LEDGER_EDIT', b.name, s.companyId);
  return { id: params.id };
});
export const DELETE = handle(async (_r: Request, { params }: { params: { id: string } }) => {
  const s = await requireCompany('master.delete');
  const db = await getDb();
  const name = await deleteLedger(db, s.companyId, params.id);
  await audit(db, s.user, 'LEDGER_DELETE', name, s.companyId);
  return { ok: true };
});
