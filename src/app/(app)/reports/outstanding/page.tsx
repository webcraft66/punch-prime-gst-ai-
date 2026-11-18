import Link from 'next/link';
import { PageHeader, Tabs } from '@/components/ui';
import { outstanding } from '@/lib/engine/reports';
import { fmtMoney } from '@/lib/money';
import { needCompany, period } from '@/lib/page';

export const metadata = { title: 'Outstanding' };
export default async function Out({ searchParams }: { searchParams: { kind?: string } }) {
  const { db, company } = await needCompany('report.view');
  const kind = searchParams.kind === 'payable' ? 'payable' : 'receivable';
  const { today } = period({}, company.fy_start);
  const { rows, totals } = await outstanding(db, company.id, company.fy_start, today, kind);
  return (<div><PageHeader title={kind === 'receivable' ? 'Receivables ageing' : 'Payables ageing'} subtitle="Balances split by age of the oldest unpaid bills (latest bills are treated as unpaid first)." />
    <Tabs active={`/reports/outstanding?kind=${kind}`} items={[{ href: '/reports/outstanding?kind=receivable', label: 'Receivables' }, { href: '/reports/outstanding?kind=payable', label: 'Payables' }]} />
    <div className="card overflow-hidden"><div className="overflow-x-auto"><table className="w-full"><thead><tr><th className="th">Party</th><th className="th text-right">0–30</th><th className="th text-right">31–60</th><th className="th text-right">61–90</th><th className="th text-right">90+</th><th className="th text-right">Total (₹)</th><th className="th text-right">Overdue</th></tr></thead>
      <tbody className="divide-y divide-slate-100">{rows.map((r) => (<tr key={r.id} className="hover:bg-slate-50"><td className="td"><Link href={`/ledgers/${r.id}`} className="font-medium text-brand-700 hover:underline">{r.name}</Link><div className="text-xs text-slate-500">{r.creditDays} days credit</div></td>
        {[r.b0, r.b31, r.b61, r.b90].map((v, i) => <td key={i} className={`td num ${i === 3 && v > 0 ? 'font-medium text-red-600' : ''}`}>{v ? fmtMoney(v) : '—'}</td>)}<td className="td num font-semibold">{fmtMoney(r.balance)}</td><td className="td num">{r.overdue ? <span className="text-red-600">{fmtMoney(r.overdue)}</span> : '—'}</td></tr>))}
        {rows.length === 0 && <tr><td className="td py-10 text-center text-slate-400" colSpan={7}>Nothing outstanding 🎉</td></tr>}</tbody>
      <tfoot><tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold"><td className="td">Total</td>{[totals.b0, totals.b31, totals.b61, totals.b90, totals.balance, totals.overdue].map((v, i) => <td key={i} className="td num">{fmtMoney(v)}</td>)}</tr></tfoot></table></div></div></div>);
}
