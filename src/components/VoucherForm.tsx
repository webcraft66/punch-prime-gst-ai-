'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Combo from './Combo';
import { Icon } from './Icon';
import { calcLine, GST_RATES, STATES } from '@/lib/gst';
import { amountInWords, fmtMoney, r2 } from '@/lib/money';
import { VOUCHER_LABEL, type VoucherType } from '@/lib/engine/chart';
import type { ItemOpt, LedgerOpt, PartyOpt } from '@/lib/lookups';

interface Line { key: number; itemId: string; description: string; hsn: string; unit: string; qty: string; rate: string; discountPct: string; gstRate: string }
interface JLine { key: number; ledgerId: string; debit: string; credit: string }
export interface VoucherInitial {
  id?: string; number?: string; date?: string; partyId?: string; accountId?: string; amount?: number; refNo?: string; refDate?: string; narration?: string; placeOfSupply?: string;
  lines?: { itemId: string | null; description: string; hsn: string; unit: string; qty: number; rate: number; discount_pct: number; gst_rate: number }[];
  journal?: { ledgerId: string; debit: number; credit: number }[];
}
let k = 1;
const blankLine = (): Line => ({ key: k++, itemId: '', description: '', hsn: '', unit: '', qty: '1', rate: '', discountPct: '0', gstRate: '18' });
const n = (s: string) => Number(s) || 0;

