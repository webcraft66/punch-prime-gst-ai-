import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Bal, DateFilter, Empty, PageHeader } from '@/components/ui';
import { Icon } from '@/components/Icon';
import PrintButton from '@/components/PrintButton';
import { VOUCHER_LABEL, groupName, type VoucherType } from '@/lib/engine/chart';
import { ledgerStatement } from '@/lib/engine/reports';
import { fmtDate, fmtMoney } from '@/lib/money';
import { needCompany, period } from '@/lib/page';

export const metadata = { title: 'Ledger statement' };
export default async function LedgerPage({ params, searchParams }: { params: { id: string }; searchParams: Record<string, string | undefined> }) {
  const { db, company } = await needCompany();
  const { from, to } = period(searchParams, company.fy_start);
  const st = await ledgerStatement(db, company.id, params.id, from, to);
  if (!st) notFound();
  const l = st.ledger;
  return (
    <div>
      <PageHeader title={l.name} subtitle={<>{groupName(l.group_key)}{l.gstin && <> · <span className="font-mono">{l.gstin}</span></>}{l.state && <> · {l.state}</>}</>}
        actions={<><a href={`/api/export/ledger?id=${l.id}&from=${from}&to=${to}`} className="btn-ghost"><Icon name="download" size={16} />CSV</a><PrintButton /></>} />
      <DateFilter from={from} to={to} action={`/ledgers/${l.id}`} />
      <div className="mb-4 grid gap-4 sm:grid-cols-4">
        {[['Opening', st.opening], ['Total debit', null, st.totalDr], ['Total credit', null, st.totalCr], ['Closing', st.closing]].map(([k, v, plain]: any) => (
          <div key={k} className="card p-4"><div className="text-xs text-slate-500">{k}</div><div className="mt-1 text-lg font-semibold tabular-nums">{v != null ? <Bal v={v} /> : fmtMoney(plain)}</div></div>))}
      </div>
      <div className="card overflow-hidden">
        {st.lines.length === 0 ? <Empty title="No transactions in this period" /> : (
          <div className="overflow-x-auto"><table className="w-full"><thead><tr><th className="th">Date</th><th className="th">Voucher</th><th className="th">Against</th><th className="th text-right">Debit</th><th className="th text-right">Credit</th><th className="th text-right">Balance</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              <tr className="bg-slate-50/60"><td className="td" colSpan={5}><i className="text-slate-500">Opening balance</i></td><td className="td num"><Bal v={st.opening} /></td></tr>
              {st.lines.map((r: any, i: number) => (
                <tr key={i} className="hover:bg-slate-50"><td className="td whitespace-nowrap text-slate-500">{fmtDate(r.date)}</td>
                  <td className="td"><Link href={`/vouchers/${r.voucher_id}`} className="font-medium text-brand-700 hover:underline">{r.number}</Link><div className="text-xs text-slate-500">{VOUCHER_LABEL[r.type as VoucherType]}</div></td>
                  <td className="td max-w-xs truncate text-slate-600">{r.against}</td>
                  <td className="td num">{r.debit ? fmtMoney(r.debit) : ''}</td><td className="td num">{r.credit ? fmtMoney(r.credit) : ''}</td><td className="td num"><Bal v={r.balance} /></td></tr>))}
              <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold"><td className="td" colSpan={3}>Closing balance</td><td className="td num">{fmtMoney(st.totalDr)}</td><td className="td num">{fmtMoney(st.totalCr)}</td><td className="td num"><Bal v={st.closing} /></td></tr>
            </tbody></table></div>)}
      </div>
    </div>
  );
}
