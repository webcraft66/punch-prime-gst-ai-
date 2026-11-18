import GstTabs from '@/components/GstTabs';
import { DateFilter, PageHeader } from '@/components/ui';
import { gstr3b } from '@/lib/engine/gstreports';
import { fmtDate, fmtMoney } from '@/lib/money';
import { monthStart, needCompany } from '@/lib/page';
import { todayISO } from '@/lib/money';

export const metadata = { title: 'GSTR-3B' };
export default async function G3B({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const { db, company } = await needCompany('report.view');
  const ok = (v?: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v ?? '') ? v! : undefined);
  const from = ok(searchParams.from) ?? monthStart(), to = ok(searchParams.to) ?? todayISO();
  const r = await gstr3b(db, company.id, from, to);
  const H = ['Taxable value', 'IGST', 'CGST', 'SGST', 'Cess'];
  const row = (l: string, x: any, bold = false) => (<tr className={bold ? 'bg-gold-50 font-semibold' : 'hover:bg-slate-50'}><td className="td">{l}</td>{[x.taxable, x.igst, x.cgst, x.sgst, x.cess].map((v: any, i: number) => <td key={i} className="td num">{v === undefined ? '' : fmtMoney(v)}</td>)}</tr>);
  return (<div><PageHeader title="GST Returns" subtitle={`${company.name} · ${company.gstin || 'GSTIN not set'}`} />
    <GstTabs active="/gst/gstr3b" /><DateFilter from={from} to={to} action="/gst/gstr3b" />
    <p className="mb-3 text-sm text-slate-500">Period {fmtDate(from)} – {fmtDate(to)}. Figures come from posted sales, purchases and notes. Verify before filing on the GST portal.</p>
    <div className="card mb-5 overflow-hidden"><div className="bg-brand-950 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-white">3.1 Outward supplies (net of credit notes)</div>
      <table className="w-full"><thead><tr><th className="th" />{H.map((h) => <th key={h} className="th text-right">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{row('Taxable outward supplies', r.outward)}{row('Zero-rated / nil-rated (0% GST) sales', { taxable: r.zeroRated })}</tbody></table></div>
    <div className="card mb-5 overflow-hidden"><div className="bg-brand-950 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-white">4. Eligible input tax credit (net of debit notes)</div>
      <table className="w-full"><thead><tr><th className="th" />{H.map((h) => <th key={h} className="th text-right">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{row('ITC available', r.itc)}</tbody></table></div>
    <div className="grid gap-5 md:grid-cols-2">
      <div className="card overflow-hidden"><div className="bg-brand-950 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-white">6. Tax payable in cash</div>
        <table className="w-full"><tbody className="divide-y divide-slate-100">{(['igst', 'cgst', 'sgst', 'cess'] as const).map((k) => <tr key={k}><td className="td uppercase">{k}</td><td className="td num">{fmtMoney(r.cashPayable[k])}</td></tr>)}<tr className="bg-gold-50 font-semibold"><td className="td">Total payable</td><td className="td num text-base">₹{fmtMoney(r.cashPayable.total)}</td></tr></tbody></table></div>
      <div className="card overflow-hidden"><div className="bg-brand-950 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-white">Credit carried forward</div>
        <table className="w-full"><tbody className="divide-y divide-slate-100">{(['igst', 'cgst', 'sgst', 'cess'] as const).map((k) => <tr key={k}><td className="td uppercase">{k}</td><td className="td num">{fmtMoney(r.carryForward[k])}</td></tr>)}</tbody></table></div></div></div>);
}
