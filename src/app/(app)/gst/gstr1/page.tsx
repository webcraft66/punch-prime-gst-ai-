import Link from 'next/link';
import GstTabs from '@/components/GstTabs';
import { DateFilter, PageHeader, Badge } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { gstr1 } from '@/lib/engine/gstreports';
import { fmtDate, fmtMoney, fmtQty, todayISO } from '@/lib/money';
import { monthStart, needCompany } from '@/lib/page';

export const metadata = { title: 'GSTR-1' };
export default async function G1({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const { db, company } = await needCompany('report.view');
  const ok = (v?: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v ?? '') ? v! : undefined);
  const from = ok(searchParams.from) ?? monthStart(), to = ok(searchParams.to) ?? todayISO();
  const r = await gstr1(db, company.id, from, to);
  const T = ({ title, rows, cols }: { title: string; rows: any[]; cols: any[] }) => (
    <section className="card mb-5 overflow-hidden"><div className="flex items-center justify-between bg-brand-950 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-white"><span>{title}</span><span className="text-brand-200">{rows.length} rows</span></div>
      {rows.length === 0 ? <p className="px-4 py-6 text-center text-sm text-slate-400">No entries in this period</p> : (
        <div className="overflow-x-auto"><table className="w-full"><thead><tr>{cols.map((c) => <th key={c[0]} className={`th ${c[2] ? 'text-right' : ''}`}>{c[0]}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">{rows.map((x, i) => <tr key={i} className="hover:bg-slate-50">{cols.map((c) => <td key={c[0]} className={`td ${c[2] ? 'num' : ''}`}>{c[1](x)}</td>)}</tr>)}</tbody></table></div>)}</section>);
  const money = (k: string) => (x: any) => fmtMoney(x[k]);
  const inv = [['Invoice', (x: any) => <Link href={`/vouchers/${x.id}`} className="font-medium text-brand-700 hover:underline">{x.number}</Link>], ['Date', (x: any) => fmtDate(x.date)], ['Party', (x: any) => x.party], ['GSTIN', (x: any) => <span className="font-mono text-xs">{x.gstin}</span>], ['POS', (x: any) => x.place_of_supply],
    ['Taxable', money('taxable'), 1], ['IGST', money('igst'), 1], ['CGST', money('cgst'), 1], ['SGST', money('sgst'), 1], ['Total', money('total'), 1]];
  return (<div><PageHeader title="GST Returns" subtitle={`${company.name} · ${company.gstin || 'GSTIN not set'}`} actions={<a className="btn-ghost" href={`/api/export/gstr1?from=${from}&to=${to}`}><Icon name="download" size={16} />Download CSV</a>} />
    <GstTabs active="/gst/gstr1" /><DateFilter from={from} to={to} action="/gst/gstr1" />
    <div className="mb-5 grid gap-4 sm:grid-cols-4">{([['B2B invoices', r.totals.b2b], ['B2C invoices', r.totals.b2c], ['Credit notes (reg.)', r.totals.cdnr], ['Credit notes (unreg.)', r.totals.cdnur]] as const).map(([k, t]) => (
      <div key={k} className="card p-4"><div className="text-xs text-slate-500">{k}</div><div className="mt-1 text-lg font-semibold tabular-nums">{t.count}</div><div className="text-xs text-slate-500">Taxable ₹{fmtMoney(t.taxable)}</div></div>))}</div>
    <T title="B2B — registered buyers" rows={r.b2b} cols={inv} />
    <T title="B2C — summary by place of supply & rate" rows={r.b2cRate} cols={[['Place of supply', (x: any) => x.pos], ['Rate', (x: any) => `${x.rate}%`, 1], ['Taxable', money('taxable'), 1], ['IGST', money('igst'), 1], ['CGST', money('cgst'), 1], ['SGST', money('sgst'), 1]]} />
    <T title="Credit notes — registered" rows={r.cdnr} cols={inv} />
    <T title="Credit notes — unregistered" rows={r.cdnur} cols={inv} />
    <T title="HSN summary" rows={r.hsn} cols={[['HSN', (x: any) => <span className="font-mono">{x.hsn || '—'}</span>], ['Description', (x: any) => x.description], ['Unit', (x: any) => x.unit], ['Qty', (x: any) => fmtQty(x.qty), 1], ['Rate', (x: any) => `${x.rate}%`, 1], ['Taxable', money('taxable'), 1], ['IGST', money('igst'), 1], ['CGST', money('cgst'), 1], ['SGST', money('sgst'), 1]]} /></div>);
}
