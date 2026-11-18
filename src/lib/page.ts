import { redirect } from 'next/navigation';
import { getDb } from './db';
import { getSession } from './auth';
import { getCompany, listCompanies, type Company } from './engine/company';
import { can, type Action } from './permissions';
import { todayISO, addDays } from './money';

/** Load session + active company for a server page. Redirects to /login if signed out. */
export async function pageCtx(action?: Action) {
  const s = await getSession();
  if (!s) redirect('/login');
  const db = await getDb();
  const company = s.companyId ? await getCompany(db, s.companyId) : null;
  if (action && !can(s.user.role, action)) redirect('/dashboard?denied=1');
  return { db, user: s.user, company, role: s.user.role, companies: await listCompanies(db) };
}
export async function needCompany(action?: Action): Promise<Awaited<ReturnType<typeof pageCtx>> & { company: Company }> {
  const c = await pageCtx(action);
  if (!c.company) redirect('/company/new');
  return c as any;
}
const clean = (v: unknown): string | undefined => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
export function period(sp: Record<string, string | string[] | undefined>, fyStart: string) {
  const today = todayISO();
  const from = clean(sp.from) ?? fyStart;
  const to = clean(sp.to) ?? today;
  return { from, to: to < from ? from : to, today };
}
export const monthStart = (d = todayISO()) => d.slice(0, 8) + '01';
export { addDays };
