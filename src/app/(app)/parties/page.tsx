import Link from 'next/link';
import { Badge, Bal, Empty, PageHeader, Tabs } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { PartyDialog } from '@/components/MasterForms';
import { ledgerBalances } from '@/lib/engine/reports';
import { needCompany, period } from '@/lib/page';
import { can } from '@/lib/permissions';
import { fmtMoney, sum } from '@/lib/money';

export const metadata = { title: 'Parties' };
export default async function PartiesPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const { db, company, role } = await needCompany();
  const { today } = period({}, company.fy_start);
  const kind = searchParams.type === 'supplier' ? 'supplier' : 'customer';
  const q = (searchParams.q ?? '').trim().toLowerCase();
  const all = (await ledgerBalances(db, company.id, company.fy_start, today)).filter((b) => b.group === (kind === 'customer' ? 'sundry_debtors' : 'sundry_creditors'));
  const rows = all.filter((b) => !q || b.name.toLowerCase().includes(q) || b.gstin.toLowerCase().includes(q));
  const total = sum(rows.map((r) => (kind === 'customer' ? r.closing : -r.closing)));
  const canAdd = can(role, 'master.create'), canEdit = can(role, 'master.edit');
  return (
    <div>
      <PageHeader title="Parties" subtitle="Your customers and suppliers, with live balances."
        actions={canAdd && <PartyDialog kind={kind} autoOpen={searchParams.new === '1'} trigger={<button className="btn-primary"><Icon name="plus" size={16} />Add {kind}</button>} />} />
      <Tabs active={`/parties?type=${kind}`} items={[{ href: '/parties?type=customer', label: 'Customers' }, { href: '/parties?type=supplier', label: 'Suppliers' }]} />
      <form className="no-print mb-4 flex gap-3"><input type="hidden" name="type" value={kind} /><div className="relative max-w-sm flex-1"><Icon name="search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input name="q" defaultValue={searchParams.q} className="input pl-9" placeholder="Search name or GSTIN…" /></div><button className="btn-ghost">Search</button></form>
      <div className="card overflow-hidden">
        {rows.length === 0 ? <Empty title={`No ${kind}s yet`} hint="Add your first one to start billing." /> : (
          <div className="overflow-x-auto"><table className="w-full"><thead><tr><th className="th">Name</th><th className="th">GSTIN</th><th className="th">State</th><th className="th">Phone</th><th className="th text-right">{kind === 'customer' ? 'Receivable' : 'Payable'} (₹)</th><th className="th" /></tr></thead>
            <tbody className="divide-y divide-slate-100">{rows.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="td"><Link href={`/ledgers/${r.id}`} className="font-medium text-brand-700 hover:underline">{r.name}</Link>{r.address && <div className="text-xs text-slate-500">{r.address}</div>}</td>
                <td className="td font-mono text-xs">{r.gstin || <Badge>Unregistered</Badge>}</td><td className="td text-slate-600">{r.state}</td><td className="td text-slate-600">{r.phone}</td>
                <td className="td num font-medium"><Bal v={kind === 'customer' ? r.closing : -r.closing} /></td>
                <td className="td text-right">{canEdit && <PartyDialog canDelete={can(role, 'master.delete')} initial={{ id: r.id, name: r.name, group: r.group, gstin: r.gstin, stateCode: r.state ? undefined : '', address: r.address, phone: r.phone, email: r.email, creditDays: r.creditDays, creditLimit: r.creditLimit }} trigger={<button className="btn-ghost btn-sm"><Icon name="edit" size={13} />Edit</button>} />}</td>
              </tr>))}</tbody>
            <tfoot><tr className="border-t-2 border-slate-200 bg-slate-50"><td className="td font-semibold" colSpan={4}>{rows.length} {kind}{rows.length > 1 ? 's' : ''}</td><td className="td num font-semibold">{fmtMoney(total)}</td><td /></tr></tfoot></table></div>)}
      </div>
    </div>
  );
}
