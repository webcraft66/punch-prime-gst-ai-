'use client';
import { useState } from 'react';
import { STATES } from '@/lib/gst';

export default function SetupForm({ defaultFy, fyLabel }: { defaultFy: string; fyLabel: string }) {
  const [mode, setMode] = useState<'demo' | 'company'>('demo');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setError('');
    const f = new FormData(e.currentTarget);
    const pw = String(f.get('password')), pw2 = String(f.get('password2'));
    if (pw !== pw2) { setError('The two passwords do not match.'); setBusy(false); return; }
    const body: any = { name: f.get('name'), username: f.get('username'), password: pw, email: f.get('email') || '', mode };
    if (mode === 'company') body.company = { name: f.get('cname'), state: f.get('state'), gstin: f.get('gstin') || '', fyStart: f.get('fy') };
    const res = await fetch('/api/auth/setup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) { setError(j.error || 'Setup failed.'); setBusy(false); return; }
    window.location.href = '/dashboard';
  }
  return (
    <form onSubmit={submit} className="space-y-8 px-8 py-7">
      <section>
        <h2 className="text-sm font-semibold text-slate-900">1. Your owner account</h2>
        <p className="mb-3 text-xs text-slate-500">The Owner has full control and can add other users later.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label">Your full name</label><input name="name" className="input" required placeholder="e.g. Rajesh Kumar" /></div>
          <div><label className="label">Username</label><input name="username" className="input" required minLength={3} placeholder="e.g. rajesh" autoComplete="username" /></div>
          <div><label className="label">Password</label><input name="password" type="password" className="input" required autoComplete="new-password" /><p className="mt-1 text-[11px] text-slate-500">8+ characters, with a capital letter and a number.</p></div>
          <div><label className="label">Confirm password</label><input name="password2" type="password" className="input" required autoComplete="new-password" /></div>
          <div className="sm:col-span-2"><label className="label">Email (optional)</label><input name="email" type="email" className="input" placeholder="you@company.com" /></div>
        </div>
      </section>
      <section>
        <h2 className="text-sm font-semibold text-slate-900">2. How do you want to start?</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {([['demo', 'Explore with demo data', 'A sample company with 6 months of invoices, stock, GST and AI Punch entries. Best for a quick tour.'], ['company', 'Set up my own company', 'Start with a clean set of books for your real business.']] as const).map(([k, t, d]) => (
            <button type="button" key={k} onClick={() => setMode(k)} className={`rounded-xl border p-4 text-left transition ${mode === k ? 'border-brand-600 bg-brand-50 ring-2 ring-brand-600/20' : 'border-slate-200 hover:border-slate-300'}`}>
              <div className="flex items-center gap-2"><span className={`h-4 w-4 rounded-full border-2 ${mode === k ? 'border-brand-700 bg-brand-700 shadow-[inset_0_0_0_3px_white]' : 'border-slate-300'}`} /><span className="text-sm font-semibold text-slate-900">{t}</span></div>
              <p className="mt-1.5 text-xs text-slate-500">{d}</p>
            </button>))}
        </div>
        {mode === 'company' && (
          <div className="mt-4 grid gap-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><label className="label">Company name</label><input name="cname" className="input" required placeholder="e.g. Kumar Enterprises" /></div>
            <div><label className="label">State</label><select name="state" className="input" defaultValue="Bihar">{STATES.map((s) => <option key={s.code}>{s.name}</option>)}</select></div>
            <div><label className="label">GSTIN (optional)</label><input name="gstin" className="input uppercase" maxLength={15} placeholder="15-character GSTIN" /></div>
            <div><label className="label">Financial year starts</label><input name="fy" type="date" className="input" defaultValue={defaultFy} required /><p className="mt-1 text-[11px] text-slate-500">FY {fyLabel}</p></div>
          </div>)}
      </section>
      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <button className="btn-primary w-full py-2.5 text-base" disabled={busy}>{busy ? (mode === 'demo' ? 'Creating demo company… this takes ~20 seconds' : 'Setting up…') : 'Create workspace →'}</button>
    </form>
  );
}
