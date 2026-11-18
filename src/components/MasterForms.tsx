'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Modal from './Modal';
import { Icon } from './Icon';
import { GST_RATES, STATES, UNITS, validateGstin } from '@/lib/gst';
import { GROUPS } from '@/lib/engine/chart';

async function send(url: string, method: string, body?: unknown): Promise<{ ok: boolean; error?: string }> {
  const r = await fetch(url, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  return r.ok ? { ok: true } : { ok: false, error: j.error || 'Something went wrong.' };
}
const Err = ({ m }: { m: string }) => m ? <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{m}</div> : null;
const Footer = ({ busy, onClose, onDelete, label }: { busy: boolean; onClose: () => void; onDelete?: () => void; label: string }) => (
  <div className="flex items-center justify-between pt-2">
    <div>{onDelete && <button type="button" onClick={onDelete} className="btn-ghost text-red-600 hover:bg-red-50" disabled={busy}><Icon name="trash" size={15} />Delete</button>}</div>
    <div className="flex gap-2"><button type="button" className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={busy}>{busy ? 'Saving…' : label}</button></div>
  </div>);

export interface PartyRow { id?: string; name?: string; group?: string; gstin?: string; stateCode?: string; address?: string; phone?: string; email?: string; creditDays?: number; creditLimit?: number; opening?: number; openingType?: string }

export function PartyDialog({ initial, kind, trigger, canDelete, autoOpen }: { initial?: PartyRow; kind?: 'customer' | 'supplier'; trigger: React.ReactNode; canDelete?: boolean; autoOpen?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [gstin, setGstin] = useState(initial?.gstin ?? '');
  const [stateCode, setStateCode] = useState(initial?.stateCode || '');
  const [type, setType] = useState<'customer' | 'supplier'>(kind ?? (initial?.group === 'sundry_creditors' ? 'supplier' : 'customer'));
  useEffect(() => { if (autoOpen) setOpen(true); }, [autoOpen]);
  const g = gstin.trim().length === 15 ? validateGstin(gstin) : null;
  useEffect(() => { if (g?.ok && g.stateCode) setStateCode(g.stateCode); }, [g?.ok, g?.stateCode]); // eslint-disable-line
  const editing = !!initial?.id;
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setErr('');
    const f = new FormData(e.currentTarget);
    const body = { name: f.get('name'), group: type === 'customer' ? 'sundry_debtors' : 'sundry_creditors', gstin, stateCode, address: f.get('address'), phone: f.get('phone'), email: f.get('email'),
      creditDays: f.get('creditDays') || 0, creditLimit: f.get('creditLimit') || 0, opening: f.get('opening') || 0, openingType: f.get('openingType') || 'Dr' };
    const r = await send(editing ? `/api/ledgers/${initial!.id}` : '/api/ledgers', editing ? 'PUT' : 'POST', body);
    setBusy(false);
    if (!r.ok) return setErr(r.error!);
    setOpen(false); router.refresh();
  }
  async function del() { if (!confirm(`Delete ${initial?.name}?`)) return; setBusy(true); const r = await send(`/api/ledgers/${initial!.id}`, 'DELETE'); setBusy(false); if (!r.ok) return setErr(r.error!); setOpen(false); router.refresh(); }
  return (<>
    <span onClick={() => setOpen(true)} className="contents">{trigger}</span>
    {open && (
      <Modal title={editing ? 'Edit party' : 'Add party'} onClose={() => setOpen(false)} wide>
        <form onSubmit={submit} className="space-y-4">
          {!editing && <div className="inline-flex rounded-lg border border-slate-200 p-0.5 text-sm">{(['customer', 'supplier'] as const).map((t) => <button type="button" key={t} onClick={() => setType(t)} className={`rounded-md px-4 py-1.5 font-medium capitalize ${type === t ? 'bg-brand-800 text-white' : 'text-slate-600'}`}>{t}</button>)}</div>}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><label className="label">Name *</label><input name="name" className="input" defaultValue={initial?.name} required autoFocus /></div>
            <div><label className="label">GSTIN</label><input value={gstin} onChange={(e) => setGstin(e.target.value.toUpperCase())} maxLength={15} className="input font-mono uppercase" placeholder="Leave blank if unregistered" />
              {g && <p className={`mt-1 text-[11px] ${g.ok ? 'text-emerald-600' : 'text-red-600'}`}>{g.ok ? `✓ Valid · ${g.state}` : g.message}</p>}</div>
            <div><label className="label">State *</label><select className="input" value={stateCode} onChange={(e) => setStateCode(e.target.value)} required><option value="">Select state</option>{STATES.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}</select></div>
            <div><label className="label">Phone</label><input name="phone" className="input" defaultValue={initial?.phone} /></div>
            <div><label className="label">Email</label><input name="email" type="email" className="input" defaultValue={initial?.email} /></div>
            <div className="sm:col-span-2"><label className="label">Address / city</label><input name="address" className="input" defaultValue={initial?.address} /></div>
            <div><label className="label">Credit days</label><input name="creditDays" type="number" min={0} className="input" defaultValue={initial?.creditDays ?? 30} /></div>
            <div><label className="label">Credit limit (₹)</label><input name="creditLimit" type="number" min={0} className="input" defaultValue={initial?.creditLimit ?? 0} /></div>
            <div><label className="label">Opening balance (₹)</label><input name="opening" type="number" min={0} step="0.01" className="input" defaultValue={initial?.opening ?? 0} /></div>
            <div><label className="label">Opening type</label><select name="openingType" className="input" defaultValue={initial?.openingType ?? (type === 'customer' ? 'Dr' : 'Cr')}><option value="Dr">Dr (they owe you)</option><option value="Cr">Cr (you owe them)</option></select></div>
          </div>
          <Err m={err} /><Footer busy={busy} onClose={() => setOpen(false)} onDelete={editing && canDelete ? del : undefined} label={editing ? 'Save changes' : 'Add party'} />
        </form>
      </Modal>)}
  </>);
}

export interface ItemRow { id?: string; name?: string; sku?: string; hsn?: string; unit?: string; gstRate?: number; purchaseRate?: number; salesRate?: number; openingQty?: number; openingRate?: number; reorderLevel?: number; isService?: boolean }
export function ItemDialog({ initial, trigger, canDelete }: { initial?: ItemRow; trigger: React.ReactNode; canDelete?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const [service, setService] = useState(!!initial?.isService);
  const editing = !!initial?.id;
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setErr('');
    const f = new FormData(e.currentTarget);
    const r = await send(editing ? `/api/items/${initial!.id}` : '/api/items', editing ? 'PUT' : 'POST', {
      name: f.get('name'), sku: f.get('sku'), hsn: f.get('hsn'), unit: f.get('unit'), gstRate: f.get('gstRate'), purchaseRate: f.get('purchaseRate'), salesRate: f.get('salesRate'),
      openingQty: f.get('openingQty') || 0, openingRate: f.get('openingRate') || 0, reorderLevel: f.get('reorderLevel') || 0, isService: service });
    setBusy(false); if (!r.ok) return setErr(r.error!); setOpen(false); router.refresh();
  }
  async function del() { if (!confirm(`Delete ${initial?.name}?`)) return; setBusy(true); const r = await send(`/api/items/${initial!.id}`, 'DELETE'); setBusy(false); if (!r.ok) return setErr(r.error!); setOpen(false); router.refresh(); }
  return (<>
    <span onClick={() => setOpen(true)} className="contents">{trigger}</span>
    {open && (
      <Modal title={editing ? 'Edit item' : 'Add item'} onClose={() => setOpen(false)} wide>
        <form onSubmit={submit} className="space-y-4">
          <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={service} onChange={(e) => setService(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-brand-700" />This is a service (no stock tracking)</label>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2"><label className="label">Item name *</label><input name="name" className="input" defaultValue={initial?.name} required autoFocus /></div>
            <div><label className="label">SKU / code</label><input name="sku" className="input" defaultValue={initial?.sku} /></div>
            <div><label className="label">HSN / SAC</label><input name="hsn" className="input font-mono" defaultValue={initial?.hsn} inputMode="numeric" placeholder="4–8 digits" /></div>
            <div><label className="label">Unit</label><select name="unit" className="input" defaultValue={initial?.unit ?? (service ? 'Service' : 'Pcs')}>{UNITS.map((u) => <option key={u}>{u}</option>)}</select></div>
            <div><label className="label">GST rate</label><select name="gstRate" className="input" defaultValue={initial?.gstRate ?? 18}>{GST_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}</select></div>
            <div><label className="label">Purchase rate (₹)</label><input name="purchaseRate" type="number" step="0.01" min={0} className="input" defaultValue={initial?.purchaseRate ?? 0} /></div>
            <div><label className="label">Selling rate (₹)</label><input name="salesRate" type="number" step="0.01" min={0} className="input" defaultValue={initial?.salesRate ?? 0} /></div>
            {!service && (<>
              <div><label className="label">Reorder level</label><input name="reorderLevel" type="number" step="0.001" min={0} className="input" defaultValue={initial?.reorderLevel ?? 0} /></div>
              <div><label className="label">Opening quantity</label><input name="openingQty" type="number" step="0.001" min={0} className="input" defaultValue={initial?.openingQty ?? 0} /></div>
              <div><label className="label">Opening rate (₹)</label><input name="openingRate" type="number" step="0.01" min={0} className="input" defaultValue={initial?.openingRate ?? 0} /></div></>)}
          </div>
          <Err m={err} /><Footer busy={busy} onClose={() => setOpen(false)} onDelete={editing && canDelete ? del : undefined} label={editing ? 'Save changes' : 'Add item'} />
        </form>
      </Modal>)}
  </>);
}

export function LedgerDialog({ initial, trigger, canDelete, system }: { initial?: { id?: string; name?: string; group?: string; opening?: number; openingType?: string }; trigger: React.ReactNode; canDelete?: boolean; system?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const editing = !!initial?.id;
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setErr('');
    const f = new FormData(e.currentTarget);
    const r = await send(editing ? `/api/ledgers/${initial!.id}` : '/api/ledgers', editing ? 'PUT' : 'POST',
      { name: system ? initial!.name : f.get('name'), group: system ? initial!.group : f.get('group'), opening: f.get('opening') || 0, openingType: f.get('openingType') });
    setBusy(false); if (!r.ok) return setErr(r.error!); setOpen(false); router.refresh();
  }
  async function del() { if (!confirm(`Delete ${initial?.name}?`)) return; setBusy(true); const r = await send(`/api/ledgers/${initial!.id}`, 'DELETE'); setBusy(false); if (!r.ok) return setErr(r.error!); setOpen(false); router.refresh(); }
  return (<>
    <span onClick={() => setOpen(true)} className="contents">{trigger}</span>
    {open && (
      <Modal title={editing ? (system ? `Opening balance · ${initial?.name}` : 'Edit account') : 'Add account'} onClose={() => setOpen(false)}>
        <form onSubmit={submit} className="space-y-4">
          {!system && <><div><label className="label">Account name *</label><input name="name" className="input" defaultValue={initial?.name} required autoFocus /></div>
            <div><label className="label">Group *</label><select name="group" className="input" defaultValue={initial?.group ?? 'indirect_expense'}>{GROUPS.filter((g) => !['sundry_debtors', 'sundry_creditors'].includes(g.key)).map((g) => <option key={g.key} value={g.key}>{g.name}</option>)}</select>
              <p className="mt-1 text-[11px] text-slate-500">Customers and suppliers are added from the Parties page.</p></div></>}
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Opening balance (₹)</label><input name="opening" type="number" min={0} step="0.01" className="input" defaultValue={initial?.opening ?? 0} /></div>
            <div><label className="label">Dr / Cr</label><select name="openingType" className="input" defaultValue={initial?.openingType ?? 'Dr'}><option value="Dr">Dr (debit)</option><option value="Cr">Cr (credit)</option></select></div>
          </div>
          <Err m={err} /><Footer busy={busy} onClose={() => setOpen(false)} onDelete={editing && canDelete && !system ? del : undefined} label={editing ? 'Save' : 'Add account'} />
        </form>
      </Modal>)}
  </>);
}
