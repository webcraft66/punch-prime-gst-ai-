import { notFound } from 'next/navigation';
import VoucherForm from '@/components/VoucherForm';
import { PageHeader } from '@/components/ui';
import { VOUCHER_LABEL } from '@/lib/engine/chart';
import { voucherLookups } from '@/lib/lookups';
import { needCompany } from '@/lib/page';
import { getVoucher } from '@/lib/engine/vouchers';
import { todayISO } from '@/lib/money';

export const metadata = { title: 'Edit voucher' };
export default async function EditVoucher({ params }: { params: { id: string } }) {
  const { db, company } = await needCompany('voucher.edit');
  const v = await getVoucher(db, company.id, params.id);
  if (!v) notFound();
  const lk = await voucherLookups(db, company.id);
  const journal = v.type === 'journal' ? v.entries.map((e: any) => ({ ledgerId: lk.all.find((l) => l.name === e.ledger)?.id ?? '', debit: e.debit, credit: e.credit })) : undefined;
  return (
    <div>
      <PageHeader title={`Edit ${VOUCHER_LABEL[v.type as keyof typeof VOUCHER_LABEL]}`} subtitle="Changes are recorded in the audit log." />
      <VoucherForm type={v.type} today={todayISO()} company={{ stateCode: company.state_code, state: company.state }} parties={lk.parties} items={lk.items} accounts={lk.accounts} ledgers={lk.all}
        initial={{ id: v.id, number: v.number, date: v.date, partyId: v.party_id ?? '', accountId: v.account_id ?? (v.type === 'receipt' || v.type === 'payment' || v.type === 'contra' ? lk.all.find((l) => l.name === v.entries.find((e: any) => (v.type === 'receipt' ? e.debit > 0 : e.credit > 0))?.ledger)?.id : '') ?? '',
          amount: v.type === 'receipt' || v.type === 'payment' || v.type === 'contra' ? Number(v.total) : undefined, refNo: v.ref_no, refDate: v.ref_date ?? '', narration: v.narration, placeOfSupply: v.place_of_supply,
          lines: v.lines.map((l: any) => ({ itemId: l.item_id, description: l.description, hsn: l.hsn, unit: l.unit, qty: Number(l.qty), rate: Number(l.rate), discount_pct: Number(l.discount_pct), gst_rate: Number(l.gst_rate) })), journal }} />
    </div>
  );
}
