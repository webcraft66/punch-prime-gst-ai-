/**
 * Voucher engine: validation, GST calculation, double-entry posting and stock movements.
 * `computeVoucher` is a pure function (unit-tested). The create/update/delete functions persist inside a DB transaction.
 */
import type { Db, Queryable } from '../db';
import { AppError } from '../errors';
import { audit, type Actor } from '../audit';
import { calcLine } from '../gst';
import { fyLabel, isISO, r2, r3, sum } from '../money';
import { VOUCHER_PREFIX, VOUCHER_TYPES, ITEM_TYPES, type VoucherType } from './chart';
import { systemLedgerIds } from './company';

export interface LineIn {
  itemId?: string | null; description?: string; hsn?: string; unit?: string;
  qty: number; rate: number; discountPct?: number; gstRate: number; cessRate?: number;
}
export interface JournalLineIn { ledgerId: string; debit: number; credit: number; narration?: string }
export interface VoucherIn {
  type: VoucherType; date: string;
  /** Customer / supplier (item vouchers) or the other ledger (receipt, payment). Contra: the ledger money goes TO. */
  partyId?: string | null;
  /** Cash/bank ledger (receipt, payment) or the ledger money comes FROM (contra). */
  accountId?: string | null;
  amount?: number;
  refNo?: string; refDate?: string | null; narration?: string;
  placeOfSupply?: string; // 2-digit state code; defaults to the party's state
  lines?: LineIn[]; journal?: JournalLineIn[];
  punchId?: string | null;
}
export interface Entry { ledgerId: string; debit: number; credit: number }
export interface ComputedLine extends LineIn { taxable: number; cgst: number; sgst: number; igst: number; cess: number; amount: number }
export interface Computed {
  intra: boolean; placeOfSupply: string;
  lines: ComputedLine[];
  taxable: number; cgst: number; sgst: number; igst: number; cess: number; roundOff: number; total: number;
  entries: Entry[];
}
export interface ComputeCtx {
  companyStateCode: string;
  partyStateCode: string;
  sys: Record<string, string>; // system ledger ids
}

function mergeEntries(entries: Entry[]): Entry[] {
  const m = new Map<string, Entry>();
  for (const e of entries) {
    if (!e.debit && !e.credit) continue;
    const cur = m.get(e.ledgerId) ?? { ledgerId: e.ledgerId, debit: 0, credit: 0 };
    cur.debit = r2(cur.debit + e.debit); cur.credit = r2(cur.credit + e.credit);
    m.set(e.ledgerId, cur);
  }
  return [...m.values()];
}

