import { PageHeader } from '@/components/ui';
import { CompanyForm } from '@/components/Forms';
import { pageCtx } from '@/lib/page';

export const metadata = { title: 'New company' };
export default async function NewCompany() {
  await pageCtx('company.create');
  return (<div className="mx-auto max-w-3xl"><PageHeader title="Create a company" subtitle="Each company has its own books, stock and GST." /><CompanyForm creating /></div>);
}
