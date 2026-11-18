import { redirect } from 'next/navigation';
import { getDb } from '@/lib/db';
import SetupForm from './SetupForm';
import { Brand } from '@/components/Logo';
import { fyLabel, todayISO } from '@/lib/money';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Set up Punch Prime' };

export default async function SetupPage() {
  const db = await getDb();
  const n = await db.one<{ c: number }>('SELECT COUNT(*)::int AS c FROM users');
  if (n && n.c > 0) redirect('/login');
  const t = todayISO(); const y = Number(t.slice(0, 4)); const fy = Number(t.slice(5, 7)) >= 4 ? y : y - 1;
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-950 via-brand-900 to-brand-800 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex justify-center"><Brand /></div>
        <div className="card overflow-hidden shadow-pop">
          <div className="border-b border-slate-100 bg-slate-50 px-8 py-5">
            <h1 className="text-xl font-semibold text-slate-900">Welcome! Let’s set up your workspace</h1>
            <p className="mt-1 text-sm text-slate-500">This takes about a minute. You only do this once.</p>
          </div>
          <SetupForm defaultFy={`${fy}-04-01`} fyLabel={fyLabel(`${fy}-04-01`)} />
        </div>
      </div>
    </div>
  );
}
