import { notFound, redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui';
import { needCompany } from '@/lib/page';
import type { Bill } from '@/lib/ai/extract';
import PunchReview from './PunchReview';

export const metadata = { title: 'Review bill' };
export default async function PunchPage({ params }: { params: { id: string } }) {
  const { db, company } = await needCompany('punch.review');
  const p = await db.one<any>('SELECT * FROM punches WHERE id=$1 AND company_id=$2', [params.id, company.id]);
  if (!p) notFound();
  if (p.voucher_id) redirect(`/vouchers/${p.voucher_id}`);
  const sups = await db.query<any>(`SELECT name, gstin FROM ledgers WHERE company_id=$1 AND group_key='sundry_creditors'`, [company.id]);
  return (<div><PageHeader title={`Review bill #${p.seq}`} subtitle={p.file_name ? `From ${p.file_name}` : 'Entered manually'} />
    <PunchReview id={p.id} initial={p.data as Bill} note={p.note} source={p.source} confidence={p.confidence} companyState={company.state_code} suppliers={sups.map((s: any) => ({ name: s.name, gstin: s.gstin }))} status={p.status} /></div>);
}
