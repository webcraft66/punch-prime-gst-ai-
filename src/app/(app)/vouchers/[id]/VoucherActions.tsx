'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Icon } from '@/components/Icon';

export default function VoucherActions({ id, canEdit, canDelete }: { id: string; canEdit: boolean; canDelete: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function del() {
    if (!confirm('Delete this voucher? Ledger and stock effects will be reversed. This cannot be undone.')) return;
    setBusy(true);
    const r = await fetch(`/api/vouchers/${id}`, { method: 'DELETE' });
    if (!r.ok) { alert((await r.json().catch(() => ({}))).error || 'Could not delete.'); setBusy(false); return; }
    router.push('/vouchers'); router.refresh();
  }
  return (<>
    <button className="btn-ghost" onClick={() => window.print()}><Icon name="print" size={16} />Print</button>
    {canEdit && <Link href={`/vouchers/${id}/edit`} className="btn-ghost"><Icon name="edit" size={16} />Edit</Link>}
    {canDelete && <button className="btn-ghost text-red-600 hover:bg-red-50" onClick={del} disabled={busy}><Icon name="trash" size={16} />Delete</button>}
  </>);
}
