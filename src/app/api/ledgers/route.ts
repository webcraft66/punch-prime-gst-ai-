import { handle } from '@/lib/api';
import { requireCompany } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { audit } from '@/lib/audit';
import { saveLedger } from '@/lib/engine/masters';
import { ledgerSchema } from '@/lib/schemas';

export const POST = handle(async (req: Request) => {
  const s = await requireCompany('master.create');
  const b = ledgerSchema.parse(await req.json());
  const db = await getDb();
  const id = await saveLedger(db, s.companyId, b);
  await audit(db, s.user, 'LEDGER_CREATE', b.name, s.companyId);
  return { id };
});
