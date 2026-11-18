import { handle } from '@/lib/api';
import { requireCompany } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { audit } from '@/lib/audit';

/** Full export of the active company's data as JSON (for safekeeping / migration). */
export const dynamic = 'force-dynamic';
export const GET = handle(async () => {
  const s = await requireCompany('backup');
  const db = await getDb(); const c = s.companyId;
  const t = (sql: string) => db.query(sql, [c]);
  const data = {
    app: 'punch-prime', version: 2, exportedAt: new Date().toISOString(), exportedBy: s.user.username,
    company: (await t('SELECT * FROM companies WHERE id=$1'))[0], ledgers: await t('SELECT * FROM ledgers WHERE company_id=$1'), items: await t('SELECT * FROM items WHERE company_id=$1'),
    vouchers: await t('SELECT * FROM vouchers WHERE company_id=$1 ORDER BY date,number'),
    voucherLines: await t('SELECT l.* FROM voucher_lines l JOIN vouchers v ON v.id=l.voucher_id WHERE v.company_id=$1'),
    ledgerEntries: await t('SELECT * FROM ledger_entries WHERE company_id=$1'), stockMoves: await t('SELECT * FROM stock_moves WHERE company_id=$1'), dataLocks: await t('SELECT * FROM data_locks WHERE company_id=$1'),
  };
  await audit(db, s.user, 'BACKUP', 'Downloaded JSON backup', c);
  return new Response(JSON.stringify(data, null, 1), { headers: { 'content-type': 'application/json', 'content-disposition': `attachment; filename="punch-prime-backup-${new Date().toISOString().slice(0, 10)}.json"` } });
});
