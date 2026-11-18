import type { Queryable } from '../db';
import { AppError } from '../errors';
import { gstinCheckChar, stateName, validateGstin, validatePan } from '../gst';
import { GROUP } from './chart';

export interface LedgerIn {
  name: string; group: string; opening?: number; openingType?: 'Dr' | 'Cr';
  partyType?: 'customer' | 'supplier' | null; gstin?: string; stateCode?: string; address?: string; phone?: string; email?: string;
  creditDays?: number; creditLimit?: number;
}
export async function saveLedger(q: Queryable, companyId: string, input: LedgerIn, id?: string): Promise<string> {
  const name = input.name.trim();
  if (!name) throw new AppError('Name is required.');
  if (!GROUP[input.group]) throw new AppError('Choose a valid account group.');
  let stateCode = input.stateCode || '', gstin = (input.gstin || '').trim().toUpperCase();
  if (gstin) {
    const g = validateGstin(gstin);
    if (!g.ok) throw new AppError(`GSTIN: ${g.message}`);
    stateCode = g.stateCode!;
  }
  const state = stateCode ? stateName(stateCode) : '';
  const partyType = input.partyType ?? (input.group === 'sundry_debtors' ? 'customer' : input.group === 'sundry_creditors' ? 'supplier' : null);
  const vals = [name, input.group, Math.abs(Number(input.opening) || 0), input.openingType === 'Cr' ? 'Cr' : 'Dr', partyType, gstin, state, stateCode,
    input.address ?? '', input.phone ?? '', input.email ?? '', Math.max(0, Number(input.creditDays) || 0), Math.max(0, Number(input.creditLimit) || 0)];
  try {
    if (id) {
      const cur = await q.one<any>('SELECT system_key FROM ledgers WHERE id=$1 AND company_id=$2', [id, companyId]);
      if (!cur) throw new AppError('Ledger not found.', 404);
      if (cur.system_key) { // system ledgers: only the opening balance may change
        await q.query('UPDATE ledgers SET opening=$2, opening_type=$3 WHERE id=$1', [id, vals[2], vals[3]]);
        return id;
      }
      await q.query(`UPDATE ledgers SET name=$2,group_key=$3,opening=$4,opening_type=$5,party_type=$6,gstin=$7,state=$8,state_code=$9,address=$10,phone=$11,email=$12,credit_days=$13,credit_limit=$14 WHERE id=$1`, [id, ...vals]);
      return id;
    }
    const r = await q.one<{ id: string }>(
      `INSERT INTO ledgers (company_id,name,group_key,opening,opening_type,party_type,gstin,state,state_code,address,phone,email,credit_days,credit_limit)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id`, [companyId, ...vals]);
    return r!.id;
  } catch (e: any) {
    if (/unique|duplicate/i.test(String(e?.message))) throw new AppError(`A ledger named "${name}" already exists.`);
    throw e;
  }
}
export async function deleteLedger(q: Queryable, companyId: string, id: string) {
  const l = await q.one<any>('SELECT system_key, name FROM ledgers WHERE id=$1 AND company_id=$2', [id, companyId]);
  if (!l) throw new AppError('Ledger not found.', 404);
  if (l.system_key) throw new AppError('System ledgers cannot be deleted.');
  const used = await q.one<any>('SELECT 1 AS x FROM ledger_entries WHERE ledger_id=$1 LIMIT 1', [id]);
  if (used) throw new AppError(`"${l.name}" has transactions and cannot be deleted. You can edit it instead.`);
  await q.query('DELETE FROM ledgers WHERE id=$1', [id]);
  return l.name as string;
}

export interface ItemIn {
  name: string; sku?: string; hsn?: string; unit?: string; gstRate?: number; cess?: number; purchaseRate?: number; salesRate?: number;
  openingQty?: number; openingRate?: number; reorderLevel?: number; isService?: boolean;
}
export async function saveItem(q: Queryable, companyId: string, i: ItemIn, id?: string): Promise<string> {
  const name = i.name.trim();
  if (!name) throw new AppError('Item name is required.');
  if (i.hsn && !/^\d{4,8}$/.test(i.hsn.trim())) throw new AppError('HSN/SAC must be 4 to 8 digits.');
  const isService = !!i.isService;
  const vals = [name, i.sku ?? '', (i.hsn ?? '').trim(), i.unit || (isService ? 'Service' : 'Pcs'), Number(i.gstRate ?? 18), Number(i.cess ?? 0), Number(i.purchaseRate) || 0, Number(i.salesRate) || 0,
    isService ? 0 : Number(i.openingQty) || 0, isService ? 0 : Number(i.openingRate) || 0, Number(i.reorderLevel) || 0, isService];
  try {
    if (id) {
      await q.query(`UPDATE items SET name=$2,sku=$3,hsn=$4,unit=$5,gst_rate=$6,cess=$7,purchase_rate=$8,sales_rate=$9,opening_qty=$10,opening_rate=$11,reorder_level=$12,is_service=$13 WHERE id=$1 AND company_id='${companyId}'`, [id, ...vals]);
      return id;
    }
    const r = await q.one<{ id: string }>(
      `INSERT INTO items (company_id,name,sku,hsn,unit,gst_rate,cess,purchase_rate,sales_rate,opening_qty,opening_rate,reorder_level,is_service)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`, [companyId, ...vals]);
    return r!.id;
  } catch (e: any) {
    if (/unique|duplicate/i.test(String(e?.message))) throw new AppError(`An item named "${name}" already exists.`);
    throw e;
  }
}
export async function deleteItem(q: Queryable, companyId: string, id: string) {
  const it = await q.one<any>('SELECT name FROM items WHERE id=$1 AND company_id=$2', [id, companyId]);
  if (!it) throw new AppError('Item not found.', 404);
  const used = await q.one<any>('SELECT 1 AS x FROM voucher_lines WHERE item_id=$1 LIMIT 1', [id]);
  if (used) throw new AppError(`"${it.name}" is used in vouchers and cannot be deleted.`);
  await q.query('DELETE FROM items WHERE id=$1', [id]);
  return it.name as string;
}

export { validatePan, gstinCheckChar };
