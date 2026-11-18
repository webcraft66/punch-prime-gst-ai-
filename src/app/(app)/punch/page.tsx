import Link from 'next/link';
import { Badge, Empty, PageHeader, Stat, Tabs } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { aiConfigured, type Bill } from '@/lib/ai/extract';
import { fmtDate, fmtMoney } from '@/lib/money';
import { needCompany } from '@/lib/page';
import { can } from '@/lib/permissions';

export const metadata = { title: 'AI Punch' };
export default async function PunchBoard({ searchParams }: { searchParams: { status?: string } }) {
  const { db, company, role } = await needCompany();
  const rows = await db.query<any>('SELECT * FROM punches WHERE company_id=$1 ORDER BY created_at DESC LIMIT 200', [company.id]);
  const st = ['pending', 'approved', 'rejected'].includes(searchParams.status ?? '') ? searchParams.status! : 'pending';
  const count = (s: string) => rows.filter((r: any) => r.status === s).length;
  const list = rows.filter((r: any) => r.status === st);
  return (
    <div>
      <PageHeader title="AI Punch" subtitle="Upload a supplier bill. Review what was read, then post it as a purchase in one click."
        actions={can(role, 'punch.create') && <Link href="/punch/new" className="btn-gold"><Icon name="upload" size={16} />Punch a bill</Link>} />
      {!aiConfigured() && <div className="mb-5 flex gap-3 rounded-xl border border-gold-300 bg-gold-50 px-4 py-3 text-sm text-slate-700"><Icon name="info" size={18} className="mt-0.5 shrink-0 text-gold-700" /><div><b>AI reading is off.</b> You can still punch bills by typing the details. To let AI read photos and PDFs automatically, add <code className="rounded bg-white px-1 font-mono text-xs">ANTHROPIC_API_KEY</code> in your settings (see README).</div></div>}
      <div className="mb-5 grid gap-4 sm:grid-cols-3"><Stat label="Waiting for review" value={String(count('pending'))} icon="clock" tone="gold" /><Stat label="Posted" value={String(count('approved'))} icon="check" tone="green" /><Stat label="Rejected" value={String(count('rejected'))} icon="close" tone="red" /></div>
      <Tabs active={`/punch?status=${st}`} items={['pending', 'approved', 'rejected'].map((s) => ({ href: `/punch?status=${s}`, label: s[0].toUpperCase() + s.slice(1), count: count(s) }))} />
      <div className="card overflow-hidden">{list.length === 0 ? <Empty title={`No ${st} bills`} hint={st === 'pending' ? 'Upload a bill to get started.' : undefined} /> : (
        <div className="overflow-x-auto"><table className="w-full"><thead><tr><th className="th">#</th><th className="th">Supplier</th><th className="th">Invoice</th><th className="th">Source</th><th className="th">Confidence</th><th className="th text-right">Total (₹)</th><th className="th" /></tr></thead>
          <tbody className="divide-y divide-slate-100">{list.map((r: any) => { const d = r.data as Bill; return (
            <tr key={r.id} className="hover:bg-slate-50"><td className="td text-slate-500">#{r.seq}</td><td className="td font-medium">{d.sellerName || <span className="text-slate-400">Not read</span>}</td>
              <td className="td">{d.invoiceNo || '—'}<div className="text-xs text-slate-500">{fmtDate(d.invoiceDate)}</div></td>
              <td className="td"><Badge tone={r.source === 'ai' ? 'blue' : 'slate'}>{r.source === 'ai' ? 'AI' : r.source === 'text' ? 'Text' : r.source === 'demo' ? 'Demo' : 'Manual'}</Badge></td>
              <td className="td"><div className="flex items-center gap-2"><div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100"><div className={`h-full ${r.confidence >= 80 ? 'bg-emerald-500' : r.confidence >= 50 ? 'bg-gold-400' : 'bg-red-400'}`} style={{ width: `${r.confidence}%` }} /></div><span className="text-xs text-slate-500">{r.confidence}%</span></div></td>
              <td className="td num font-medium">{fmtMoney(d.total)}</td>
              <td className="td text-right">{r.voucher_id ? <Link href={`/vouchers/${r.voucher_id}`} className="btn-ghost btn-sm">View voucher</Link> : <Link href={`/punch/${r.id}`} className="btn-primary btn-sm">Review</Link>}</td></tr>); })}</tbody></table></div>)}</div>
    </div>
  );
}