/** Pure calculation of totals and ledger postings for any voucher type. Throws AppError when invalid. */
export function computeVoucher(v: VoucherIn, ctx: ComputeCtx): Computed {
  const blank = { intra: true, placeOfSupply: ctx.companyStateCode, lines: [], taxable: 0, cgst: 0, sgst: 0, igst: 0, cess: 0, roundOff: 0 };
  const sys = (k: string) => { const id = ctx.sys[k]; if (!id) throw new AppError(`System ledger "${k}" is missing.`, 500); return id; };

  if (ITEM_TYPES.includes(v.type)) {
    if (!v.partyId) throw new AppError(v.type === 'sales' || v.type === 'credit_note' ? 'Select a customer.' : 'Select a supplier.');
    if (!v.lines?.length) throw new AppError('Add at least one line item.');
    const pos = (v.placeOfSupply || ctx.partyStateCode || ctx.companyStateCode).slice(0, 2);
    const intra = pos === ctx.companyStateCode;
    const lines: ComputedLine[] = v.lines.map((l, i) => {
      if (!(Number(l.qty) > 0)) throw new AppError(`Line ${i + 1}: quantity must be greater than zero.`);
      if (!(Number(l.rate) >= 0)) throw new AppError(`Line ${i + 1}: rate cannot be negative.`);
      if ((Number(l.discountPct) || 0) < 0 || (Number(l.discountPct) || 0) > 100) throw new AppError(`Line ${i + 1}: discount must be between 0 and 100.`);
      return { ...l, ...calcLine(l, intra) };
    });
    const taxable = sum(lines.map((l) => l.taxable)), cgst = sum(lines.map((l) => l.cgst)), sgst = sum(lines.map((l) => l.sgst));
    const igst = sum(lines.map((l) => l.igst)), cess = sum(lines.map((l) => l.cess));
    const exact = r2(taxable + cgst + sgst + igst + cess);
    const total = Math.round(exact);
    const roundOff = r2(total - exact);
    if (total <= 0) throw new AppError('Invoice total must be greater than zero.');

    const e: Entry[] = [];
    const taxCr = (side: 'out' | 'in', dr: boolean) => {
      const push = (k: string, amt: number) => { if (amt) e.push({ ledgerId: sys(`${side}_${k}`), debit: dr ? amt : 0, credit: dr ? 0 : amt }); };
      push('cgst', cgst); push('sgst', sgst); push('igst', igst); push('cess', cess);
    };
    // "partyDr": party is debited (sales, debit note). Round-off follows the party side.
    const partyDr = v.type === 'sales' || v.type === 'debit_note';
    if (v.type === 'sales') { e.push({ ledgerId: v.partyId, debit: total, credit: 0 }, { ledgerId: sys('sales'), debit: 0, credit: taxable }); taxCr('out', false); }
    if (v.type === 'purchase') { e.push({ ledgerId: sys('purchase'), debit: taxable, credit: 0 }, { ledgerId: v.partyId, debit: 0, credit: total }); taxCr('in', true); }
    if (v.type === 'credit_note') { e.push({ ledgerId: sys('sales_return'), debit: taxable, credit: 0 }, { ledgerId: v.partyId, debit: 0, credit: total }); taxCr('out', true); }
    if (v.type === 'debit_note') { e.push({ ledgerId: v.partyId, debit: total, credit: 0 }, { ledgerId: sys('purchase_return'), debit: 0, credit: taxable }); taxCr('in', false); }
    if (roundOff) {
      // party side carries the rounded total; the difference goes to Round Off
      const dr = partyDr ? roundOff < 0 : roundOff > 0;
      e.push({ ledgerId: sys('round_off'), debit: dr ? Math.abs(roundOff) : 0, credit: dr ? 0 : Math.abs(roundOff) });
    }
    return { intra, placeOfSupply: pos, lines, taxable, cgst, sgst, igst, cess, roundOff, total, entries: mergeEntries(e) };
  }

  if (v.type === 'receipt' || v.type === 'payment') {
    const amount = r2(Number(v.amount));
    if (!(amount > 0)) throw new AppError('Enter an amount greater than zero.');
    if (!v.partyId) throw new AppError(v.type === 'receipt' ? 'Select who the money was received from.' : 'Select who the payment was made to.');
    if (!v.accountId) throw new AppError('Select the cash or bank account.');
    if (v.partyId === v.accountId) throw new AppError('Party and cash/bank account cannot be the same.');
    const entries = v.type === 'receipt'
      ? [{ ledgerId: v.accountId, debit: amount, credit: 0 }, { ledgerId: v.partyId, debit: 0, credit: amount }]
      : [{ ledgerId: v.partyId, debit: amount, credit: 0 }, { ledgerId: v.accountId, debit: 0, credit: amount }];
    return { ...blank, total: amount, entries };
  }

  if (v.type === 'contra') {
    const amount = r2(Number(v.amount));
    if (!(amount > 0)) throw new AppError('Enter an amount greater than zero.');
    if (!v.partyId || !v.accountId) throw new AppError('Select both the "from" and "to" cash/bank accounts.');
    if (v.partyId === v.accountId) throw new AppError('"From" and "to" accounts must be different.');
    return { ...blank, total: amount, entries: [{ ledgerId: v.partyId, debit: amount, credit: 0 }, { ledgerId: v.accountId, debit: 0, credit: amount }] };
  }

  if (v.type === 'journal') {
    const rows = (v.journal ?? []).filter((j) => (Number(j.debit) || 0) > 0 || (Number(j.credit) || 0) > 0);
    if (rows.length < 2) throw new AppError('A journal needs at least two lines.');
    for (const j of rows) {
      if ((Number(j.debit) || 0) > 0 && (Number(j.credit) || 0) > 0) throw new AppError('A journal line cannot have both debit and credit.');
      if (!j.ledgerId) throw new AppError('Select a ledger on every journal line.');
    }
    const dr = sum(rows.map((j) => Number(j.debit) || 0)), cr = sum(rows.map((j) => Number(j.credit) || 0));
    if (dr !== cr) throw new AppError(`Journal does not balance: debit ${dr.toFixed(2)} vs credit ${cr.toFixed(2)}.`);
    return { ...blank, total: dr, entries: mergeEntries(rows.map((j) => ({ ledgerId: j.ledgerId, debit: r2(Number(j.debit) || 0), credit: r2(Number(j.credit) || 0) }))) };
  }
  throw new AppError('Unknown voucher type.');
}

