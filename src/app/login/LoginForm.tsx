'use client';
import { useState } from 'react';

export default function LoginForm({ next }: { next: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [show, setShow] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setError('');
    const f = new FormData(e.currentTarget);
    const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: f.get('username'), password: f.get('password') }) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) { setError(j.error || 'Could not sign in.'); setBusy(false); return; }
    window.location.href = next;
  }
  return (
    <form onSubmit={submit} className="mt-8 space-y-4">
      <div><label className="label" htmlFor="u">Username</label>
        <input id="u" name="username" className="input" autoComplete="username" autoFocus required placeholder="e.g. owner" /></div>
      <div><label className="label" htmlFor="p">Password</label>
        <div className="relative"><input id="p" name="password" type={show ? 'text' : 'password'} className="input pr-16" autoComplete="current-password" required />
          <button type="button" onClick={() => setShow(!show)} className="absolute inset-y-0 right-2 my-auto h-7 rounded px-2 text-xs font-medium text-brand-600 hover:bg-brand-50">{show ? 'Hide' : 'Show'}</button></div></div>
      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <button className="btn-primary w-full py-2.5" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      <p className="text-center text-xs text-slate-500">Forgot your password? Ask your Owner to reset it from <b>Settings → Users</b>.</p>
    </form>
  );
}
