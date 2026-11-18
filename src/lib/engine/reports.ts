/** Read-side accounting: stock valuation, ledger balances, Trial Balance, P&L, Balance Sheet, aging, dashboard. */
import type { Queryable } from '../db';
import { GROUP, GROUPS, groupName } from './chart';
import { addDays, daysBetween, r2, r3, sum, todayISO } from '../money';

export interface StockRow { id: string; name: string; unit: string; hsn: string; reorder: number; isService: boolean; qty: number; avg: number; value: number; saleRate: number; gstRate: number }

/** Weighted-average stock valuation as at `asOf` (inclusive). Opening quantities are taken from the item master. */
export async function stockPosition(q: Queryable, companyId: string, asOf: string): Promise<StockRow[]> {
  const items = await q.query<any>('SELECT * FROM items WHERE company_id=$1 AND is_service=false ORDER BY name', [companyId]);
  const moves = await q.query<any>(
    'SELECT item_id, qty_in, qty_out, rate, kind FROM stock_moves WHERE company_id=$1 AND date <= $2::date ORDER BY date, id', [companyId, asOf]);
  const byItem = new Map<string, any[]>();
  for (const m of moves) (byItem.get(m.item_id) ?? byItem.set(m.item_id, []).get(m.item_id)!).push(m);
  return items.map((it: any) => {
    let qty = Number(it.opening_qty) || 0;
    let value = r2(qty * (Number(it.opening_rate) || 0));
    for (const m of byItem.get(it.id) ?? []) {
      const avg = qty > 0 ? value / qty : Number(it.opening_rate) || Number(it.purchase_rate) || 0;
      if (m.kind === 'purchase') { qty += m.qty_in; value += m.qty_in * m.rate; }
      else if (m.qty_in > 0) { qty += m.qty_in; value += m.qty_in * avg; }          // sales return: back in at cost
      else { qty -= m.qty_out; value -= m.qty_out * avg; if (qty <= 1e-9) { value = qty < 0 ? value : 0; } } // issue at average cost
    }
    value = r2(value);
    return { id: it.id, name: it.name, unit: it.unit, hsn: it.hsn, reorder: Number(it.reorder_level) || 0, isService: false,
      qty: r3(qty), avg: qty > 0 ? r2(value / qty) : 0, value, saleRate: Number(it.sales_rate), gstRate: Number(it.gst_rate) };
  });
}
export const stockValue = async (q: Queryable, companyId: string, asOf: string) => sum((await stockPosition(q, companyId, asOf)).map((s) => s.value));

export interface LedgerBal {
  id: string; name: string; group: string; systemKey: string | null;
  opening: number; // signed: Dr +, Cr -  (balance brought forward at `from`)
  dr: number; cr: number; closing: number; // closing signed
  gstin: string; partyType: string | null; creditDays: number; creditLimit: number; phone: string; state: string; address: string; email: string;
}
export async function ledgerBalances(q: Queryable, companyId: string, from: string, to: string): Promise<LedgerBal[]> {
  const rows = await q.query<any>(
    `SELECT l.*,
       COALESCE(SUM(CASE WHEN e.date < $2::date THEN e.debit - e.credit END),0) AS pre,
       COALESCE(SUM(CASE WHEN e.date >= $2::date AND e.date <= $3::date THEN e.debit END),0) AS dr,
       COALESCE(SUM(CASE WHEN e.date >= $2::date AND e.date <= $3::date THEN e.credit END),0) AS cr
     FROM ledgers l LEFT JOIN ledger_entries e ON e.ledger_id = l.id AND e.date <= $3::date
     WHERE l.company_id = $1 GROUP BY l.id ORDER BY l.name`, [companyId, from, to]);
  return rows.map((l: any) => {
    const op = l.system_key === 'stock' ? 0 : (l.opening_type === 'Dr' ? 1 : -1) * Number(l.opening);
    const opening = r2(op + Number(l.pre));
    return { id: l.id, name: l.name, group: l.group_key, systemKey: l.system_key, opening, dr: r2(l.dr), cr: r2(l.cr), closing: r2(opening + Number(l.dr) - Number(l.cr)),
      gstin: l.gstin, partyType: l.party_type, creditDays: l.credit_days, creditLimit: Number(l.credit_limit), phone: l.phone, state: l.state, address: l.address, email: l.email };
  });
}

