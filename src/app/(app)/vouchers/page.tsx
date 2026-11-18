import Link from 'next/link';
import { Badge, DateFilter, Empty, PageHeader, Tabs } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { VOUCHER_LABEL, VOUCHER_TYPES, type VoucherType } from '@/lib/engine/chart';
import { dayBook } from '@/lib/engine/reports';
import { fmtDate, fmtMoney, sum } from '@/lib/money';
import { needCompany, period } from '@/lib/page';
import { can, canCreateVoucher } from '@/lib/permissions';

export const metadata = { title: 'Vouchers' };
const TONE: Record<string, 'green' | 'blue' | 'gold' | 'red' | 'slate' | 'amber'> = { sales: 'green', purchase: 'blue', receipt: 'green', payment: 'amber', credit_note: 'red', debit_note: 'red', contra: 'slate', journal: 'slate' };

export default async function VouchersPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const { db, company, role } = await needCompany();
  const { from, to } = period(searchParams, company.fy_start);
  const type = (VOUCHER_TYPES as readonly string[]).includes(searchParams.type ?? '') ? searchParams.type : undefined;
  const q = searchParams.q?.trim() || undefined;
  const rows = await dayBook(db, company.id, from, to, type, q);
  const base = (t?: string) => `/vouchers?${new URLSearchParams({ ...(t ? { type: t } : {}), from, to, ...(q ? { q } : {}) })}`;
  const tabs = [{ href: base(), label: 'All' }, ...(['sales', 'purchase', 'receipt', 'payment', 'credit_note', 'debit_note', 'contra', 'journal'] as VoucherType[]).map((t) => ({ href: base(t), label: VOUCHER_LABEL[t] + 's'.replace('ss', 's') }))];
  const total = sum(rows.map((r: any) => r.total));
  return (
    <div>
      <PageHeader title="Vouchers" subtitle="Every invoice, bill, payment and entry in one place (Day Book)."
        actions={<>
          {can(role, 'voucher.create.basic') && (
            <div className="group relative">
              <button className="btn-primary"><Icon name="plus" size={16} />New voucher</button>
              <div className="invisible absolute right-0 z-20 mt-1 w-52 rounded-xl border border-slate-200 bg-white py-1 opacity-0 shadow-pop transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                {VOUCHER_TYPES.filter((t) => canCreateVoucher(role, t)).map((t) => <Link key={t} href={`/vouchers/new?type=${t}`} className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">{VOUCHER_LABEL[t]}</Link>)}
              </div>
            </div>)}
        </>} />
      <Tabs items={tabs} active={base(type)} />
      <DateFilter from={from} to={to} action="/vouchers" hidden={type ? { type } : {}}
        extra={<div className="min-w-[14rem] flex-1"><label className="label">Search</label><div className="relative"><Icon name="search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input name="q" defaultValue={q} className="input pl-9" placeholder="Number, party, narration…" /></div></div>} />
      <div className="card overflow-hidden">
        {rows.length === 0 ? <Empty title="No vouchers found" hint="Try a wider date range, or create a new voucher." /> : (
          <div className="overflow-x-auto"><table className="w-full">
            <thead><tr><th className="th">Date</th><th className="th">Voucher</th><th className="th">Party / narration</th><th className="th">Type</th><th className="th text-right">Amount (₹)</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r: any) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="td whitespace-nowrap text-slate-500">{fmtDate(r.date)}</td>
                  <td className="td"><Link href={`/vouchers/${r.id}`} className="font-medium text-brand-700 hover:underline">{r.number}</Link>{r.ref_no && <div className="text-xs text-slate-500">Ref {r.ref_no}</div>}</td>
                  <td className="td"><div className="max-w-xs truncate">{r.party || '—'}</div>{r.narration && <div className="max-w-xs truncate text-xs text-slate-500">{r.narration}</div>}</td>
                  <td className="td"><Badge tone={TONE[r.type]}>{VOUCHER_LABEL[r.type as VoucherType]}</Badge></td>
                  <td className="td num font-medium text-slate-900">{fmtMoney(r.total)}</td>
                </tr>))}
            </tbody>
            <tfoot><tr className="border-t-2 border-slate-200 bg-slate-50"><td className="td font-semibold" colSpan={4}>{rows.length} voucher{rows.length > 1 ? 's' : ''}{rows.length >= 1000 ? ' (showing first 1,000)' : ''}</td><td className="td num font-semibold">{fmtMoney(total)}</td></tr></tfoot>
          </table></div>)}
      </div>
    </div>
  );
}
