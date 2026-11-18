import Link from 'next/link';
import { DateFilter, PageHeader } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { groupName } from '@/lib/engine/chart';
import { trialBalance } from '@/lib/engine/reports';
import { fmtDate, fmtMoney } from '@/lib/money';
import { needCompany, period } from '@/lib/page';

export const metadata = { title: 'Trial Balance' };
export default async function TB({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const { db, company } = await needCompany('report.view');
  const { to } = period(searchParams, company.fy_start);
  const tb = await trialBalance(db, company.id, company.fy_start, to);
  return (<div><PageHeader title="Trial Balance" subtitle={`As on ${fmtDate(to)}`} actions={<><a className="btn-ghost" href={`/api/export/tb?to=${to}`}><Icon name="download" size={16} />CSV</a></>} />
    <form className="no-print mb-4 flex items-end gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-card"><div><label className="label">As on</label><input type="date" name="to" defaultValue={to} className="input !w-44" /></div><button className="btn-primary">Apply</button></form>
    {tb.difference !== 0 && <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Opening balances differ by ₹{fmtMoney(Math.abs(tb.difference))}. Check opening balances of your accounts and items.</div>}
    <div className="card overflow-hidden"><table className="w-full"><thead><tr><th className="th">Account</th><th className="th">Group</th><th className="th text-right">Debit (₹)</th><th className="th text-right">Credit (₹)</th></tr></thead>
      <tbody className="divide-y divide-slate-100">{tb.rows.map((r, i) => (<tr key={i} className="hover:bg-slate-50"><td className="td">{r.id ? <Link href={`/ledgers/${r.id}`} className="font-medium text-brand-700 hover:underline">{r.name}</Link> : r.name}</td><td className="td text-slate-500">{groupName(r.group)}</td><td className="td num">{r.debit ? fmtMoney(r.debit) : ''}</td><td className="td num">{r.credit ? fmtMoney(r.credit) : ''}</td></tr>))}</tbody>
      <tfoot><tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold"><td className="td" colSpan={2}>Total</td><td className="td num">{fmtMoney(tb.debit)}</td><td className="td num">{fmtMoney(tb.credit)}</td></tr></tfoot></table></div></div>);
}