/* ------------------------------ Trial balance ------------------------------ */
export interface TbRow { name: string; group: string; debit: number; credit: number; id?: string }
export async function trialBalance(q: Queryable, companyId: string, fyStart: string, asOf: string) {
  const bals = await ledgerBalances(q, companyId, fyStart, asOf);
  const openStock = r2((await q.one<any>('SELECT COALESCE(SUM(opening_qty*opening_rate),0) AS v FROM items WHERE company_id=$1 AND is_service=false', [companyId]))?.v ?? 0);
  const rows: TbRow[] = [];
  if (openStock) rows.push({ name: 'Opening Stock', group: 'stock', debit: openStock, credit: 0 });
  for (const b of bals) {
    if (b.closing === 0) continue;
    rows.push({ id: b.id, name: b.name, group: b.group, debit: b.closing > 0 ? b.closing : 0, credit: b.closing < 0 ? -b.closing : 0 });
  }
  let debit = sum(rows.map((r) => r.debit)), credit = sum(rows.map((r) => r.credit));
  const diff = r2(debit - credit);
  if (diff) rows.push({ name: 'Difference in opening balances', group: 'suspense', debit: diff < 0 ? -diff : 0, credit: diff > 0 ? diff : 0 });
  debit = sum(rows.map((r) => r.debit)); credit = sum(rows.map((r) => r.credit));
  return { rows, debit, credit, difference: diff };
}

/* ------------------------------ P&L ------------------------------ */
export interface PlLine { name: string; amount: number; id?: string }
export async function profitAndLoss(q: Queryable, companyId: string, from: string, to: string) {
  const bals = await ledgerBalances(q, companyId, from, to);
  const pick = (keys: string[], sign: 1 | -1): PlLine[] =>
    bals.filter((b) => keys.includes(b.group) && (b.dr || b.cr)).map((b) => ({ id: b.id, name: b.name, amount: r2(sign * (b.dr - b.cr)) })).filter((l) => l.amount !== 0);
  const sales = pick(['sales'], -1), directIncome = pick(['direct_income'], -1), indirectIncome = pick(['indirect_income'], -1);
  const purchases = pick(['purchase'], 1), directExp = pick(['direct_expense'], 1), indirectExp = pick(['indirect_expense'], 1);
  const openingStock = await stockValue(q, companyId, addDays(from, -1));
  const closingStock = await stockValue(q, companyId, to);
  const tSales = sum(sales.map((l) => l.amount)), tDI = sum(directIncome.map((l) => l.amount)), tII = sum(indirectIncome.map((l) => l.amount));
  const tPur = sum(purchases.map((l) => l.amount)), tDE = sum(directExp.map((l) => l.amount)), tIE = sum(indirectExp.map((l) => l.amount));
  const grossProfit = r2(tSales + tDI + closingStock - (openingStock + tPur + tDE));
  const netProfit = r2(grossProfit + tII - tIE);
  const cogs = r2(openingStock + tPur + tDE - closingStock);
  return { from, to, sales, directIncome, indirectIncome, purchases, directExp, indirectExp, openingStock, closingStock,
    totals: { sales: tSales, directIncome: tDI, indirectIncome: tII, purchases: tPur, directExpense: tDE, indirectExpense: tIE, cogs }, grossProfit, netProfit };
}

/* ------------------------------ Balance sheet ------------------------------ */
export async function balanceSheet(q: Queryable, companyId: string, fyStart: string, asOf: string) {
  const bals = await ledgerBalances(q, companyId, fyStart, asOf);
  const pl = await profitAndLoss(q, companyId, fyStart, asOf);
  // A ledger sits on the side its balance falls on (e.g. Input GST with a debit balance is an asset, a customer with a credit balance is a liability).
  const LIAB = ['capital', 'reserves', 'loans', 'current_liab', 'duties_taxes', 'sundry_creditors'];
  const ASSET = ['fixed_assets', 'investments', 'current_assets', 'sundry_debtors', 'cash', 'bank'];
  const row = (b: (typeof bals)[number], amount: number) => ({ id: b.id, group: b.group, name: b.name, amount: r2(amount) });
  const liabilities = bals.filter((b) => b.closing !== 0 && ((LIAB.includes(b.group) && b.closing < 0) || (ASSET.includes(b.group) && b.closing < 0))).map((b) => row(b, -b.closing));
  const assets = bals.filter((b) => b.closing !== 0 && ((ASSET.includes(b.group) && b.closing > 0) || (LIAB.includes(b.group) && b.closing > 0))).map((b) => row(b, b.closing));
  // Stock-in-hand is shown at closing valuation (not at the ledger balance)
  if (pl.closingStock) assets.push({ id: 'stock', group: 'stock', name: 'Stock-in-Hand (closing)', amount: pl.closingStock });
  const tl = sum(liabilities.map((l) => l.amount)) + pl.netProfit;
  const ta = sum(assets.map((a) => a.amount));
  // Any residual means the opening balances entered do not balance (Assets should equal Liabilities + Profit).
  const difference = r2(ta - tl);
  return { asOf, liabilities, assets, netProfit: pl.netProfit, totalLiabilities: r2(tl), totalAssets: ta, difference };
}