export default function VoucherForm(props: {
  type: VoucherType; today: string; company: { stateCode: string; state: string };
  parties: PartyOpt[]; items: ItemOpt[]; accounts: LedgerOpt[]; ledgers: LedgerOpt[]; initial?: VoucherInitial;
}) {
  const { type, company, initial } = props;
  const router = useRouter();
  const editing = !!initial?.id;
  const isItem = ['sales', 'purchase', 'credit_note', 'debit_note'].includes(type);
  const isSalesSide = type === 'sales' || type === 'credit_note';
  const inward = type === 'purchase' || type === 'credit_note'; // stock comes in

  const [date, setDate] = useState(initial?.date ?? props.today);
  const [partyId, setPartyId] = useState(initial?.partyId ?? '');
  const [accountId, setAccountId] = useState(initial?.accountId ?? (props.accounts[0]?.id ?? ''));
  const [amount, setAmount] = useState(initial?.amount ? String(initial.amount) : '');
  const [refNo, setRefNo] = useState(initial?.refNo ?? '');
  const [refDate, setRefDate] = useState(initial?.refDate ?? '');
  const [narration, setNarration] = useState(initial?.narration ?? '');
  const [pos, setPos] = useState(initial?.placeOfSupply ?? '');
  const [lines, setLines] = useState<Line[]>(initial?.lines?.length
    ? initial.lines.map((l) => ({ key: k++, itemId: l.itemId ?? '', description: l.description, hsn: l.hsn, unit: l.unit, qty: String(l.qty), rate: String(l.rate), discountPct: String(l.discount_pct), gstRate: String(l.gst_rate) }))
    : [blankLine()]);
  const [jl, setJl] = useState<JLine[]>(initial?.journal?.length ? initial.journal.map((j) => ({ key: k++, ledgerId: j.ledgerId, debit: j.debit ? String(j.debit) : '', credit: j.credit ? String(j.credit) : '' })) : [{ key: k++, ledgerId: '', debit: '', credit: '' }, { key: k++, ledgerId: '', debit: '', credit: '' }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const partyOpts = useMemo(() => {
    const want = isSalesSide ? 'sundry_debtors' : 'sundry_creditors';
    if (isItem) return props.parties.filter((p) => p.group === want).map((p) => ({ value: p.id, label: p.name, sub: p.gstin || undefined }));
    return props.ledgers.filter((l) => !['cash', 'bank'].includes(l.group) || type === 'contra').map((l) => ({ value: l.id, label: l.name, sub: l.group.replace(/_/g, ' ') }));
  }, [props.parties, props.ledgers, isItem, isSalesSide, type]);
  const accountOpts = props.accounts.map((a) => ({ value: a.id, label: a.name, sub: a.group }));
  const itemOpts = props.items.map((i) => ({ value: i.id, label: i.name, sub: i.isService ? 'Service' : `Stock ${i.stock} ${i.unit}` }));
  const party = props.parties.find((p) => p.id === partyId);
  const posCode = pos || party?.stateCode || company.stateCode;
  const intra = posCode === company.stateCode;

  const calc = useMemo(() => {
    const rows = lines.map((l) => calcLine({ qty: n(l.qty), rate: n(l.rate), discountPct: n(l.discountPct), gstRate: n(l.gstRate) }, intra));
    const sum = (f: (r: (typeof rows)[number]) => number) => r2(rows.reduce((a, r) => a + f(r), 0));
    const taxable = sum((r) => r.taxable), cgst = sum((r) => r.cgst), sgst = sum((r) => r.sgst), igst = sum((r) => r.igst), cess = sum((r) => r.cess);
    const exact = r2(taxable + cgst + sgst + igst + cess); const total = Math.round(exact);
    return { rows, taxable, cgst, sgst, igst, cess, roundOff: r2(total - exact), total };
  }, [lines, intra]);
  const jDr = r2(jl.reduce((a, j) => a + n(j.debit), 0)), jCr = r2(jl.reduce((a, j) => a + n(j.credit), 0));

  const setLine = (key: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  function chooseItem(key: number, id: string) {
    const it = props.items.find((i) => i.id === id); if (!it) return;
    setLine(key, { itemId: id, description: it.name, hsn: it.hsn, unit: it.unit, gstRate: String(it.gstRate), rate: String(isSalesSide ? it.salesRate : it.purchaseRate) });
  }
  const used = new Map<string, number>();
  if (!inward) for (const l of lines) if (l.itemId) used.set(l.itemId, (used.get(l.itemId) ?? 0) + n(l.qty));

  async function save(andNew: boolean) {
    setError(''); setBusy(true);
    const body: any = { type, date, narration, refNo, refDate: refDate || null };
    if (isItem) {
      body.partyId = partyId; body.placeOfSupply = posCode;
      body.lines = lines.filter((l) => l.itemId || l.description || n(l.rate)).map((l) => ({ itemId: l.itemId || null, description: l.description, hsn: l.hsn, unit: l.unit, qty: n(l.qty), rate: n(l.rate), discountPct: n(l.discountPct), gstRate: n(l.gstRate) }));
    } else if (type === 'journal') body.journal = jl.filter((j) => j.ledgerId).map((j) => ({ ledgerId: j.ledgerId, debit: n(j.debit), credit: n(j.credit) }));
    else { body.partyId = partyId; body.accountId = accountId; body.amount = n(amount); }
    const res = await fetch(editing ? `/api/vouchers/${initial!.id}` : '/api/vouchers', { method: editing ? 'PUT' : 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) { setError(j.error || 'Could not save.'); setBusy(false); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    router.push(andNew ? `/vouchers/new?type=${type}&saved=${encodeURIComponent(j.number)}` : `/vouchers/${j.id}?saved=1`);
    router.refresh();
  }

  const label = VOUCHER_LABEL[type];
  const partyLabel = type === 'receipt' ? 'Received from' : type === 'payment' ? 'Paid to' : type === 'contra' ? 'Deposit / transfer to' : isSalesSide ? 'Customer' : 'Supplier';
  const accountLabel = type === 'receipt' ? 'Deposit to (cash / bank)' : type === 'payment' ? 'Paid from (cash / bank)' : 'Transfer from';

  return (
    <form onSubmit={(e) => { e.preventDefault(); save(false); }} className="space-y-5">
      {error && <div role="alert" className="flex gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><Icon name="alert" size={18} className="mt-0.5 shrink-0" /><span>{error}</span></div>}

      <section className="card p-5">
        <div className="mb-4 flex items-center justify-between"><h2 className="text-sm font-semibold text-slate-900">{label} details</h2>{editing && <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-xs text-slate-600">{initial?.number}</span>}</div>
        <div className="grid gap-4 md:grid-cols-4">
          <div><label className="label">Date</label><input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} required /></div>
          {type !== 'journal' && (type === 'contra' ? (
            <>
              <div className="md:col-span-1"><label className="label">{accountLabel}</label><Combo options={accountOpts} value={accountId} onChange={setAccountId} /></div>
              <div className="md:col-span-1"><label className="label">{partyLabel}</label><Combo options={accountOpts} value={partyId} onChange={setPartyId} placeholder="Select account" /></div>
            </>
          ) : (
            <div className="md:col-span-2"><label className="label">{partyLabel} <span className="text-red-500">*</span></label>
              <Combo options={partyOpts} value={partyId} onChange={setPartyId} placeholder={isItem ? `Search ${isSalesSide ? 'customer' : 'supplier'}…` : 'Search ledger…'} autoFocus={!editing}
                emptyHint={isItem ? <>No {isSalesSide ? 'customers' : 'suppliers'} found. <a className="font-medium text-brand-600 underline" href="/parties?new=1" target="_blank" rel="noreferrer">Add one</a></> : undefined} /></div>
          ))}
          {isItem && (
            <div><label className="label">{type === 'purchase' ? 'Supplier invoice no.' : 'Reference'}</label><input className="input" value={refNo} onChange={(e) => setRefNo(e.target.value)} placeholder={type === 'purchase' ? 'e.g. AB/2291' : 'Optional'} /></div>)}
          {(type === 'receipt' || type === 'payment') && (<>
            <div><label className="label">{accountLabel}</label><Combo options={accountOpts} value={accountId} onChange={setAccountId} /></div>
            <div><label className="label">Amount (₹)</label><input className="input input-num" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" required /></div>
            <div><label className="label">Cheque / UTR no.</label><input className="input" value={refNo} onChange={(e) => setRefNo(e.target.value)} /></div>
          </>)}
          {type === 'contra' && <div><label className="label">Amount (₹)</label><input className="input input-num" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" required /></div>}
        </div>
        {isItem && (
          <div className="mt-4 flex flex-wrap items-end gap-4">
            <div className="w-60"><label className="label">Place of supply</label>
              <select className="input" value={posCode} onChange={(e) => setPos(e.target.value)}>{STATES.map((s) => <option key={s.code} value={s.code}>{s.code} – {s.name}</option>)}</select></div>
            <div className={`mb-0.5 rounded-lg px-3 py-2 text-xs font-medium ${intra ? 'bg-emerald-50 text-emerald-800' : 'bg-gold-100 text-gold-700'}`}>
              {intra ? 'Same state → CGST + SGST' : 'Different state → IGST'}</div>
            {party?.gstin && <div className="mb-0.5 font-mono text-xs text-slate-500">GSTIN {party.gstin}</div>}
          </div>)}
      </section>

      {isItem && (
        <section className="card overflow-visible">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3"><h2 className="text-sm font-semibold text-slate-900">Items</h2>
            <button type="button" className="btn-ghost btn-sm" onClick={() => setLines((l) => [...l, blankLine()])}><Icon name="plus" size={14} />Add row</button></div>
          <div className="overflow-x-auto"><div className="min-w-[860px]">
            <div className="grid grid-cols-[2.2fr_0.9fr_0.8fr_1fr_0.7fr_0.8fr_1.1fr_32px] gap-2 bg-slate-50 px-5 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <div>Item</div><div>HSN/SAC</div><div className="text-right">Qty</div><div className="text-right">Rate (₹)</div><div className="text-right">Disc %</div><div>GST %</div><div className="text-right">Amount</div><div /></div>
            {lines.map((l, i) => {
              const it = props.items.find((x) => x.id === l.itemId);
              const short = it && !it.isService && !inward && (used.get(it.id) ?? 0) > it.stock + (editing ? 1e9 : 0);
              return (
                <div key={l.key} className="grid grid-cols-[2.2fr_0.9fr_0.8fr_1fr_0.7fr_0.8fr_1.1fr_32px] items-start gap-2 border-t border-slate-100 px-5 py-2">
                  <div><Combo options={itemOpts} value={l.itemId} onChange={(v) => chooseItem(l.key, v)} placeholder="Search item…" />
                    {short && <div className="mt-1 text-[11px] font-medium text-red-600">Only {it!.stock} {it!.unit} in stock</div>}</div>
                  <input className="input" value={l.hsn} onChange={(e) => setLine(l.key, { hsn: e.target.value })} />
                  <div className="relative"><input className="input input-num" inputMode="decimal" value={l.qty} onChange={(e) => setLine(l.key, { qty: e.target.value })} />{l.unit && <span className="pointer-events-none absolute -bottom-4 right-1 text-[10px] text-slate-400">{l.unit}</span>}</div>
                  <input className="input input-num" inputMode="decimal" value={l.rate} onChange={(e) => setLine(l.key, { rate: e.target.value })} />
                  <input className="input input-num" inputMode="decimal" value={l.discountPct} onChange={(e) => setLine(l.key, { discountPct: e.target.value })} />
                  <select className="input px-2" value={l.gstRate} onChange={(e) => setLine(l.key, { gstRate: e.target.value })}>{GST_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}</select>
                  <div className="num pt-2 text-sm font-medium text-slate-900">{fmtMoney(calc.rows[i]?.amount ?? 0)}</div>
                  <button type="button" onClick={() => setLines((ls) => (ls.length > 1 ? ls.filter((x) => x.key !== l.key) : ls))} className="mt-1 rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label="Remove row"><Icon name="trash" size={15} /></button>
                </div>);
            })}
          </div></div>
          <div className="grid gap-6 border-t border-slate-100 bg-slate-50/60 p-5 md:grid-cols-2">
            <div><label className="label">Narration / notes</label><textarea className="input min-h-[84px]" value={narration} onChange={(e) => setNarration(e.target.value)} placeholder="Optional — shown on the invoice" />
              <p className="mt-3 text-xs italic text-slate-500">{amountInWords(calc.total)}</p></div>
            <dl className="ml-auto w-full max-w-sm space-y-1.5 text-sm">
              <div className="flex justify-between"><dt className="text-slate-500">Taxable value</dt><dd className="tabular-nums">{fmtMoney(calc.taxable)}</dd></div>
              {intra ? (<><div className="flex justify-between"><dt className="text-slate-500">CGST</dt><dd className="tabular-nums">{fmtMoney(calc.cgst)}</dd></div><div className="flex justify-between"><dt className="text-slate-500">SGST</dt><dd className="tabular-nums">{fmtMoney(calc.sgst)}</dd></div></>)
                : <div className="flex justify-between"><dt className="text-slate-500">IGST</dt><dd className="tabular-nums">{fmtMoney(calc.igst)}</dd></div>}
              {calc.cess > 0 && <div className="flex justify-between"><dt className="text-slate-500">Cess</dt><dd className="tabular-nums">{fmtMoney(calc.cess)}</dd></div>}
              <div className="flex justify-between"><dt className="text-slate-500">Round off</dt><dd className="tabular-nums">{calc.roundOff > 0 ? '+' : ''}{fmtMoney(calc.roundOff)}</dd></div>
              <div className="flex justify-between border-t border-slate-300 pt-2 text-base font-semibold text-slate-900"><dt>Total</dt><dd className="tabular-nums">₹{fmtMoney(calc.total)}</dd></div>
            </dl>
          </div>
        </section>)}

      {type === 'journal' && (
        <section className="card overflow-visible">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3"><h2 className="text-sm font-semibold text-slate-900">Journal lines</h2>
            <button type="button" className="btn-ghost btn-sm" onClick={() => setJl((x) => [...x, { key: k++, ledgerId: '', debit: '', credit: '' }])}><Icon name="plus" size={14} />Add line</button></div>
          <div className="space-y-2 p-5">
            {jl.map((j) => (
              <div key={j.key} className="grid grid-cols-[1fr_130px_130px_32px] items-center gap-2">
                <Combo options={props.ledgers.map((l) => ({ value: l.id, label: l.name, sub: l.group.replace(/_/g, ' ') }))} value={j.ledgerId} onChange={(v) => setJl((x) => x.map((r) => (r.key === j.key ? { ...r, ledgerId: v } : r)))} placeholder="Select ledger…" />
                <input className="input input-num" placeholder="Debit" inputMode="decimal" value={j.debit} onChange={(e) => setJl((x) => x.map((r) => (r.key === j.key ? { ...r, debit: e.target.value, credit: e.target.value ? '' : r.credit } : r)))} />
                <input className="input input-num" placeholder="Credit" inputMode="decimal" value={j.credit} onChange={(e) => setJl((x) => x.map((r) => (r.key === j.key ? { ...r, credit: e.target.value, debit: e.target.value ? '' : r.debit } : r)))} />
                <button type="button" onClick={() => setJl((x) => (x.length > 2 ? x.filter((r) => r.key !== j.key) : x))} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Icon name="trash" size={15} /></button>
              </div>))}
            <div className="grid grid-cols-[1fr_130px_130px_32px] gap-2 border-t border-slate-200 pt-3 text-sm font-semibold">
              <div className={`text-right ${jDr === jCr && jDr > 0 ? 'text-emerald-600' : 'text-red-600'}`}>{jDr === jCr && jDr > 0 ? '✓ Balanced' : `Difference ₹${fmtMoney(Math.abs(jDr - jCr))}`}</div>
              <div className="num pr-3">{fmtMoney(jDr)}</div><div className="num pr-3">{fmtMoney(jCr)}</div><div /></div>
          </div>
        </section>)}

      {!isItem && (
        <section className="card p-5"><label className="label">Narration</label>
          <textarea className="input min-h-[72px]" value={narration} onChange={(e) => setNarration(e.target.value)} placeholder="e.g. Being payment received against invoice…" /></section>)}

      <div className="no-print sticky bottom-0 -mx-4 flex items-center justify-end gap-3 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <button type="button" className="btn-ghost" onClick={() => router.back()}>Cancel</button>
        {!editing && <button type="button" className="btn-ghost" disabled={busy} onClick={() => save(true)}>Save &amp; new</button>}
        <button className="btn-primary min-w-32" disabled={busy}>{busy ? 'Saving…' : editing ? 'Update' : `Save ${label.toLowerCase()}`}</button>
      </div>
    </form>
  );
}
