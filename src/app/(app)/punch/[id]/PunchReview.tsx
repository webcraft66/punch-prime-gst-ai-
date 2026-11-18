'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/Icon';
import { calcLine, GST_RATES, validateGstin } from '@/lib/gst';
import { fmtMoney, r2 } from '@/lib/money';
import type { Bill } from '@/lib/ai/extract';

export default function PunchReview({ id, initial, note, source, confidence, companyState, suppliers, status }: { id: string; initial: Bill; note: string; source: string; confidence: number; companyState: string; suppliers: { name: string; gstin: string }[]; status: string }) {
  const router = useRouter();
  const [b, setB] = useState<Bill>({ ...initial, sellerName: initial.sellerName ?? '', sellerGstin: initial.sellerGstin ?? '', invoiceNo: initial.invoiceNo ?? '', invoiceDate: initial.invoiceDate ?? '', total: initial.total ?? 0, items: initial.items?.length ? initial.items.map((i) => ({ name: i.name ?? '', qty: i.qty ?? 1, rate: i.rate ?? 0, hsn: i.hsn ?? '', gstRate: i.gstRate ?? 18 })) : [{ name: '', qty: 1, rate: 0, hsn: '', gstRate: 18 }] });
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const g = b.sellerGstin.length === 15 ? validateGstin(b.sellerGstin) : null;
  const known = suppliers.find((s) => (b.sellerGstin && s.gstin === b.sellerGstin) || s.name.toLowerCase() === b.sellerName.trim().toLowerCase());
  const intra = !g?.ok || g.stateCode === companyState;
  const calc = useMemo(() => { const rows = b.items.map((i) => calcLine({ qty: i.qty, rate: i.rate, gstRate: i.gstRate }, intra)); const exact = r2(rows.reduce((a, r) => a + r.amount, 0)); return { taxable: r2(rows.reduce((a, r) => a + r.taxable, 0)), total: Math.round(exact) }; }, [b.items, intra]);
  const mismatch = b.total > 0 && Math.abs(b.total - calc.total) > 1;
  const setItem = (i: number, p: Partial<Bill['items'][number]>) => setB((x) => ({ ...x, items: x.items.map((it, k) => (k === i ? { ...it, ...p } : it)) }));
  async function approve() {
    setBusy(true); setErr('');
    const r = await fetch(`/api/punch/${id}/approve`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...b, items: b.items.filter((i) => i.name.trim()) }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setErr(j.error || 'Could not post.'); setBusy(false); return; }
    router.push(`/vouchers/${j.voucherId}?saved=1`); router.refresh();
  }
  async function reject() {
    const reason = prompt('Reason for rejecting (optional):'); if (reason === null) return;
    setBusy(true); const r = await fetch(`/api/punch/${id}/reject`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ reason }) });
    if (!r.ok) { setErr((await r.json().catch(() => ({}))).error || 'Failed'); setBusy(false); return; }
    router.push('/punch'); router.refresh();
  }
  if (status === 'rejected') return <div className="card p-6 text-sm text-slate-600">This bill was rejected. {note}</div>;
  return (
    <div className="space-y-5">
      {note && <div className="flex gap-2 rounded-lg border border-gold-300 bg-gold-50 px-4 py-3 text-sm text-slate-700"><Icon name="info" size={18} className="mt-0.5 shrink-0 text-gold-700" />{note}</div>}
      {source === 'ai' && <div className="flex items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-900"><Icon name="punch" size={16} />AI read this bill with {confidence}% of key fields found. Please verify before posting.</div>}
      {err && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{err}</div>}
      <section className="card p-5">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Supplier & invoice</h2>
        <div className="grid gap-4 md:grid-cols-4">
          <div className="md:col-span-2"><label className="label">Supplier name *</label><input className="input" value={b.sellerName} onChange={(e) => setB({ ...b, sellerName: e.target.value })} list="sups" />
            <datalist id="sups">{suppliers.map((s) => <option key={s.name} value={s.name} />)}</datalist>
            <p className={`mt-1 text-[11px] ${known ? 'text-emerald-600' : 'text-slate-500'}`}>{known ? `✓ Matches existing supplier “${known.name}”` : b.sellerName ? 'New supplier — will be created on posting' : ''}</p></div>
          <div className="md:col-span-2"><label className="label">Supplier GSTIN</label><input className="input font-mono uppercase" maxLength={15} value={b.sellerGstin} onChange={(e) => setB({ ...b, sellerGstin: e.target.value.toUpperCase() })} />
            {g && <p className={`mt-1 text-[11px] ${g.ok ? 'text-emerald-600' : 'text-red-600'}`}>{g.ok ? `✓ ${g.state}${intra ? ' · intra-state (CGST+SGST)' : ' · inter-state (IGST)'}` : g.message}</p>}</div>
          <div className="md:col-span-2"><label className="label">Invoice number *</label><input className="input" value={b.invoiceNo} onChange={(e) => setB({ ...b, invoiceNo: e.target.value })} /></div>
          <div><label className="label">Invoice date *</label><input type="date" className="input" value={b.invoiceDate} onChange={(e) => setB({ ...b, invoiceDate: e.target.value })} /></div>
          <div><label className="label">Total on bill (₹)</label><input className="input input-num" inputMode="decimal" value={b.total || ''} onChange={(e) => setB({ ...b, total: Number(e.target.value) || 0 })} /></div>
        </div>
      </section>
      <section className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3"><h2 className="text-sm font-semibold text-slate-900">Items</h2><button type="button" className="btn-ghost btn-sm" onClick={() => setB({ ...b, items: [...b.items, { name: '', qty: 1, rate: 0, hsn: '', gstRate: 18 }] })}><Icon name="plus" size={14} />Add row</button></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[720px]"><thead><tr><th className="th">Item name</th><th className="th w-24">HSN</th><th className="th w-24 text-right">Qty</th><th className="th w-32 text-right">Rate (₹)</th><th className="th w-24">GST</th><th className="th w-8" /></tr></thead>
          <tbody>{b.items.map((it, i) => (<tr key={i} className="border-t border-slate-100"><td className="p-2"><input className="input" value={it.name} onChange={(e) => setItem(i, { name: e.target.value })} /></td><td className="p-2"><input className="input" value={it.hsn} onChange={(e) => setItem(i, { hsn: e.target.value })} /></td>
            <td className="p-2"><input className="input input-num" inputMode="decimal" value={it.qty} onChange={(e) => setItem(i, { qty: Number(e.target.value) || 0 })} /></td><td className="p-2"><input className="input input-num" inputMode="decimal" value={it.rate} onChange={(e) => setItem(i, { rate: Number(e.target.value) || 0 })} /></td>
            <td className="p-2"><select className="input px-2" value={it.gstRate} onChange={(e) => setItem(i, { gstRate: Number(e.target.value) })}>{GST_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}</select></td>
            <td className="p-2"><button type="button" className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => setB({ ...b, items: b.items.length > 1 ? b.items.filter((_, k) => k !== i) : b.items })}><Icon name="trash" size={15} /></button></td></tr>))}</tbody></table></div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/60 px-5 py-4 text-sm">
          <div>{mismatch ? <span className="font-medium text-amber-700">⚠ Calculated total ₹{fmtMoney(calc.total)} differs from the bill total ₹{fmtMoney(b.total)}. Check rates, quantities and GST.</span> : <span className="text-slate-500">Taxable ₹{fmtMoney(calc.taxable)}</span>}</div>
          <div className="text-base font-semibold">Calculated total: ₹{fmtMoney(calc.total)}</div></div>
      </section>
      <div className="flex justify-end gap-3"><button className="btn-ghost text-red-600 hover:bg-red-50" onClick={reject} disabled={busy}>Reject</button><button className="btn-primary min-w-44" onClick={approve} disabled={busy}>{busy ? 'Posting…' : 'Approve & post purchase'}</button></div>
    </div>
  );
}