/* ------------------------------ Ledger statement ------------------------------ */
export async function ledgerStatement(q: Queryable, companyId: string, ledgerId: string, from: string, to: string) {
  const l = await q.one<any>('SELECT * FROM ledgers WHERE id=$1 AND company_id=$2', [ledgerId, companyId]);
  if (!l) return null;
  const [b] = (await ledgerBalances(q, companyId, from, to)).filter((x) => x.id === ledgerId);
  const rows = await q.query<any>(
    `SELECT e.date, e.debit, e.credit, v.id AS voucher_id, v.number, v.type, v.narration, v.ref_no,
            (SELECT string_agg(DISTINCT l2.name, ', ') FROM ledger_entries e2 JOIN ledgers l2 ON l2.id=e2.ledger_id WHERE e2.voucher_id=v.id AND e2.ledger_id <> e.ledger_id) AS against
       FROM ledger_entries e JOIN vouchers v ON v.id=e.voucher_id
      WHERE e.ledger_id=$1 AND e.date BETWEEN $2::date AND $3::date ORDER BY e.date, e.id`, [ledgerId, from, to]);
  let run = b.opening;
  const lines = rows.map((r: any) => { run = r2(run + r.debit - r.credit); return { ...r, balance: run }; });
  return { ledger: l, opening: b.opening, lines, totalDr: b.dr, totalCr: b.cr, closing: b.closing };
}

/* ------------------------------ Outstanding & aging ------------------------------ */
export interface AgeRow { id: string; name: string; phone: string; balance: number; b0: number; b31: number; b61: number; b90: number; oldestDays: number; creditDays: number; overdue: number }
export async function outstanding(q: Queryable, companyId: string, fyStart: string, asOf: string, kind: 'receivable' | 'payable'): Promise<{ rows: AgeRow[]; totals: Record<string, number> }> {
  const group = kind === 'receivable' ? 'sundry_debtors' : 'sundry_creditors';
  const sign = kind === 'receivable' ? 1 : -1;
  const bals = (await ledgerBalances(q, companyId, fyStart, asOf)).filter((b) => b.group === group);
  const docType = kind === 'receivable' ? 'sales' : 'purchase';
  const bills = await q.query<any>(
    `SELECT party_id, date, total FROM vouchers WHERE company_id=$1 AND type=$2 AND date <= $3::date ORDER BY date DESC`, [companyId, docType, asOf]);
  const byParty = new Map<string, { date: string; total: number }[]>();
  for (const b of bills) (byParty.get(b.party_id) ?? byParty.set(b.party_id, []).get(b.party_id)!).push({ date: b.date, total: Number(b.total) });
  const rows: AgeRow[] = [];
  for (const b of bals) {
    let bal = r2(sign * b.closing);
    if (bal <= 0.005) continue;
    const row: AgeRow = { id: b.id, name: b.name, phone: b.phone, balance: bal, b0: 0, b31: 0, b61: 0, b90: 0, oldestDays: 0, creditDays: b.creditDays, overdue: 0 };
    // Allocate the balance to the newest bills first; whatever is left is the oldest (opening) amount.
    for (const bill of byParty.get(b.id) ?? []) {
      if (bal <= 0) break;
      const amt = Math.min(bal, bill.total); bal = r2(bal - amt);
      const age = daysBetween(bill.date, asOf);
      if (age <= 30) row.b0 += amt; else if (age <= 60) row.b31 += amt; else if (age <= 90) row.b61 += amt; else row.b90 += amt;
      row.oldestDays = Math.max(row.oldestDays, age);
      if (age > b.creditDays) row.overdue += amt;
    }
    if (bal > 0) { row.b90 += bal; row.oldestDays = Math.max(row.oldestDays, daysBetween(fyStart, asOf)); row.overdue += bal; }
    for (const k of ['b0', 'b31', 'b61', 'b90', 'overdue'] as const) row[k] = r2(row[k]);
    rows.push(row);
  }
  rows.sort((a, b) => b.balance - a.balance);
  const totals = { balance: sum(rows.map((r) => r.balance)), b0: sum(rows.map((r) => r.b0)), b31: sum(rows.map((r) => r.b31)), b61: sum(rows.map((r) => r.b61)), b90: sum(rows.map((r) => r.b90)), overdue: sum(rows.map((r) => r.overdue)) };
  return { rows, totals };
}

