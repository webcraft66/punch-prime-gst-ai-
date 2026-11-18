import { requireCompany } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { handle } from '@/lib/api';
import { AppError } from '@/lib/errors';
import { gstr1, toCsv } from '@/lib/engine/gstreports';
import { ledgerStatement, stockPosition, trialBalance } from '@/lib/engine/reports';
import { todayISO } from '@/lib/money';

const iso = (v: string | null, d: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : d);
export const dynamic = 'force-dynamic';
export const GET = handle(async (req: Request, { params }: { params: { name: string } }) => {
  const s = await requireCompany('report.view');
  const db = await getDb(); const u = new URL(req.url);
  const co = (await db.one<any>('SELECT * FROM companies WHERE id=$1', [s.companyId]))!;
  const from = iso(u.searchParams.get('from'), co.fy_start), to = iso(u.searchParams.get('to'), todayISO());
  let rows: unknown[][] = [];
  if (params.name === 'tb') { const t = await trialBalance(db, s.companyId, co.fy_start, to); rows = [['Account', 'Debit', 'Credit'], ...t.rows.map((r) => [r.name, r.debit || '', r.credit || '']), ['Total', t.debit, t.credit]]; }
  else if (params.name === 'stock') rows = [['Item', 'HSN', 'Unit', 'Quantity', 'Avg cost', 'Value'], ...(await stockPosition(db, s.companyId, to)).map((r) => [r.name, r.hsn, r.unit, r.qty, r.avg, r.value])];
  else if (params.name === 'ledger') {
    const st = await ledgerStatement(db, s.companyId, u.searchParams.get('id') ?? '', from, to); if (!st) throw new AppError('Ledger not found.', 404);
    rows = [['Date', 'Voucher', 'Type', 'Against', 'Debit', 'Credit', 'Balance'], ['', 'Opening', '', '', '', '', st.opening], ...st.lines.map((r: any) => [r.date, r.number, r.type, r.against, r.debit || '', r.credit || '', r.balance])];
  } else if (params.name === 'gstr1') {
    const g = await gstr1(db, s.companyId, from, to);
    rows = [['Section', 'Invoice', 'Date', 'Party', 'GSTIN', 'Place of supply', 'Taxable', 'IGST', 'CGST', 'SGST', 'Cess', 'Total'],
      ...([['B2B', g.b2b], ['B2C', g.b2c], ['CDNR', g.cdnr], ['CDNUR', g.cdnur]] as const).flatMap(([sec, list]) => list.map((i: any) => [sec, i.number, i.date, i.party, i.gstin, i.place_of_supply, i.taxable, i.igst, i.cgst, i.sgst, i.cess, i.total])),
      [], ['HSN', 'Description', 'Unit', 'Qty', 'Rate', 'Taxable', 'IGST', 'CGST', 'SGST'], ...g.hsn.map((h: any) => [h.hsn, h.description, h.unit, h.qty, h.rate, h.taxable, h.igst, h.cgst, h.sgst])];
  } else throw new AppError('Unknown export.', 404);
  return new Response('﻿' + toCsv(rows), { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="${params.name}-${from}-${to}.csv"` } });
});
