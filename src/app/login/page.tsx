import { redirect } from 'next/navigation';
import { getDb } from '@/lib/db';
import { getSession } from '@/lib/auth';
import LoginForm from './LoginForm';
import { Brand } from '@/components/Logo';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Sign in' };

export default async function LoginPage({ searchParams }: { searchParams: { next?: string } }) {
  const db = await getDb();
  const n = await db.one<{ c: number }>('SELECT COUNT(*)::int AS c FROM users');
  if (!n || n.c === 0) redirect('/setup');
  if (await getSession()) redirect('/dashboard');
  const next = searchParams.next && searchParams.next.startsWith('/') && !searchParams.next.startsWith('//') ? searchParams.next : '/dashboard';
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-brand-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-brand-700/40 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-gold-500/10 blur-3xl" />
        <Brand />
        <div className="relative max-w-md">
          <h1 className="text-4xl font-semibold leading-tight">Books, stock and GST — <span className="text-gold-400">in one place.</span></h1>
          <p className="mt-4 text-brand-200">Create GST invoices, track inventory, reconcile returns and punch purchase bills with AI. Built for Indian businesses.</p>
          <ul className="mt-8 space-y-3 text-sm text-brand-100">
            {['Double-entry accounting with live Trial Balance, P&L and Balance Sheet', 'GSTR-1 and GSTR-3B ready from your invoices', 'Role-based access, audit trail and data lock', 'AI Punch: read supplier bills and post them in seconds'].map((t) => (
              <li key={t} className="flex gap-3"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-gold-400" />{t}</li>))}
          </ul>
        </div>
        <p className="relative text-xs text-brand-300">© {new Date().getFullYear()} Punch Prime</p>
      </div>
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden"><Brand light={false} /></div>
          <h2 className="text-2xl font-semibold text-slate-900">Welcome back</h2>
          <p className="mt-1 text-sm text-slate-500">Sign in to continue to your workspace.</p>
          <LoginForm next={next} />
        </div>
      </div>
    </div>
  );
}