/* ------------------------------ Day book ------------------------------ */
export async function dayBook(q: Queryable, companyId: string, from: string, to: string, type?: string, search?: string) {
  const params: any[] = [companyId, from, to];
  let extra = '';
  if (type) { params.push(type); extra += ` AND v.type = $${params.length}`; }
  if (search) { params.push(`%${search}%`); extra += ` AND (v.number ILIKE $${params.length} OR p.name ILIKE $${params.length} OR v.narration ILIKE $${params.length} OR v.ref_no ILIKE $${params.length})`; }
  return q.query<any>(
    `SELECT v.id, v.type, v.number, v.date, v.total, v.taxable, v.ref_no, v.narration, v.created_by, p.name AS party
       FROM vouchers v LEFT JOIN ledgers p ON p.id = v.party_id
      WHERE v.company_id=$1 AND v.date BETWEEN $2::date AND $3::date ${extra}
      ORDER BY v.date DESC, v.created_at DESC LIMIT 1000`, params);
}

/* ------------------------------ Dashboard ------------------------------ */
export async function dashboard(q: Queryable, companyId: string, fyStart: string) {
  const today = todayISO();
  const monthStart = today.slice(0, 8) + '01';
  const one = async (sql: string, p: any[]) => (await q.one<any>(sql, p))?.v ?? 0;
  const typeSum = (t: string[], from: string) => one(`SELECT COALESCE(SUM(CASE WHEN type = ANY($2::text[]) THEN (CASE WHEN type IN ('credit_note','debit_note') THEN -total ELSE total END) END),0) AS v FROM vouchers WHERE company_id=$1 AND date BETWEEN $3::date AND $4::date`, [companyId, t, from, today]);
  const [salesToday, purchaseToday, salesMonth, purchaseMonth, salesFy] = await Promise.all([
    typeSum(['sales', 'credit_note'], today), typeSum(['purchase', 'debit_note'], today), typeSum(['sales', 'credit_note'], monthStart), typeSum(['purchase', 'debit_note'], monthStart), typeSum(['sales', 'credit_note'], fyStart),
  ]);
  const bals = await ledgerBalances(q, companyId, fyStart, today);
  const cash = sum(bals.filter((b) => b.group === 'cash').map((b) => b.closing));
  const bank = sum(bals.filter((b) => b.group === 'bank').map((b) => b.closing));
  const gstNet = sum(bals.filter((b) => b.group === 'duties_taxes').map((b) => -b.closing));
  const pl = await profitAndLoss(q, companyId, fyStart, today);
  const rec = await outstanding(q, companyId, fyStart, today, 'receivable');
  const pay = await outstanding(q, companyId, fyStart, today, 'payable');
  const stock = await stockPosition(q, companyId, today);
  const low = stock.filter((s) => s.reorder > 0 && s.qty <= s.reorder).sort((a, b) => a.qty - b.qty).slice(0, 6);
  const trend = await q.query<any>(
    `SELECT to_char(date_trunc('month', date), 'YYYY-MM') AS m,
            COALESCE(SUM(CASE WHEN type='sales' THEN taxable WHEN type='credit_note' THEN -taxable END),0) AS sales,
            COALESCE(SUM(CASE WHEN type='purchase' THEN taxable WHEN type='debit_note' THEN -taxable END),0) AS purchases
       FROM vouchers WHERE company_id=$1 AND date >= $2::date AND date <= $3::date GROUP BY 1 ORDER BY 1`, [companyId, addDays(monthStart, -170), today]);
  const topCustomers = await q.query<any>(
    `SELECT p.name, SUM(v.total) AS total FROM vouchers v JOIN ledgers p ON p.id=v.party_id WHERE v.company_id=$1 AND v.type='sales' AND v.date >= $2::date GROUP BY p.name ORDER BY total DESC LIMIT 5`, [companyId, fyStart]);
  const recent = await q.query<any>(
    `SELECT v.id, v.type, v.number, v.date, v.total, p.name AS party FROM vouchers v LEFT JOIN ledgers p ON p.id=v.party_id WHERE v.company_id=$1 ORDER BY v.created_at DESC LIMIT 7`, [companyId]);
  const pending = await one(`SELECT COUNT(*)::int AS v FROM punches WHERE company_id=$1 AND status='pending'`, [companyId]);
  return {
    salesToday, purchaseToday, salesMonth, purchaseMonth, salesFy, cash, bank, gstPayable: gstNet,
    netProfit: pl.netProfit, grossProfit: pl.grossProfit, stockValue: pl.closingStock,
    receivable: rec.totals.balance, receivableOverdue: rec.totals.overdue, payable: pay.totals.balance,
    topDebtors: rec.rows.slice(0, 5), lowStock: low, trend, topCustomers, recent, pendingPunches: pending,
    groupsUsed: GROUPS.length && groupName('sales'),
  };
}
