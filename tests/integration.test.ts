process.env.PP_DB_MEMORY = '1';
import test from 'node:test';
import assert from 'node:assert/strict';
import { getDb } from '../src/lib/db';
import { seedDemo } from '../src/lib/demo';
import { balanceSheet, dashboard, outstanding, profitAndLoss, stockPosition, trialBalance } from '../src/lib/engine/reports';
import { gstr1, gstr3b } from '../src/lib/engine/gstreports';
import { createVoucher, deleteVoucher, updateVoucher, getVoucher } from '../src/lib/engine/vouchers';
import { todayISO, r2 } from '../src/lib/money';

const actor = { id: '00000000-0000-0000-0000-000000000001', username: 'tester', role: 1 };
let companyId = '', fyStart = '';

test('seed demo and basic integrity', async () => {
  const db = await getDb();
  companyId = await seedDemo(db, actor);
  const co = (await db.one<any>('SELECT * FROM companies WHERE id=$1', [companyId]))!;
  fyStart = co.fy_start;
  const n = (await db.one<any>('SELECT COUNT(*)::int c FROM vouchers WHERE company_id=$1', [companyId]))!.c;
  assert.ok(n > 150, `expected many vouchers, got ${n}`);
  // every voucher balances
  const bad = await db.query(`SELECT voucher_id, SUM(debit)-SUM(credit) d FROM ledger_entries WHERE company_id=$1 GROUP BY voucher_id HAVING ABS(SUM(debit)-SUM(credit)) > 0.001`, [companyId]);
  assert.equal(bad.length, 0);
  console.log('vouchers:', n);
});
test('trial balance balances and balance sheet ties out', async () => {
  const db = await getDb(); const today = todayISO();
  const tb = await trialBalance(db, companyId, fyStart, today);
  assert.equal(tb.difference, 0, 'TB difference');
  assert.equal(tb.debit, tb.credit);
  const bs = await balanceSheet(db, companyId, fyStart, today);
  assert.equal(bs.difference, 0, 'BS difference');
  const pl = await profitAndLoss(db, companyId, fyStart, today);
  console.log('P&L: sales', pl.totals.sales, 'GP', pl.grossProfit, 'NP', pl.netProfit, 'closing stock', pl.closingStock);
  assert.ok(pl.totals.sales > 0);
});
test('GST returns reconcile with ledgers', async () => {
  const db = await getDb(); const today = todayISO();
  const r1 = await gstr1(db, companyId, fyStart, today);
  const r3 = await gstr3b(db, companyId, fyStart, today);
  const outTax = r2(r3.outward.cgst + r3.outward.sgst + r3.outward.igst);
  const gst = await db.one<any>(`SELECT COALESCE(SUM(credit-debit),0) v FROM ledger_entries e JOIN ledgers l ON l.id=e.ledger_id WHERE e.company_id=$1 AND l.system_key IN ('out_cgst','out_sgst','out_igst')`, [companyId]);
  assert.equal(outTax, r2(gst.v));
  assert.ok(r1.b2b.length > 0);
  assert.ok(r3.cashPayable.total >= 0);
  console.log('3B payable', r3.cashPayable, 'carry', r3.carryForward);
});
test('stock, edit, delete and locks', async () => {
  const db = await getDb(); const today = todayISO(); const ctx = { companyId, actor };
  const stock = await stockPosition(db, companyId, today);
  assert.ok(stock.every((s) => s.qty >= -0.0001), 'no negative stock');
  const it = stock[0]; const cust = (await db.one<any>(`SELECT id FROM ledgers WHERE company_id=$1 AND group_key='sundry_debtors' LIMIT 1`, [companyId]))!.id;
  await assert.rejects(createVoucher(db, ctx, { type: 'sales', date: today, partyId: cust, lines: [{ itemId: it.id, qty: it.qty + 1000, rate: 100, gstRate: 5 }] }), /Not enough stock/);
  const v = await createVoucher(db, ctx, { type: 'sales', date: today, partyId: cust, lines: [{ itemId: it.id, qty: 1, rate: 1000, gstRate: 18 }] });
  const g = await getVoucher(db, companyId, v.id);
  assert.equal(g.total, 1180);
  await updateVoucher(db, ctx, v.id, { type: 'sales', date: today, partyId: cust, lines: [{ itemId: it.id, qty: 2, rate: 1000, gstRate: 18 }] });
  assert.equal((await getVoucher(db, companyId, v.id)).total, 2360);
  const after = (await stockPosition(db, companyId, today)).find((s) => s.id === it.id)!;
  assert.equal(r2(after.qty), r2(it.qty - 2));
  await db.query('INSERT INTO data_locks (company_id,from_date,to_date) VALUES ($1,$2,$3)', [companyId, today, today]);
  await assert.rejects(deleteVoucher(db, ctx, v.id), /locked/i);
  await db.query('DELETE FROM data_locks WHERE company_id=$1', [companyId]);
  await deleteVoucher(db, ctx, v.id);
  assert.equal((await stockPosition(db, companyId, today)).find((s) => s.id === it.id)!.qty, it.qty);
});
test('aging and dashboard', async () => {
  const db = await getDb(); const today = todayISO();
  const rec = await outstanding(db, companyId, fyStart, today, 'receivable');
  assert.ok(rec.totals.balance > 0);
  assert.equal(r2(rec.totals.b0 + rec.totals.b31 + rec.totals.b61 + rec.totals.b90), rec.totals.balance);
  const d = await dashboard(db, companyId, fyStart);
  console.log('dash', { salesMonth: d.salesMonth, cash: d.cash, bank: d.bank, receivable: d.receivable, payable: d.payable, gst: d.gstPayable, stock: d.stockValue });
  assert.ok(d.trend.length >= 3);
});
