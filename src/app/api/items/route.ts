import { handle } from '@/lib/api';
import { requireCompany } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { audit } from '@/lib/audit';
import { saveItem } from '@/lib/engine/masters';
import { itemSchema } from '@/lib/schemas';

export const POST = handle(async (req: Request) => {
  const s = await requireCompany('master.create');
  const b = itemSchema.parse(await req.json());
  const db = await getDb();
  const id = await saveItem(db, s.companyId, b);
  await audit(db, s.user, 'ITEM_CREATE', b.name, s.companyId);
  return { id };
});