/* ------------------------------ persistence ------------------------------ */
export interface Ctx { companyId: string; actor: Actor }

async function assertNotLocked(q: Queryable, companyId: string, date: string) {
  const l = await q.one<{ from_date: string; to_date: string }>(
    'SELECT from_date,to_date FROM data_locks WHERE company_id=$1 AND $2::date BETWEEN from_date AND to_date LIMIT 1', [companyId, date]);
  if (l) throw new AppError(`Data is locked for ${l.from_date} to ${l.to_date}. Ask a Manager to unlock this period first.`, 423);
}

async function nextNumber(q: Queryable, companyId: string, type: VoucherType, date: string): Promise<string> {
  const fy = fyLabel(date);
  const r = await q.one<{ last: number }>(
    `INSERT INTO counters (company_id,type,fy,last) VALUES ($1,$2,$3,1)
     ON CONFLICT (company_id,type,fy) DO UPDATE SET last = counters.last + 1 RETURNING last`, [companyId, type, fy]);
  return `${VOUCHER_PREFIX[type]}/${fy}/${String(r!.last).padStart(4, '0')}`;
}

async function loadContext(q: Queryable, companyId: string, v: VoucherIn): Promise<ComputeCtx> {
  const co = await q.one<{ state_code: string }>('SELECT state_code FROM companies WHERE id=$1', [companyId]);
  if (!co) throw new AppError('Company not found.', 404);
  const ids = [v.partyId, v.accountId, ...(v.journal ?? []).map((j) => j.ledgerId)].filter(Boolean) as string[];
  if (ids.length) {
    const found = await q.query<{ id: string }>('SELECT id FROM ledgers WHERE company_id=$1 AND id = ANY($2::uuid[])', [companyId, ids]);
    if (found.length !== new Set(ids).size) throw new AppError('One of the selected ledgers does not exist in this company.');
  }
  const party = v.partyId ? await q.one<{ state_code: string }>('SELECT state_code FROM ledgers WHERE id=$1', [v.partyId]) : null;
  return { companyStateCode: co.state_code, partyStateCode: party?.state_code || '', sys: await systemLedgerIds(q, companyId) };
}

async function stockAvailable(q: Queryable, companyId: string, itemId: string): Promise<number> {
  const r = await q.one<{ q: number }>(
    `SELECT COALESCE((SELECT opening_qty FROM items WHERE id=$2),0) + COALESCE(SUM(qty_in - qty_out),0) AS q FROM stock_moves WHERE company_id=$1 AND item_id=$2`, [companyId, itemId]);
  return r?.q ?? 0;
}

