import { r2 } from './money';

export const STATES: { code: string; name: string }[] = [
  ['01', 'Jammu & Kashmir'], ['02', 'Himachal Pradesh'], ['03', 'Punjab'], ['04', 'Chandigarh'], ['05', 'Uttarakhand'],
  ['06', 'Haryana'], ['07', 'Delhi'], ['08', 'Rajasthan'], ['09', 'Uttar Pradesh'], ['10', 'Bihar'], ['11', 'Sikkim'],
  ['12', 'Arunachal Pradesh'], ['13', 'Nagaland'], ['14', 'Manipur'], ['15', 'Mizoram'], ['16', 'Tripura'], ['17', 'Meghalaya'],
  ['18', 'Assam'], ['19', 'West Bengal'], ['20', 'Jharkhand'], ['21', 'Odisha'], ['22', 'Chhattisgarh'], ['23', 'Madhya Pradesh'],
  ['24', 'Gujarat'], ['26', 'Dadra & Nagar Haveli and Daman & Diu'], ['27', 'Maharashtra'], ['29', 'Karnataka'], ['30', 'Goa'],
  ['31', 'Lakshadweep'], ['32', 'Kerala'], ['33', 'Tamil Nadu'], ['34', 'Puducherry'], ['35', 'Andaman & Nicobar Islands'],
  ['36', 'Telangana'], ['37', 'Andhra Pradesh'], ['38', 'Ladakh'], ['97', 'Other Territory'],
].map(([code, name]) => ({ code, name }));

export const stateName = (code: string): string => STATES.find((s) => s.code === code)?.name ?? '';
export const stateCode = (name: string): string => STATES.find((s) => s.name.toLowerCase() === String(name).toLowerCase())?.code ?? '';

export const GST_RATES = [0, 0.25, 3, 5, 12, 18, 28];
export const UNITS = ['Pcs', 'Nos', 'Kg', 'Gm', 'Ltr', 'Mtr', 'Box', 'Bag', 'Set', 'Pair', 'Dozen', 'Hrs', 'Service'];

const CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
export function gstinCheckChar(first14: string): string {
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const v = CHARS.indexOf(first14[i]);
    const p = v * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(p / 36) + (p % 36);
  }
  return CHARS[(36 - (sum % 36)) % 36];
}
export type GstinCheck = { ok: boolean; message: string; stateCode?: string; state?: string; pan?: string };
export function validateGstin(input: string): GstinCheck {
  const g = String(input || '').trim().toUpperCase();
  if (!g) return { ok: false, message: 'GSTIN is empty' };
  if (g.length !== 15) return { ok: false, message: 'GSTIN must be 15 characters' };
  if (!/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(g)) return { ok: false, message: 'GSTIN format is invalid' };
  const code = g.slice(0, 2);
  if (!stateName(code)) return { ok: false, message: `Unknown state code ${code}` };
  const cd = gstinCheckChar(g.slice(0, 14));
  if (cd !== g[14]) return { ok: false, message: `Checksum failed (last character should be ${cd})` };
  return { ok: true, message: 'Valid GSTIN', stateCode: code, state: stateName(code), pan: g.slice(2, 12) };
}
export const validatePan = (p: string): boolean => /^[A-Z]{5}\d{4}[A-Z]$/.test(String(p || '').trim().toUpperCase());

export interface LineInput { qty: number; rate: number; discountPct?: number; gstRate: number; cessRate?: number }
export interface LineTax { taxable: number; cgst: number; sgst: number; igst: number; cess: number; amount: number }
/** Tax for one invoice line. Intra-state => CGST + SGST (half each); inter-state => IGST. */
export function calcLine(l: LineInput, intra: boolean): LineTax {
  const gross = (Number(l.qty) || 0) * (Number(l.rate) || 0);
  const taxable = r2(gross * (1 - (Number(l.discountPct) || 0) / 100));
  const gst = Number(l.gstRate) || 0;
  const cgst = intra ? r2((taxable * gst) / 200) : 0;
  const sgst = intra ? r2((taxable * gst) / 200) : 0;
  const igst = intra ? 0 : r2((taxable * gst) / 100);
  const cess = r2((taxable * (Number(l.cessRate) || 0)) / 100);
  return { taxable, cgst, sgst, igst, cess, amount: r2(taxable + cgst + sgst + igst + cess) };
}
