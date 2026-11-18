import Link from 'next/link';
import { PageHeader } from '@/components/ui';
import { balanceSheet } from '@/lib/engine/reports';
import { groupName } from '@/lib/engine/chart';
import { fmtDate, fmtMoney } from '@/lib/money';
import { needCompany, period } from '@/lib/page';

export const metadata = { title: 'Balance Sheet' };
export default async function BS({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const { db, company } = await needCompany('report.view');
  const { to } = period(searchParams, company.fy_start);
  const b = await balanceSheet(db, company.id, company.fy_start, to);
  const Side = ({ title, rows, total, extra }: any) => (
    <div className="card overflow-hidden"><div className="bg-brand-950 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-white">{title}</div>
      <table className="w-full"><tbody className="divide-y divide-slate-100">
        {rows.map((r: any) => (<tr key={r.group + r.name} className="hover:bg-slate-50"><td className="td">{r.id && r.id !== 'stock' ? <Link href={`/ledgers/${r.id}`} className="hover:underline">{r.name}</Link> : r.name}<div className="text-[11px] text-slate-400">{groupName(r.group)}</div></td><td className="td num">{fmtMoney(r.amount)}</td></tr>))}
        {extra}
        <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold"><td className="td">Total</td><td className="td num">{fmtMoney(total)}</td></tr></tbody></table></div>);
  return (<div><PageHeader title="Balance Sheet" subtitle={`As on ${fmtDate(to)}`} />
    <form className="no-print mb-4 flex items-end gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-card"><div><label className="label">As on</label><input type="date" name="to" defaultValue={to} className="input !w-44" /></div><button className="btn-primary">Apply</button></form>
    {b.difference !== 0 && <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Assets and liabilities differ by ₹{fmtMoney(Math.abs(b.difference))} — your opening balances do not balance.</div>}
    <div className="grid gap-5 lg:grid-cols-2">
      <Side title="Liabilities & Capital" rows={b.liabilities} total={b.totalLiabilities} extra={<tr><td className="td font-medium">Net profit for the period</td><td className="td num">{fmtMoney(b.netProfit)}</td></tr>} />
      <Side title="Assets" rows={b.assets} total={b.totalAssets} /></div></div>);
}
