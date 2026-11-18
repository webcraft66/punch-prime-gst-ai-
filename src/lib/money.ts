/** Rounding / formatting helpers. All money is rounded to 2 decimals (half away from zero). */
export const r2 = (n: number): number => {
  const v = Number(n) || 0;
  return (Math.sign(v) * Math.round((Math.abs(v) + Number.EPSILON) * 100)) / 100 + 0;
};
export const r3 = (n: number): number => Math.round(((Number(n) || 0) + Number.EPSILON) * 1000) / 1000;
export const sum = (xs: number[]): number => r2(xs.reduce((a, b) => a + (Number(b) || 0), 0));

const inr = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fmtMoney = (n: number): string => inr.format(Number(n) || 0);
export const fmtRs = (n: number): string => '₹' + fmtMoney(n);
export const fmtQty = (n: number): string => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 3 }).format(Number(n) || 0);
/** Compact amount for dashboard cards: ₹1.25 Cr, ₹12.4 L, ₹8,500 */
export function fmtCompact(n: number): string {
  const v = Number(n) || 0, a = Math.abs(v), s = v < 0 ? '-' : '';
  if (a >= 1e7) return `${s}₹${(a / 1e7).toFixed(2)} Cr`;
  if (a >= 1e5) return `${s}₹${(a / 1e5).toFixed(2)} L`;
  return `${s}₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(a)}`;
}

/** YYYY-MM-DD helpers (no timezone surprises: dates are plain strings). */
export const todayISO = (): string => {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
};
export const isISO = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));
export function fmtDate(s: string | Date | null | undefined): string {
  if (!s) return '—';
  const iso = typeof s === 'string' ? s.slice(0, 10) : s.toISOString().slice(0, 10);
  const [y, m, d] = iso.split('-');
  const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(m) - 1];
  return `${d} ${mon} ${y}`;
}
export function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10);
}
export const daysBetween = (a: string, b: string): number => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
/** Indian financial year label, e.g. 2026-04-01 -> "2026-27" */
export function fyLabel(iso: string): string {
  const y = Number(iso.slice(0, 4)), m = Number(iso.slice(5, 7));
  const start = m >= 4 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}
export function fyRange(label: string): { from: string; to: string } {
  const start = Number(label.slice(0, 4));
  return { from: `${start}-04-01`, to: `${start + 1}-03-31` };
}

const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const two = (n: number): string => (n < 20 ? ones[n] : tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : ''));
const three = (n: number): string => (n >= 100 ? ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + two(n % 100) : '') : two(n));
/** 1234.50 -> "Rupees One Thousand Two Hundred Thirty Four and Fifty Paise Only" (Indian numbering) */
export function amountInWords(amount: number): string {
  const v = Math.abs(r2(amount));
  let rupees = Math.floor(v);
  const paise = Math.round((v - rupees) * 100);
  if (rupees === 0 && paise === 0) return 'Rupees Zero Only';
  const parts: string[] = [];
  const crore = Math.floor(rupees / 1e7); rupees %= 1e7;
  const lakh = Math.floor(rupees / 1e5); rupees %= 1e5;
  const thousand = Math.floor(rupees / 1e3); rupees %= 1e3;
  if (crore) parts.push(three(crore) + ' Crore');
  if (lakh) parts.push(two(lakh) + ' Lakh');
  if (thousand) parts.push(two(thousand) + ' Thousand');
  if (rupees) parts.push(three(rupees));
  let out = 'Rupees ' + (parts.join(' ') || 'Zero');
  if (paise) out += ' and ' + two(paise) + ' Paise';
  return out + ' Only';
}
