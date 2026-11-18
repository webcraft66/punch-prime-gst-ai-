import Link from 'next/link';
import { Badge, Empty, PageHeader, Stat } from '@/components/ui';
import { HBar, TrendChart } from '@/components/Charts';
import { Icon } from '@/components/Icon';
import { dashboard } from '@/lib/engine/reports';
import { VOUCHER_LABEL, type VoucherType } from '@/lib/engine/chart';
import { fmtCompact, fmtDate, fmtMoney, fmtQty } from '@/lib/money';
import { needCompany } from '@/lib/page';
import { can } from '@/lib/permissions';
import DemoButton from './DemoButton';

export const metadata = { title: 'Dashboard' };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default async function DashboardPage({ searchParams }: { searchParams: { denied?: string } }) {
  const { db, company, user, role } = await needCompany();
  const d = await dashboard(db, company.id, company.fy_start);
  const trend = d.trend.map((t: any) => ({ label: MONTHS[Number(t.m.slice(5, 7)) - 1], a: Number(t.sales), b: Number(t.purchases) }));
  const empty = d.salesFy === 0 && d.recent.length === 0;
  const hr = new Date().getHours();
  return (
    <div>
      <PageHeader title={`${hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening'}, ${user.name.split(' ')[0]}`}
        subtitle={<>Here’s how <b className="text-slate-700">{company.name}</b> is doing today.</>}
        actions={<>
          {can(role, 'voucher.create.basic') && <Link href="/vouchers/new?type=purchase" className="btn-ghost"><Icon name="plus" size={16} />Purchase</Link>}
          {can(role, 'voucher.create.basic') && <Link href="/vouchers/new?type=sales" className="btn-primary"><Icon name="plus" size={16} />New Invoice</Link>}
        </>} />
      {searchParams.denied && <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Access denied — your role does not allow that page.</div>}
      {empty && (
        <div className="card mb-6 flex flex-wrap items-center justify-between gap-4 border-gold-300 bg-gradient-to-r from-gold-50 to-white p-5">
          <div><div className="font-semibold text-slate-900">Your books are empty</div><p className="mt-0.5 text-sm text-slate-600">Add your customers and items, then create your first invoice — or load sample data to explore.</p></div>
          {can(role, 'company.create') && <DemoButton />}
        </div>)}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Sales today" value={fmtCompact(d.salesToday)} sub={`This month ${fmtCompact(d.salesMonth)}`} icon="rupee" tone="brand" />
        <Stat label="Purchases today" value={fmtCompact(d.purchaseToday)} sub={`This month ${fmtCompact(d.purchaseMonth)}`} icon="box" tone="gold" />
        <Stat label="Net profit (FY)" value={fmtCompact(d.netProfit)} sub={`Gross profit ${fmtCompact(d.grossProfit)}`} icon="trend" tone={d.netProfit >= 0 ? 'green' : 'red'} />
        <Stat label="GST payable" value={fmtCompact(d.gstPayable)} sub="Output less input credit (ledger)" icon="percent" tone="slate" />
        <Stat label="Cash in hand" value={fmtCompact(d.cash)} icon="wallet" tone="green" />
        <Stat label="Bank balance" value={fmtCompact(d.bank)} icon="building" tone={d.bank >= 0 ? 'brand' : 'red'} />
        <Stat label="Receivable" value={fmtCompact(d.receivable)} sub={d.receivableOverdue > 0 ? <span className="text-red-600">{fmtCompact(d.receivableOverdue)} overdue</span> : 'Nothing overdue'} icon="clock" tone="gold" />
        <Stat label="Stock value" value={fmtCompact(d.stockValue)} sub={`Payable ${fmtCompact(d.payable)}`} icon="items" tone="brand" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <section className="card p-5 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <div><h2 className="text-sm font-semibold text-slate-900">Sales vs Purchases</h2><p className="text-xs text-slate-500">Last 6 months, before tax</p></div>
            <div className="flex items-center gap-4 text-xs text-slate-500"><span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-brand-600" />Sales</span><span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-gold-400" />Purchases</span></div>
          </div>
          <TrendChart data={trend.slice(-6)} />
        </section>
        <section className="card p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">Top customers <span className="font-normal text-slate-400">· this FY</span></h2>
          {d.topCustomers.length ? <HBar rows={d.topCustomers.map((c: any) => ({ label: c.name, value: Number(c.total) }))} /> : <p className="py-8 text-center text-sm text-slate-400">No sales yet</p>}
        </section>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <section className="card lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5"><h2 className="text-sm font-semibold text-slate-900">Recent transactions</h2><Link href="/vouchers" className="text-xs font-medium text-brand-600 hover:underline">View all →</Link></div>
          {d.recent.length === 0 ? <Empty title="No transactions yet" hint="Create your first invoice to see it here." /> : (
            <div className="overflow-x-auto"><table className="w-full"><tbody className="divide-y divide-slate-100">
              {d.recent.map((v: any) => (
                <tr key={v.id} className="hover:bg-slate-50">
                  <td className="td"><Link href={`/vouchers/${v.id}`} className="font-medium text-brand-700 hover:underline">{v.number}</Link><div className="text-xs text-slate-500">{VOUCHER_LABEL[v.type as VoucherType]}</div></td>
                  <td className="td hidden sm:table-cell">{v.party || '—'}</td>
                  <td className="td hidden text-slate-500 md:table-cell">{fmtDate(v.date)}</td>
                  <td className="td num font-medium text-slate-900">₹{fmtMoney(v.total)}</td>
                </tr>))}
            </tbody></table></div>)}
        </section>
        <div className="space-y-6">
          <section className="card">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5"><h2 className="text-sm font-semibold text-slate-900">Low stock</h2>{d.lowStock.length > 0 && <Badge tone="red">{d.lowStock.length} items</Badge>}</div>
            {d.lowStock.length === 0 ? <p className="px-5 py-6 text-center text-sm text-slate-400">All items are well stocked 👍</p> : (
              <ul className="divide-y divide-slate-100">{d.lowStock.map((s: any) => (
                <li key={s.id} className="flex items-center justify-between px-5 py-2.5 text-sm"><span className="truncate pr-3 text-slate-700">{s.name}</span><span className="shrink-0 font-semibold tabular-nums text-red-600">{fmtQty(s.qty)} {s.unit}</span></li>))}</ul>)}
          </section>
          <section className="card">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5"><h2 className="text-sm font-semibold text-slate-900">AI Punch</h2><Link href="/punch" className="text-xs font-medium text-brand-600 hover:underline">Open →</Link></div>
            <div className="px-5 py-4 text-sm">
              {d.pendingPunches > 0 ? <p className="text-slate-700"><b className="text-lg text-brand-800">{d.pendingPunches}</b> bill{d.pendingPunches > 1 ? 's' : ''} waiting for your review.</p> : <p className="text-slate-500">No bills waiting. Upload a supplier bill to punch it automatically.</p>}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
