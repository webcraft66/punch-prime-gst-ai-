import test from 'node:test';
import assert from 'node:assert/strict';
import { computeVoucher } from '../src/lib/engine/vouchers';
import { validateGstin, gstinCheckChar, calcLine } from '../src/lib/gst';
import { amountInWords, fyLabel } from '../src/lib/money';

const sys: Record<string, string> = {};
for (const k of ['sales','purchase','sales_return','purchase_return','out_cgst','out_sgst','out_igst','out_cess','in_cgst','in_sgst','in_igst','in_cess','round_off']) sys[k] = 'sys_' + k;
const ctx = { companyStateCode: '10', partyStateCode: '10', sys };
const bal = (e: { debit: number; credit: number }[]) => Math.round(e.reduce((a, x) => a + x.debit - x.credit, 0) * 100) / 100 + 0;

test('intra-state sales: CGST+SGST, balanced, rounded', () => {
  const c = computeVoucher({ type: 'sales', date: '2026-05-01', partyId: 'cust', lines: [{ qty: 3, rate: 333.33, gstRate: 18 }] }, ctx);
  assert.equal(c.intra, true);
  assert.equal(c.igst, 0);
  assert.equal(c.cgst, c.sgst);
  assert.equal(bal(c.entries), 0);
  assert.equal(c.total, Math.round(c.taxable + c.cgst + c.sgst));
  assert.equal(c.entries.find((e) => e.ledgerId === 'cust')!.debit, c.total);
});
test('inter-state purchase: IGST only, party credited', () => {
  const c = computeVoucher({ type: 'purchase', date: '2026-05-01', partyId: 'sup', placeOfSupply: '27', lines: [{ qty: 10, rate: 100, discountPct: 10, gstRate: 12 }] }, ctx);
  assert.equal(c.intra, false);
  assert.equal(c.taxable, 900);
  assert.equal(c.igst, 108);
  assert.equal(c.cgst + c.sgst, 0);
  assert.equal(bal(c.entries), 0);
  assert.equal(c.entries.find((e) => e.ledgerId === 'sup')!.credit, 1008);
});
test('credit & debit notes balance', () => {
  for (const type of ['credit_note', 'debit_note'] as const) {
    const c = computeVoucher({ type, date: '2026-05-01', partyId: 'p', lines: [{ qty: 1, rate: 99.99, gstRate: 5 }] }, ctx);
    assert.equal(bal(c.entries), 0, type);
  }
});
test('receipt / payment / contra / journal', () => {
  assert.equal(bal(computeVoucher({ type: 'receipt', date: '2026-05-01', partyId: 'c', accountId: 'bank', amount: 500 }, ctx).entries), 0);
  assert.equal(bal(computeVoucher({ type: 'payment', date: '2026-05-01', partyId: 's', accountId: 'cash', amount: 500 }, ctx).entries), 0);
  assert.equal(bal(computeVoucher({ type: 'contra', date: '2026-05-01', partyId: 'bank', accountId: 'cash', amount: 500 }, ctx).entries), 0);
  assert.throws(() => computeVoucher({ type: 'journal', date: '2026-05-01', journal: [{ ledgerId: 'a', debit: 100, credit: 0 }, { ledgerId: 'b', debit: 0, credit: 90 }] }, ctx), /balance/);
});
test('validation errors', () => {
  assert.throws(() => computeVoucher({ type: 'sales', date: '2026-05-01', lines: [{ qty: 1, rate: 1, gstRate: 5 }] }, ctx), /customer/i);
  assert.throws(() => computeVoucher({ type: 'sales', date: '2026-05-01', partyId: 'x', lines: [{ qty: 0, rate: 1, gstRate: 5 }] }, ctx), /quantity/i);
});
test('GSTIN checksum', () => {
  const base = '10AABCU9603R1Z';
  const g = base + gstinCheckChar(base);
  assert.equal(validateGstin(g).ok, true);
  assert.equal(validateGstin(g.slice(0, 14) + (g[14] === 'A' ? 'B' : 'A')).ok, false);
  assert.equal(validateGstin('123').ok, false);
});
test('misc helpers', () => {
  assert.equal(amountInWords(1234.5), 'Rupees One Thousand Two Hundred Thirty Four and Fifty Paise Only');
  assert.equal(amountInWords(12500000), 'Rupees One Crore Twenty Five Lakh Only');
  assert.equal(fyLabel('2026-03-31'), '2025-26');
  assert.equal(fyLabel('2026-04-01'), '2026-27');
  assert.deepEqual(calcLine({ qty: 2, rate: 50, gstRate: 18 }, true), { taxable: 100, cgst: 9, sgst: 9, igst: 0, cess: 0, amount: 118 });
});
