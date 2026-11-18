'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { STATES, validateGstin } from '@/lib/gst';
import { Icon } from './Icon';
import Modal from './Modal';

async function call(url: string, method: string, body?: unknown) {
  const r = await fetch(url, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({})); return { ok: r.ok, error: j.error as string | undefined, data: j };
}
export const Msg = ({ ok, m }: { ok?: boolean; m: string }) => m ? <div role="alert" className={`rounded-lg border px-3 py-2 text-sm ${ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'}`}>{m}</div> : null;

export function CompanyForm({ initial, creating }: { initial?: any; creating?: boolean }) {
  const router = useRouter(); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState(''); const [ok, setOk] = useState(false); const [gstin, setGstin] = useState(initial?.gstin ?? '');
  const g = gstin.length === 15 ? validateGstin(gstin) : null;
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setMsg('');
    const f = new FormData(e.currentTarget); const o: any = Object.fromEntries(f.entries()); o.gstin = gstin; o.allowNegativeStock = f.get('allowNegativeStock') === 'on';
    const r = await call('/api/company', creating ? 'POST' : 'PUT', { ...o, fyStart: o.fyStart || initial?.fy_start });
    setBusy(false); setOk(r.ok); setMsg(r.ok ? 'Saved.' : r.error!);
    if (r.ok) { if (creating) window.location.href = '/dashboard'; else router.refresh(); }
  }
  const I = (name: string, label: string, props: any = {}) => <div><label className="label">{label}</label><input name={name} className="input" defaultValue={initial?.[props.key ?? name] ?? ''} {...props.attrs} /></div>;
  return (
    <form onSubmit={submit} className="card space-y-5 p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">{I('name', 'Company name *', { attrs: { required: true } })}</div>
        <div className="sm:col-span-2">{I('ownerName', 'Owner / proprietor name', { key: 'owner_name', attrs: { placeholder: 'e.g. Shitanshu Bhushan (printed on invoices)' } })}</div>
        <div><label className="label">State *</label><select name="state" className="input" defaultValue={initial?.state ?? 'Bihar'}>{STATES.map((s) => <option key={s.code}>{s.name}</option>)}</select></div>
        <div><label className="label">GSTIN</label><input value={gstin} onChange={(e) => setGstin(e.target.value.toUpperCase())} maxLength={15} className="input font-mono uppercase" />{g && <p className={`mt-1 text-[11px] ${g.ok ? 'text-emerald-600' : 'text-red-600'}`}>{g.ok ? `✓ Valid · ${g.state}` : g.message}</p>}</div>
        {I('pan', 'PAN', { attrs: { maxLength: 10, className: 'input uppercase' } })}{I('phone', 'Phone')}{I('email', 'Email')}{I('pincode', 'Pincode', { attrs: { maxLength: 6 } })}
        <div className="sm:col-span-2">{I('address', 'Address')}</div>
        <div><label className="label">Financial year starts</label><input type="date" name="fyStart" className="input" defaultValue={initial?.fy_start ?? `${new Date().getFullYear()}-04-01`} disabled={!creating} /></div>
      </div>
      <div><h3 className="mb-3 text-sm font-semibold text-slate-900">Bank details <span className="font-normal text-slate-500">(printed on invoices)</span></h3>
        <div className="grid gap-4 sm:grid-cols-2">{I('bankName', 'Bank name', { key: 'bank_name' })}{I('bankAccount', 'Account number', { key: 'bank_account' })}{I('bankIfsc', 'IFSC', { key: 'bank_ifsc' })}{I('upi', 'UPI ID')}</div></div>
      {!creating && <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" name="allowNegativeStock" defaultChecked={initial?.allow_negative_stock} className="h-4 w-4 rounded border-slate-300" />Allow selling more than the stock on hand</label>}
      <Msg ok={ok} m={msg} /><div className="flex justify-end"><button className="btn-primary" disabled={busy}>{busy ? 'Saving…' : creating ? 'Create company' : 'Save changes'}</button></div>
    </form>
  );
}

export function PasswordForm() {
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState(''); const [ok, setOk] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget); setMsg('');
    if (f.get('next') !== f.get('again')) { setOk(false); return setMsg('New passwords do not match.'); }
    setBusy(true); const r = await call('/api/auth/password', 'POST', { current: f.get('current'), next: f.get('next') }); setBusy(false); setOk(r.ok); setMsg(r.ok ? 'Password changed.' : r.error!);
    if (r.ok) (e.target as HTMLFormElement).reset();
  }
  return (<form onSubmit={submit} className="card max-w-md space-y-4 p-6"><div><label className="label">Current password</label><input name="current" type="password" className="input" required autoComplete="current-password" /></div>
    <div><label className="label">New password</label><input name="next" type="password" className="input" required autoComplete="new-password" /><p className="mt-1 text-[11px] text-slate-500">8+ characters with a capital letter and a number.</p></div>
    <div><label className="label">Repeat new password</label><input name="again" type="password" className="input" required autoComplete="new-password" /></div><Msg ok={ok} m={msg} /><button className="btn-primary" disabled={busy}>Change password</button></form>);
}

