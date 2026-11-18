import { Badge, Empty, PageHeader } from '@/components/ui';
import { ROLE_SHORT } from '@/lib/permissions';
import { pageCtx } from '@/lib/page';

export const metadata = { title: 'Audit log' };
const tone = (a: string) => (/FAIL|DENIED|LOCK$|DELETE|REJECT/.test(a) ? 'red' : /CREATE|APPROVE|LOGIN$|SETUP/.test(a) ? 'green' : /EDIT|RESET|ROLE|BACKUP/.test(a) ? 'amber' : 'slate') as any;
export default async function Audit({ searchParams }: { searchParams: { q?: string } }) {
  const { db } = await pageCtx('audit.view');
  const q = (searchParams.q ?? '').trim();
  const rows = await db.query<any>(`SELECT * FROM audit ${q ? 'WHERE action ILIKE $1 OR username ILIKE $1 OR detail ILIKE $1' : ''} ORDER BY id DESC LIMIT 300`, q ? [`%${q}%`] : []);
  return (<div><PageHeader title="Audit log" subtitle="A permanent record of who did what and when. Latest 300 events." />
    <form className="no-print mb-4 flex max-w-md gap-3"><input name="q" defaultValue={q} className="input" placeholder="Filter by user, action or detail…" /><button className="btn-ghost">Filter</button></form>
    <div className="card overflow-hidden">{rows.length === 0 ? <Empty title="No events" /> : <div className="overflow-x-auto"><table className="w-full"><thead><tr><th className="th">When</th><th className="th">User</th><th className="th">Action</th><th className="th">Detail</th></tr></thead>
      <tbody className="divide-y divide-slate-100">{rows.map((r: any) => (<tr key={r.id} className="hover:bg-slate-50"><td className="td whitespace-nowrap text-slate-500">{new Date(r.at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</td><td className="td">{r.username}{r.role ? <span className="ml-1.5 text-[11px] text-slate-400">{ROLE_SHORT[r.role]}</span> : null}</td><td className="td"><Badge tone={tone(r.action)}>{r.action}</Badge></td><td className="td max-w-md truncate text-slate-600">{r.detail}</td></tr>))}</tbody></table></div>}</div></div>);
}
