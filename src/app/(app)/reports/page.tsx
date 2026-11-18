import Link from 'next/link';
import { PageHeader } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { pageCtx } from '@/lib/page';

export const metadata = { title: 'Financial Reports' };
const R = [
  { href: '/reports/profit-loss', t: 'Profit & Loss', d: 'Income, expenses and net profit for any period.', i: 'trend' },
  { href: '/reports/balance-sheet', t: 'Balance Sheet', d: 'Assets and liabilities as on a date.', i: 'building' },
  { href: '/reports/trial-balance', t: 'Trial Balance', d: 'All ledger balances — debit equals credit.', i: 'ledger' },
  { href: '/reports/outstanding?kind=receivable', t: 'Receivables ageing', d: 'Who owes you money, and for how long.', i: 'clock' },
  { href: '/reports/outstanding?kind=payable', t: 'Payables ageing', d: 'What you owe suppliers, by age.', i: 'wallet' },
  { href: '/reports/stock', t: 'Stock summary', d: 'Quantity and value of every item.', i: 'items' },
  { href: '/vouchers', t: 'Day Book', d: 'Every voucher in date order.', i: 'vouchers' },
  { href: '/gst/gstr1', t: 'GSTR-1', d: 'Outward supplies: B2B, B2C, credit notes, HSN.', i: 'gst' },
  { href: '/gst/gstr3b', t: 'GSTR-3B', d: 'Tax payable after input credit set-off.', i: 'percent' },
];
export default async function ReportsHub() {
  await pageCtx();
  return (<div><PageHeader title="Financial Reports" subtitle="Live from your books — nothing to refresh." />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{R.map((r) => (
      <Link key={r.href} href={r.href} className="card group flex gap-4 p-5 transition hover:border-brand-300 hover:shadow-pop">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 group-hover:bg-brand-800 group-hover:text-gold-300"><Icon name={r.i} size={20} /></div>
        <div><div className="font-semibold text-slate-900">{r.t}</div><p className="mt-0.5 text-sm text-slate-500">{r.d}</p></div></Link>))}</div></div>);
}
