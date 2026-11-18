import Link from 'next/link';
import { Bal, PageHeader } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { LedgerDialog } from '@/components/MasterForms';
import { GROUPS } from '@/lib/engine/chart';
import { ledgerBalances } from '@/lib/engine/reports';
import { needCompany } from '@/lib/page';
import { can } from '@/lib/permissions';
import { todayISO } from '@/lib/money';

export const metadata = { title: 'Accounts' };
export default async function LedgersPage() {
  const { db, company, role } = await needCompany();
  const bals = await ledgerBalances(db, company.id, company.fy_start, todayISO());
  const masters = new Map((await db.query<any>('SELECT id, opening, opening_type FROM ledgers WHERE company_id=$1', [company.id])).map((m: any) => [m.id, m]));
  const canEdit = can(role, 'master.edit');
  return (
    <div>
      <PageHeader title="Accounts (Chart of Accounts)" subtitle="Every ledger, grouped. Click a name to see its statement."
        actions={can(role, 'master.create') && <LedgerDialog trigger={<button className="btn-primary"><Icon name="plus" size={16} />Add account</button>} />} />
      <div className="space-y-5">
        {GROUPS.map((g) => {
          const rows = bals.filter((b) => b.group === g.key && b.systemKey !== 'stock');
          if (!rows.length) return null;
          return (
            <section key={g.key} className="card overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-2.5"><h2 className="text-sm font-semibold text-slate-800">{g.name}</h2><span className="text-xs capitalize text-slate-500">{g.nature}</span></div>
              <table className="w-full"><tbody className="divide-y divide-slate-100">{rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50"><td className="td"><Link href={`/ledgers/${r.id}`} className="font-medium text-brand-700 hover:underline">{r.name}</Link></td>
                  <td className="td num w-48"><Bal v={r.closing} /></td>
                  <td className="td w-24 text-right">{canEdit && <LedgerDialog system={!!r.systemKey} canDelete={can(role, 'master.delete')} initial={{ id: r.id, name: r.name, group: r.group, opening: Number(masters.get(r.id)?.opening ?? 0), openingType: masters.get(r.id)?.opening_type ?? 'Dr' }} trigger={<button className="btn-ghost btn-sm">{r.systemKey ? 'Opening' : 'Edit'}</button>} />}</td></tr>))}</tbody></table>
            </section>);
        })}
      </div>
    </div>
  );
}