async function writeBody(q: Queryable, ctx: Ctx, voucherId: string, v: VoucherIn, c: Computed) {
  let seq = 0;
  const company = await q.one<{ allow_negative_stock: boolean }>('SELECT allow_negative_stock FROM companies WHERE id=$1', [ctx.companyId]);
  const needByItem = new Map<string, number>();
  for (const l of c.lines) {
    let item: any = null;
    if (l.itemId) {
      item = await q.one('SELECT id,name,is_service,hsn,unit FROM items WHERE id=$1 AND company_id=$2', [l.itemId, ctx.companyId]);
      if (!item) throw new AppError('One of the selected items does not exist.');
    }
    await q.query(
      `INSERT INTO voucher_lines (voucher_id,seq,item_id,description,hsn,unit,qty,rate,discount_pct,gst_rate,cess_rate,taxable,cgst,sgst,igst,cess,amount)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
      [voucherId, seq++, l.itemId ?? null, l.description || item?.name || '', l.hsn || item?.hsn || '', l.unit || item?.unit || '', r3(l.qty), r2(l.rate),
        l.discountPct ?? 0, l.gstRate, l.cessRate ?? 0, l.taxable, l.cgst, l.sgst, l.igst, l.cess, l.amount]);
    if (item && !item.is_service) {
      const kind = { sales: 'sale', purchase: 'purchase', credit_note: 'sales_return', debit_note: 'purchase_return' }[v.type as string]!;
      const inward = v.type === 'purchase' || v.type === 'credit_note';
      await q.query(`INSERT INTO stock_moves (company_id,voucher_id,item_id,date,qty_in,qty_out,rate,kind) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [ctx.companyId, voucherId, item.id, v.date, inward ? r3(l.qty) : 0, inward ? 0 : r3(l.qty), r2(l.rate * (1 - (l.discountPct ?? 0) / 100)), kind]);
      if (!inward) needByItem.set(item.id, (needByItem.get(item.id) ?? 0) + l.qty);
    }
  }
  if (!company?.allow_negative_stock) {
    for (const [itemId, need] of needByItem) {
      const have = await stockAvailable(q, ctx.companyId, itemId); // already includes this voucher's outward moves
      if (have < -0.0005) {
        const it = await q.one<{ name: string }>('SELECT name FROM items WHERE id=$1', [itemId]);
        throw new AppError(`Not enough stock for "${it?.name}": you are trying to issue ${need} but only ${r3(have + need)} is available.`, 409);
      }
    }
  }
  for (const e of c.entries) {
    await q.query(`INSERT INTO ledger_entries (company_id,voucher_id,date,ledger_id,debit,credit,narration) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [ctx.companyId, voucherId, v.date, e.ledgerId, e.debit, e.credit, v.narration ?? '']);
  }
  const dr = sum(c.entries.map((e) => e.debit)), cr = sum(c.entries.map((e) => e.credit));
  if (dr !== cr) throw new AppError(`Internal error: entries do not balance (${dr} vs ${cr}).`, 500);
}

function validateBasics(v: VoucherIn) {
  if (!VOUCHER_TYPES.includes(v.type)) throw new AppError('Unknown voucher type.');
  if (!isISO(v.date)) throw new AppError('Enter a valid date.');
}

export async function createVoucher(db: Db, ctx: Ctx, v: VoucherIn): Promise<{ id: string; number: string; total: number }> {
  validateBasics(v);
  return db.tx(async (q) => {
    await assertNotLocked(q, ctx.companyId, v.date);
    const cctx = await loadContext(q, ctx.companyId, v);
    const c = computeVoucher(v, cctx);
    const number = await nextNumber(q, ctx.companyId, v.type, v.date);
    const row = await q.one<{ id: string }>(
      `INSERT INTO vouchers (company_id,type,number,date,party_id,account_id,ref_no,ref_date,narration,place_of_supply,intra_state,taxable,cgst,sgst,igst,cess,round_off,total,punch_id,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20) RETURNING id`,
      [ctx.companyId, v.type, number, v.date, v.partyId ?? null, v.accountId ?? null, v.refNo ?? '', v.refDate || null, v.narration ?? '', c.placeOfSupply, c.intra,
        c.taxable, c.cgst, c.sgst, c.igst, c.cess, c.roundOff, c.total, v.punchId ?? null, ctx.actor.username]);
    await writeBody(q, ctx, row!.id, v, c);
    await audit(q, ctx.actor, 'VOUCHER_CREATE', `${number} · ₹${c.total.toFixed(2)}`, ctx.companyId);
    return { id: row!.id, number, total: c.total };
  });
}

export async function updateVoucher(db: Db, ctx: Ctx, id: string, v: VoucherIn): Promise<{ id: string; number: string }> {
  validateBasics(v);
  return db.tx(async (q) => {
    const old = await q.one<any>('SELECT * FROM vouchers WHERE id=$1 AND company_id=$2', [id, ctx.companyId]);
    if (!old) throw new AppError('Voucher not found.', 404);
    if (old.type !== v.type) throw new AppError('Voucher type cannot be changed. Delete it and create a new one.');
    await assertNotLocked(q, ctx.companyId, old.date);
    await assertNotLocked(q, ctx.companyId, v.date);
    const cctx = await loadContext(q, ctx.companyId, v);
    const c = computeVoucher(v, cctx);
    await q.query('DELETE FROM voucher_lines WHERE voucher_id=$1', [id]);
    await q.query('DELETE FROM ledger_entries WHERE voucher_id=$1', [id]);
    await q.query('DELETE FROM stock_moves WHERE voucher_id=$1', [id]);
    await q.query(
      `UPDATE vouchers SET date=$2,party_id=$3,account_id=$4,ref_no=$5,ref_date=$6,narration=$7,place_of_supply=$8,intra_state=$9,taxable=$10,cgst=$11,sgst=$12,igst=$13,cess=$14,round_off=$15,total=$16,updated_by=$17,updated_at=now() WHERE id=$1`,
      [id, v.date, v.partyId ?? null, v.accountId ?? null, v.refNo ?? '', v.refDate || null, v.narration ?? '', c.placeOfSupply, c.intra, c.taxable, c.cgst, c.sgst, c.igst, c.cess, c.roundOff, c.total, ctx.actor.username]);
    await writeBody(q, ctx, id, v, c);
    await audit(q, ctx.actor, 'VOUCHER_EDIT', `${old.number} · ₹${c.total.toFixed(2)}`, ctx.companyId);
    return { id, number: old.number };
  });
}

export async function deleteVoucher(db: Db, ctx: Ctx, id: string): Promise<void> {
  await db.tx(async (q) => {
    const old = await q.one<any>('SELECT * FROM vouchers WHERE id=$1 AND company_id=$2', [id, ctx.companyId]);
    if (!old) throw new AppError('Voucher not found.', 404);
    await assertNotLocked(q, ctx.companyId, old.date);
    await q.query("UPDATE punches SET status='pending', voucher_id=NULL WHERE voucher_id=$1", [id]);
    await q.query('DELETE FROM vouchers WHERE id=$1', [id]); // children cascade
    await audit(q, ctx.actor, 'VOUCHER_DELETE', `${old.number} · ₹${Number(old.total).toFixed(2)}`, ctx.companyId);
  });
}

export async function getVoucher(q: Queryable, companyId: string, id: string) {
  const v = await q.one<any>(
    `SELECT v.*, p.name AS party_name, p.gstin AS party_gstin, p.address AS party_address, p.state AS party_state, p.state_code AS party_state_code,
            a.name AS account_name
       FROM vouchers v LEFT JOIN ledgers p ON p.id=v.party_id LEFT JOIN ledgers a ON a.id=v.account_id
      WHERE v.id=$1 AND v.company_id=$2`, [id, companyId]);
  if (!v) return null;
  const lines = await q.query<any>('SELECT l.*, i.name AS item_name FROM voucher_lines l LEFT JOIN items i ON i.id=l.item_id WHERE l.voucher_id=$1 ORDER BY l.seq', [id]);
  const entries = await q.query<any>(
    `SELECT e.debit,e.credit,l.name AS ledger FROM ledger_entries e JOIN ledgers l ON l.id=e.ledger_id WHERE e.voucher_id=$1 ORDER BY e.id`, [id]);
  return { ...v, lines, entries };
}
