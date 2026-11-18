import { redirect } from 'next/navigation';
import VoucherForm from '@/components/VoucherForm';
import { PageHeader } from '@/components/ui';
import { VOUCHER_LABEL, VOUCHER_TYPES, type VoucherType } from '@/lib/engine/chart';
import { voucherLookups } from '@/lib/lookups';
import { needCompany } from '@/lib/page';
import { canCreateVoucher } from '@/lib/permissions';
import { todayISO } from '@/lib/money';

export const metadata = { title: 'New voucher' };
export default async function NewVoucher({ searchParams }: { searchParams: { type?: string; saved?: string } }) {
  const { db, company, role } = await needCompany();
  const type = (VOUCHER_TYPES as readonly string[]).includes(searchParams.type ?? '') ? (searchParams.type as VoucherType) : 'sales';
  if (!canCreateVoucher(role, type)) redirect('/vouchers?denied=1');
  const lk = await voucherLookups(db, company.id);
  return (
    <div>
      <PageHeader title={`New ${VOUCHER_LABEL[type]}`} subtitle={searchParams.saved ? <span className="font-medium text-emerald-600">✓ {searchParams.saved} saved. Create another below.</span> : 'Fill in the details and save. Accounting and stock update automatically.'} />
      <VoucherForm type={type} today={todayISO()} company={{ stateCode: company.state_code, state: company.state }} parties={lk.parties} items={lk.items} accounts={lk.accounts} ledgers={lk.all} />
    </div>
  );
}