export function UserDialog({ user, selfId, trigger }: { user?: any; selfId: string; trigger: React.ReactNode }) {
  const router = useRouter(); const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const editing = !!user; const self = user?.id === selfId;
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setErr(''); const f = new FormData(e.currentTarget);
    const r = editing
      ? await call(`/api/users/${user.id}`, 'PATCH', { name: f.get('name'), role: Number(f.get('role')), ...(f.get('password') ? { password: f.get('password') } : {}) })
      : await call('/api/users', 'POST', { name: f.get('name'), username: f.get('username'), password: f.get('password'), role: Number(f.get('role')), email: f.get('email') });
    setBusy(false); if (!r.ok) return setErr(r.error!); setOpen(false); router.refresh();
  }
  async function act(kind: 'toggle' | 'delete') {
    if (kind === 'delete' && !confirm(`Delete ${user.username}? This cannot be undone.`)) return;
    setBusy(true); const r = kind === 'delete' ? await call(`/api/users/${user.id}`, 'DELETE') : await call(`/api/users/${user.id}`, 'PATCH', { active: !user.active });
    setBusy(false); if (!r.ok) return setErr(r.error!); setOpen(false); router.refresh();
  }
  return (<><span onClick={() => setOpen(true)} className="contents">{trigger}</span>
    {open && <Modal title={editing ? `Edit ${user.username}` : 'Add user'} onClose={() => setOpen(false)}>
      <form onSubmit={submit} className="space-y-4">
        <div><label className="label">Full name</label><input name="name" className="input" defaultValue={user?.name} required autoFocus /></div>
        {!editing && <><div><label className="label">Username</label><input name="username" className="input" required minLength={3} /></div><div><label className="label">Email (optional)</label><input name="email" type="email" className="input" /></div></>}
        <div><label className="label">Role</label><select name="role" className="input" defaultValue={user?.role ?? 3} disabled={self}>{[[1, 'Owner — full control'], [2, 'Manager — vouchers, masters, GST, data lock'], [3, 'Accountant — create sales/purchase/payments, AI Punch'], [4, 'Viewer — read only']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
        <div><label className="label">{editing ? 'Reset password (leave blank to keep)' : 'Password'}</label><input name="password" type="password" className="input" required={!editing} autoComplete="new-password" /><p className="mt-1 text-[11px] text-slate-500">8+ characters with a capital letter and a number.</p></div>
        <Msg m={err} />
        <div className="flex items-center justify-between pt-1"><div className="flex gap-2">{editing && !self && <><button type="button" className="btn-ghost" onClick={() => act('toggle')} disabled={busy}>{user.active ? 'Disable' : 'Enable'}</button><button type="button" className="btn-ghost text-red-600 hover:bg-red-50" onClick={() => act('delete')} disabled={busy}><Icon name="trash" size={15} /></button></>}</div>
          <div className="flex gap-2"><button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button><button className="btn-primary" disabled={busy}>{editing ? 'Save' : 'Add user'}</button></div></div>
      </form></Modal>}</>);
}

export function LockForm({ locks }: { locks: { id: string; from_date: string; to_date: string; note: string; created_by: string }[] }) {
  const router = useRouter(); const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false);
  async function add(e: React.FormEvent<HTMLFormElement>) { e.preventDefault(); const f = new FormData(e.currentTarget); setBusy(true); const r = await call('/api/locks', 'POST', { from: f.get('from'), to: f.get('to'), note: f.get('note') }); setBusy(false); if (!r.ok) return setMsg(r.error!); setMsg(''); router.refresh(); }
  async function del(id: string) { if (!confirm('Unlock this period? Vouchers in it become editable again.')) return; await call(`/api/locks?id=${id}`, 'DELETE'); router.refresh(); }
  return (<div className="space-y-5"><form onSubmit={add} className="card flex flex-wrap items-end gap-3 p-5"><div><label className="label">Lock from</label><input type="date" name="from" className="input !w-44" required /></div><div><label className="label">Lock to</label><input type="date" name="to" className="input !w-44" required /></div>
    <div className="min-w-[12rem] flex-1"><label className="label">Note</label><input name="note" className="input" placeholder="e.g. Q1 GST filed" /></div><button className="btn-primary" disabled={busy}><Icon name="lock" size={15} />Lock period</button></form>
    <Msg m={msg} />
    <div className="card overflow-hidden">{locks.length === 0 ? <p className="px-5 py-8 text-center text-sm text-slate-400">No locked periods. Lock filed months so nobody can change them by mistake.</p> : <table className="w-full"><thead><tr><th className="th">Period</th><th className="th">Note</th><th className="th">By</th><th className="th" /></tr></thead><tbody className="divide-y divide-slate-100">{locks.map((l) => <tr key={l.id}><td className="td font-medium">{l.from_date} → {l.to_date}</td><td className="td text-slate-600">{l.note}</td><td className="td text-slate-500">{l.created_by}</td><td className="td text-right"><button className="btn-ghost btn-sm" onClick={() => del(l.id)}>Unlock</button></td></tr>)}</tbody></table>}</div></div>);
}
