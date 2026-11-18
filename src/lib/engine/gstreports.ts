/** GST returns: GSTR-1 (outward supplies), GSTR-3B (summary + set-off). Built from posted vouchers. */
import type { Queryable } from '../db';
import { r2, sum } from '../money';

export async function gstr1(q: Queryable, companyId: string, from: string, to: string) {
  const inv = await q.query<any>(
    `SELECT v.id, v.type, v.number, v.date, v.total, v.taxable, v.cgst, v.sgst, v.igst, v.cess, v.place_of_supply, v.intra_state, v.ref_no,
            p.name AS party, p.gstin
       FROM vouchers v JOIN ledgers p ON p.id=v.party_id
      WHERE v.company_id=$1 AND v.type IN ('sales','credit_note') AND v.date BETWEEN $2::date AND $3::date ORDER BY v.date, v.number`, [companyId, from, to]);
  const b2b = inv.filter((i: any) => i.type === 'sales' && i.gstin);
  const b2c = inv.filter((i: any) => i.type === 'sales' && !i.gstin);
  const cdnr = inv.filter((i: any) => i.type === 'credit_note' && i.gstin);
  const cdnur = inv.filter((i: any) => i.type === 'credit_note' && !i.gstin);
  // B2C summary by place of supply and rate
  const b2cRate = await q.query<any>(
    `SELECT v.place_of_supply AS pos, l.gst_rate AS rate, SUM(l.taxable) AS taxable, SUM(l.cgst) AS cgst, SUM(l.sgst) AS sgst, SUM(l.igst) AS igst, SUM(l.cess) AS cess
       FROM voucher_lines l JOIN vouchers v ON v.id=l.voucher_id JOIN ledgers p ON p.id=v.party_id
      WHERE v.company_id=$1 AND v.type='sales' AND COALESCE(p.gstin,'')='' AND v.date BETWEEN $2::date AND $3::date
      GROUP BY 1,2 ORDER BY 1,2`, [companyId, from, to]);
  const hsn = await q.query<any>(
    `SELECT l.hsn, MAX(l.unit) AS unit, MAX(l.description) AS description, l.gst_rate AS rate,
            SUM(CASE WHEN v.type='sales' THEN l.qty ELSE -l.qty END) AS qty,
            SUM(CASE WHEN v.type='sales' THEN l.taxable ELSE -l.taxable END) AS taxable,
            SUM(CASE WHEN v.type='sales' THEN l.cgst ELSE -l.cgst END) AS cgst, SUM(CASE WHEN v.type='sales' THEN l.sgst ELSE -l.sgst END) AS sgst,
            SUM(CASE WHEN v.type='sales' THEN l.igst ELSE -l.igst END) AS igst, SUM(CASE WHEN v.type='sales' THEN l.cess ELSE -l.cess END) AS cess
       FROM voucher_lines l JOIN vouchers v ON v.id=l.voucher_id
      WHERE v.company_id=$1 AND v.type IN ('sales','credit_note') AND v.date BETWEEN $2::date AND $3::date
      GROUP BY l.hsn, l.gst_rate ORDER BY l.hsn, l.gst_rate`, [companyId, from, to]);
  const tot = (xs: any[]) => ({ count: xs.length, taxable: sum(xs.map((x) => x.taxable)), cgst: sum(xs.map((x) => x.cgst)), sgst: sum(xs.map((x) => x.sgst)), igst: sum(xs.map((x) => x.igst)), cess: sum(xs.map((x) => x.cess)), total: sum(xs.map((x) => x.total ?? 0)) });
  return { from, to, b2b, b2c, b2cRate, cdnr, cdnur, hsn, totals: { b2b: tot(b2b), b2c: tot(b2c), cdnr: tot(cdnr), cdnur: tot(cdnur) } };
}

export async function gstr3b(q: Queryable, companyId: string, from: string, to: string) {
  const agg = async (types: string[]) => {
    const r = await q.one<any>(
      `SELECT COALESCE(SUM(taxable),0) taxable, COALESCE(SUM(cgst),0) cgst, COALESCE(SUM(sgst),0) sgst, COALESCE(SUM(igst),0) igst, COALESCE(SUM(cess),0) cess
         FROM vouchers WHERE company_id=$1 AND type = ANY($2::text[]) AND date BETWEEN $3::date AND $4::date`, [companyId, types, from, to]);
    return { taxable: r2(r.taxable), cgst: r2(r.cgst), sgst: r2(r.sgst), igst: r2(r.igst), cess: r2(r.cess) };
  };
  const sub = (a: any, b: any) => ({ taxable: r2(a.taxable - b.taxable), cgst: r2(a.cgst - b.cgst), sgst: r2(a.sgst - b.sgst), igst: r2(a.igst - b.igst), cess: r2(a.cess - b.cess) });
  const outward = sub(await agg(['sales']), await agg(['credit_note']));
  const itc = sub(await agg(['purchase']), await agg(['debit_note']));
  const zeroRated = await q.one<any>(
    `SELECT COALESCE(SUM(l.taxable),0) AS v FROM voucher_lines l JOIN vouchers v ON v.id=l.voucher_id WHERE v.company_id=$1 AND v.type='sales' AND l.gst_rate=0 AND v.date BETWEEN $2::date AND $3::date`, [companyId, from, to]);

  // Statutory set-off order: IGST credit -> IGST, CGST, SGST ; CGST credit -> CGST, IGST ; SGST credit -> SGST, IGST
  let { igst: li, cgst: lc, sgst: ls } = outward;
  let ci = itc.igst, cc = itc.cgst, cs = itc.sgst;
  const use = (liab: number, cred: number) => { const u = Math.min(liab, cred); return { liab: r2(liab - u), cred: r2(cred - u), used: u }; };
  let x = use(li, ci); li = x.liab; ci = x.cred;
  x = use(lc, ci); lc = x.liab; ci = x.cred;
  x = use(ls, ci); ls = x.liab; ci = x.cred;
  x = use(lc, cc); lc = x.liab; cc = x.cred;
  x = use(li, cc); li = x.liab; cc = x.cred;
  x = use(ls, cs); ls = x.liab; cs = x.cred;
  x = use(li, cs); li = x.liab; cs = x.cred;
  const cessPayable = r2(Math.max(0, outward.cess - itc.cess));
  const cashPayable = { igst: li, cgst: lc, sgst: ls, cess: cessPayable, total: r2(li + lc + ls + cessPayable) };
  const carryForward = { igst: ci, cgst: cc, sgst: cs, cess: r2(Math.max(0, itc.cess - outward.cess)) };
  return { from, to, outward, zeroRated: r2(zeroRated.v), itc, cashPayable, carryForward };
}

export const csvCell = (v: unknown): string => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export const toCsv = (rows: unknown[][]): string => rows.map((r) => r.map(csvCell).join(',')).join('\n');
