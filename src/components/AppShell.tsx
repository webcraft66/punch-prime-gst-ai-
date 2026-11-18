'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import { Brand } from './Logo';

interface NavItem { href: string; label: string; icon: string; match?: string[]; roles?: number[] }
const NAV: { title: string; items: NavItem[] }[] = [
  { title: 'Overview', items: [{ href: '/dashboard', label: 'Dashboard', icon: 'dashboard' }] },
  { title: 'Transactions', items: [
    { href: '/vouchers', label: 'Vouchers', icon: 'vouchers', match: ['/vouchers'] },
    { href: '/punch', label: 'AI Punch', icon: 'punch', match: ['/punch'] },
  ] },
  { title: 'Masters', items: [
    { href: '/parties', label: 'Parties', icon: 'parties', match: ['/parties'] },
    { href: '/items', label: 'Items & Stock', icon: 'items', match: ['/items'] },
    { href: '/ledgers', label: 'Accounts', icon: 'ledger', match: ['/ledgers'] },
  ] },
  { title: 'Reports', items: [
    { href: '/reports', label: 'Financial Reports', icon: 'reports', match: ['/reports'] },
    { href: '/gst', label: 'GST Returns', icon: 'gst', match: ['/gst'] },
  ] },
  { title: 'Admin', items: [
    { href: '/audit', label: 'Audit Log', icon: 'audit', roles: [1, 2] },
    { href: '/settings', label: 'Settings', icon: 'settings', match: ['/settings'] },
  ] },
];
const ROLE = ['', 'Owner', 'Manager', 'Accountant', 'Viewer'];

export default function AppShell(props: {
  user: { name: string; username: string; role: number };
  company: { id: string; name: string; gstin: string; fy: string } | null;
  companies: { id: string; name: string }[];
  children: React.ReactNode;
}) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => { setOpen(false); setMenu(false); }, [path]);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(false); };
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
  }, []);
  const isActive = (n: NavItem) => (n.match ?? [n.href]).some((m) => path === m || path.startsWith(m + '/'));

  async function logout() { await fetch('/api/auth/logout', { method: 'POST' }); window.location.href = '/login'; }
  async function switchCompany(id: string) { await fetch('/api/company/switch', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id }) }); router.refresh(); window.location.href = '/dashboard'; }

  const sidebar = (
    <nav className="flex h-full flex-col">
      <div className="px-5 py-5"><Brand /></div>
      <div className="flex-1 overflow-y-auto px-3 pb-4">
        {NAV.map((g) => {
          const items = g.items.filter((i) => !i.roles || i.roles.includes(props.user.role));
          if (!items.length) return null;
          return (
            <div key={g.title} className="mb-4">
              <div className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-300/70">{g.title}</div>
              {items.map((n) => (
                <Link key={n.href} href={n.href} className={`group mb-0.5 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${isActive(n) ? 'bg-white/10 text-white shadow-inner' : 'text-brand-100/80 hover:bg-white/5 hover:text-white'}`}>
                  <Icon name={n.icon} size={17} className={isActive(n) ? 'text-gold-400' : 'text-brand-300 group-hover:text-brand-100'} />{n.label}
                  {isActive(n) && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-gold-400" />}
                </Link>))}
            </div>);
        })}
      </div>
      <div className="border-t border-white/10 p-4 text-[11px] text-brand-300/70">Punch Prime v2.0</div>
    </nav>
  );

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 bg-brand-950 lg:block">{sidebar}</aside>
      {open && (<div className="fixed inset-0 z-40 lg:hidden"><div className="absolute inset-0 bg-slate-900/50" onClick={() => setOpen(false)} /><aside className="absolute inset-y-0 left-0 w-72 bg-brand-950 shadow-pop">{sidebar}</aside></div>)}
      <div className="lg:pl-64">
        <header className="app-top sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6">
          <button className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu"><Icon name="menu" /></button>
          <div className="min-w-0 flex-1">
            {props.company ? (
              <div className="flex items-center gap-2">
                {props.companies.length > 1 ? (
                  <select value={props.company.id} onChange={(e) => switchCompany(e.target.value)} className="max-w-[16rem] truncate rounded-lg border-0 bg-transparent py-1 pr-7 text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-brand-500/30">
                    {props.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                ) : <span className="truncate text-sm font-semibold text-slate-900">{props.company.name}</span>}
                <span className="hidden rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 sm:inline">FY {props.company.fy}</span>
                {props.company.gstin && <span className="hidden font-mono text-[11px] text-slate-500 md:inline">{props.company.gstin}</span>}
              </div>) : <span className="text-sm text-slate-500">No company yet</span>}
          </div>
          <Link href="/vouchers/new?type=sales" className="btn-gold btn-sm hidden sm:inline-flex"><Icon name="plus" size={15} />New Invoice</Link>
          <div className="relative" ref={menuRef}>
            <button onClick={() => setMenu(!menu)} className="flex items-center gap-2 rounded-lg p-1 pr-2 hover:bg-slate-100">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-800 text-xs font-semibold text-gold-300">{props.user.name.split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase()}</span>
              <span className="hidden text-left leading-tight sm:block"><span className="block text-sm font-medium text-slate-900">{props.user.name}</span><span className="block text-[11px] text-slate-500">{ROLE[props.user.role]}</span></span>
            </button>
            {menu && (
              <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-pop">
                <div className="border-b border-slate-100 px-4 py-3"><div className="text-sm font-semibold text-slate-900">{props.user.name}</div><div className="text-xs text-slate-500">@{props.user.username} · {ROLE[props.user.role]}</div></div>
                <Link href="/settings?tab=account" className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"><Icon name="lock" size={15} />Change password</Link>
                <button onClick={logout} className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"><Icon name="logout" size={15} />Sign out</button>
              </div>)}
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6">{props.children}</main>
      </div>
    </div>
  );
}
