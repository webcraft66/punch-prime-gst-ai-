import AppShell from '@/components/AppShell';
import { pageCtx } from '@/lib/page';
import { fyLabel } from '@/lib/money';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, company, companies } = await pageCtx();
  return (
    <AppShell
      user={{ name: user.name, username: user.username, role: user.role }}
      company={company ? { id: company.id, name: company.name, gstin: company.gstin, fy: fyLabel(company.fy_start) } : null}
      companies={companies.map((c) => ({ id: c.id, name: c.name }))}
    >{children}</AppShell>
  );
}
