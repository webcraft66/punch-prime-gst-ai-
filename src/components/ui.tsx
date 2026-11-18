import Link from 'next/link';
import { Icon } from './Icon';
import { fmtCompact, fmtMoney } from '@/lib/money';

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="truncate text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="no-print flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, sub, icon, tone = 'brand' }: { label: string; value: string; sub?: React.ReactNode; icon: string; tone?: 'brand' | 'green' | 'red' | 'gold' | 'slate' }) {
  const tones: Record<string, string> = { brand: 'bg-brand-50 text-brand-700', green: 'bg-emerald-50 text-emerald-700', red: 'bg-red-50 text-red-700', gold: 'bg-gold-100 text-gold-700', slate: 'bg-slate-100 text-slate-600' };
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-medium text-slate-500">{label}</div>
          <div className="mt-1.5 truncate text-[22px] font-semibold tracking-tight text-slate-900 tabular-nums">{value}</div>
          {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
        </div>
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tones[tone]}`}><Icon name={icon} size={18} /></div>
      </div>
    </div>
  );
}

export function Badge({ children, tone = 'slate' }: { children: React.ReactNode; tone?: 'slate' | 'green' | 'red' | 'amber' | 'blue' | 'gold' }) {
  const t: Record<string, string> = { slate: 'bg-slate-100 text-slate-700', green: 'bg-emerald-50 text-emerald-700', red: 'bg-red-50 text-red-700', amber: 'bg-amber-50 text-amber-700', blue: 'bg-brand-50 text-brand-700', gold: 'bg-gold-100 text-gold-700' };
  return <span className={`badge ${t[tone]}`}>{children}</span>;
}

export function Empty({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400"><Icon name="info" size={22} /></div>
      <div className="text-sm font-semibold text-slate-800">{title}</div>
      {hint && <p className="mt-1 max-w-sm text-sm text-slate-500">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Money({ v, dr, className = '' }: { v: number; dr?: boolean; className?: string }) {
  const n = Number(v) || 0;
  return <span className={`tabular-nums ${n < 0 && !dr ? 'text-red-600' : ''} ${className}`}>{fmtMoney(Math.abs(n) < 0.005 ? 0 : n)}{dr ? <span className="ml-1 text-[10px] text-slate-400">{n >= 0 ? 'Dr' : 'Cr'}</span> : null}</span>;
}
/** Signed balance with Dr/Cr suffix */
export const Bal = ({ v }: { v: number }) => (Math.abs(v) < 0.005 ? <span className="text-slate-400">0.00</span> : <span className="tabular-nums">{fmtMoney(Math.abs(v))} <span className="text-[10px] text-slate-400">{v > 0 ? 'Dr' : 'Cr'}</span></span>);

export function DateFilter({ from, to, action, extra, hidden }: { from: string; to: string; action: string; extra?: React.ReactNode; hidden?: Record<string, string> }) {
  return (
    <form action={action} method="get" className="no-print mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-card">
      {Object.entries(hidden ?? {}).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <div><label className="label">From</label><input type="date" name="from" defaultValue={from} className="input !w-40" /></div>
      <div><label className="label">To</label><input type="date" name="to" defaultValue={to} className="input !w-40" /></div>
      {extra}
      <button className="btn-primary">Apply</button>
    </form>
  );
}

export function Tabs({ items, active }: { items: { href: string; label: string; count?: number }[]; active: string }) {
  return (
    <div className="no-print mb-4 flex gap-1 overflow-x-auto border-b border-slate-200">
      {items.map((t) => (
        <Link key={t.href} href={t.href} className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition ${t.href === active ? 'border-brand-700 text-brand-800' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
          {t.label}{t.count != null && <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">{t.count}</span>}
        </Link>))}
    </div>
  );
}
export { fmtCompact };
