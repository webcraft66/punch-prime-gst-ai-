import type { Queryable } from './db';

export interface PartyOpt { id: string; name: string; stateCode: string; gstin: string; type: 'customer' | 'supplier' | null; group: string }
export interface ItemOpt { id: string; name: string; hsn: string; unit: string; gstRate: number; salesRate: number; purchaseRate: number; isService: boolean; stock: number }
export interface LedgerOpt { id: string; name: string; group: string }

/** Everything the voucher form needs, in one go. */
export async function voucherLookups(q: Queryable, companyId: string) {
  const ledgers = await q.query<any>(`SELECT id,name,group_key,state_code,gstin,party_type FROM ledgers WHERE company_id=$1 AND active ORDER BY name`, [companyId]);
  const items = await q.query<any>(
    `SELECT i.*, i.opening_qty + COALESCE((SELECT SUM(qty_in-qty_out) FROM stock_moves s WHERE s.item_id=i.id),0) AS stock FROM items i WHERE i.company_id=$1 AND i.active ORDER BY i.name`, [companyId]);
  return {
    parties: ledgers.filter((l) => l.group_key === 'sundry_debtors' || l.group_key === 'sundry_creditors').map((l): PartyOpt => ({ id: l.id, name: l.name, stateCode: l.state_code, gstin: l.gstin, type: l.party_type, group: l.group_key })),
    accounts: ledgers.filter((l) => l.group_key === 'cash' || l.group_key === 'bank').map((l): LedgerOpt => ({ id: l.id, name: l.name, group: l.group_key })),
    all: ledgers.map((l): LedgerOpt => ({ id: l.id, name: l.name, group: l.group_key })),
    items: items.map((i): ItemOpt => ({ id: i.id, name: i.name, hsn: i.hsn, unit: i.unit, gstRate: Number(i.gst_rate), salesRate: Number(i.sales_rate), purchaseRate: Number(i.purchase_rate), isService: i.is_service, stock: Number(i.stock) })),
  };
}
