import Link from 'next/link';
import { Badge, PageHeader, Tabs } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { CompanyForm, LockForm, PasswordForm, UserDialog } from '@/components/Forms';
import { ROLE_DESC, ROLE_SHORT, can } from '@/lib/permissions';
import { fmtDate } from '@/lib/money';
import { aiConfigured } from '@/lib/ai/extract';
import { pageCtx } from '@/lib/page';

export const metadata = { title: 'Settings' };
export default async function Settings({ searchParams }: { searchParams: { tab?: string } }) {
  const { db, company, user, role, companies } = await pageCtx();
  const all = [['company', 'Company', 'company.edit'], ['users', 'Users & roles', 'user.manage'], ['locks', 'Data lock', 'datalock.manage'], ['backup', 'Backup & system', 'backup'], ['account', 'My account', 'view']] as const;
  const tabs = all.filter(([, , a]) => can(role, a as any));
  const tab = tabs.find(([k]) => k === searchParams.tab)?.[0] ?? tabs[0][0];
  const users = tab === 'users' ? await db.query<any>('SELECT id,username,name,role,active,last_login,created_at,locked_until FROM users ORDER BY role, name') : [];
  const locks = tab === 'locks' && company ? await db.query<any>('SELECT * FROM data_locks WHERE company_id=$1 ORDER BY from_date DESC', [company.id]) : [];
  return (
    <div>
      <PageHeader title="Settings" subtitle="Company details, people, security and backups." actions={can(role, 'company.create') && <Link href="/company/new" className="btn-ghost"><Icon name="plus" size={16} />New company</Link>} />
      <Tabs active={`/settings?tab=${tab}`} items={tabs.map(([k, l]) => ({ href: `/settings?tab=${k}`, label: l }))} />
      {tab === 'company' && company && <div className="max-w-3xl"><CompanyForm initial={company} /></div>}
      {tab === 'users' && (<div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-4">{[1, 2, 3, 4].map((r) => <div key={r} className="card p-4"><div className="text-sm font-semibold text-slate-900">{ROLE_SHORT[r]}</div><p className="mt-1 text-xs text-slate-500">{ROLE_DESC[r]}</p></div>)}</div>
        <div className="flex justify-end"><UserDialog selfId={user.id} trigger={<button className="btn-primary"><Icon name="plus" size={16} />Add user</button>} /></div>
        <div className="card overflow-hidden"><table className="w-full"><thead><tr><th className="th">Name</th><th className="th">Username</th><th className="th">Role</th><th className="th">Status</th><th className="th">Last sign-in</th><th className="th" /></tr></thead>
          <tbody className="divide-y divide-slate-100">{users.map((u: any) => (<tr key={u.id} className="hover:bg-slate-50"><td className="td font-medium">{u.name}{u.id === user.id && <span className="ml-2 text-xs text-slate-400">(you)</span>}</td><td className="td font-mono text-xs">{u.username}</td><td className="td"><Badge tone={u.role === 1 ? 'gold' : u.role === 4 ? 'slate' : 'blue'}>{ROLE_SHORT[u.role]}</Badge></td>
            <td className="td">{!u.active ? <Badge tone="red">Disabled</Badge> : u.locked_until && new Date(u.locked_until) > new Date() ? <Badge tone="amber">Locked</Badge> : <Badge tone="green">Active</Badge>}</td><td className="td text-slate-500">{u.last_login ? fmtDate(u.last_login) : 'Never'}</td>
            <td className="td text-right"><UserDialog user={u} selfId={user.id} trigger={<button className="btn-ghost btn-sm"><Icon name="edit" size={13} />Edit</button>} /></td></tr>))}</tbody></table></div></div>)}
      {tab === 'locks' && <div className="max-w-3xl"><LockForm locks={locks} /></div>}
      {tab === 'backup' && (
        <div className="grid max-w-3xl gap-5">
          <div className="card flex flex-wrap items-center justify-between gap-4 p-5"><div><h2 className="font-semibold text-slate-900">Download backup</h2><p className="mt-1 text-sm text-slate-500">All ledgers, items and vouchers of <b>{company?.name}</b> as a JSON file. Keep a copy somewhere safe.</p></div><a href="/api/backup" className="btn-primary"><Icon name="download" size={16} />Download JSON</a></div>
          <div className="card p-5"><h2 className="font-semibold text-slate-900">System status</h2>
            <dl className="mt-3 grid grid-cols-[10rem_1fr] gap-y-2 text-sm"><dt className="text-slate-500">Database</dt><dd>{process.env.DATABASE_URL ? 'Hosted PostgreSQL' : 'Local embedded database (this computer)'}</dd><dt className="text-slate-500">AI Punch</dt><dd>{aiConfigured() ? <Badge tone="green">AI on</Badge> : <Badge>AI off — add ANTHROPIC_API_KEY</Badge>}</dd><dt className="text-slate-500">Companies</dt><dd>{companies.length}</dd><dt className="text-slate-500">Version</dt><dd>Punch Prime 2.0</dd></dl></div></div>)}
      {tab === 'account' && <PasswordForm />}
    </div>
  );
}
