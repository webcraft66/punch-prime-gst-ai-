import Link from 'next/link';
import { DateFilter, PageHeader } from '@/components/ui';
import { profitAndLoss, type PlLine } from '@/lib/engine/reports';
import { fmtDate, fmtMoney } from '@/lib/money';
import { needCompany, period } from '@/lib/page';

export const metadata = { title: 'Profit & Loss' };
function Block({ title, rows, total, tone }: { title: string; rows: PlLine[]; total: number; tone?: string }) {
  return (<>
    <tr className="bg-slate-50"><td className="td font-semibold text-slate-800" colSpan={2}>{title}</td></tr>
    {rows.map((r) => <tr key={r.name} className="hover:bg-slate-50"><td className="td pl-8">{r.id ? <Link href={`/ledgers/${r.id}`} className="hover:underline">{r.name}</Link> : r.name}</td><td className="td num">{fmtMoney(r.amount)}</td></tr>)}
    <tr><td className="td pl-8 font-semibold">Total {title.toLowerCase()}</td><td className={`td num font-semibold ${tone ?? ''}`}>{fmtMoney(total)}</td></tr></>);
}
export default async function PL({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const { db, company } = await needCompany('report.view');
  const { from, to } = period(searchParams, company.fy_start);
  const p = await profitAndLoss(db, company.id, from, to);
  const t = p.totals;
  return (<div><PageHeader title="Profit & Loss" subtitle={`${fmtDate(from)} to ${fmtDate(to)}`} />
    <DateFilter from={from} to={to} action="/reports/profit-loss" />
    <div className="mb-4 grid gap-4 sm:grid-cols-3">
      {[['Revenue (net sales)', t.sales], ['Gross profit', p.grossProfit], ['Net profit', p.netProfit]].map(([k, v]: any) => (<div key={k} className="card p-4"><div className="text-xs text-slate-500">{k}</div><div className={`mt-1 text-xl font-semibold tabular-nums ${v < 0 ? 'text-red-600' : 'text-slate-900'}`}>₹{fmtMoney(v)}</div></div>))}</div>
    <div className="card overflow-hidden"><table className="w-full"><tbody className="divide-y divide-slate-100">
      <tr className="bg-brand-950 text-white"><td className="px-3 py-2 text-xs font-semibold uppercase tracking-wide" colSpan={2}>Trading account</td></tr>
      <Block title="Sales" rows={p.sales} total={t.sales} />
      {p.directIncome.length > 0 && <Block title="Direct incomes" rows={p.directIncome} total={t.directIncome} />}
      <tr><td className="td pl-8">Closing stock</td><td className="td num">{fmtMoney(p.closingStock)}</td></tr>
      <tr><td className="td pl-8">Less: Opening stock</td><td className="td num">{fmtMoney(p.openingStock)}</td></tr>
      <Block title="Purchases" rows={p.purchases} total={t.purchases} />
      {p.directExp.length > 0 && <Block title="Direct expenses" rows={p.directExp} total={t.directExpense} />}
      <tr className="bg-gold-50"><td className="td font-semibold text-slate-900">Gross profit</td><td className="td num text-base font-semibold">{fmtMoney(p.grossProfit)}</td></tr>
      <tr className="bg-brand-950 text-white"><td className="px-3 py-2 text-xs font-semibold uppercase tracking-wide" colSpan={2}>Profit & Loss account</td></tr>
      {p.indirectIncome.length > 0 && <Block title="Indirect incomes" rows={p.indirectIncome} total={t.indirectIncome} />}
      <Block title="Indirect expenses" rows={p.indirectExp} total={t.indirectExpense} />
      <tr className="border-t-2 border-slate-300 bg-gold-50"><td className="td text-base font-bold text-slate-900">Net profit</td><td className={`td num text-lg font-bold ${p.netProfit < 0 ? 'text-red-600' : 'text-emerald-700'}`}>₹{fmtMoney(p.netProfit)}</td></tr>
    </tbody></table></div></div>);
}
