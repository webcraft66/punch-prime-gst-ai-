'use client';
import { useState } from 'react';
export default function DemoButton() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function go() {
    setBusy(true); setErr('');
    const r = await fetch('/api/demo', { method: 'POST' });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setErr(j.error || 'Could not load demo data.'); setBusy(false); return; }
    window.location.href = '/dashboard';
  }
  return (<div className="text-right"><button onClick={go} disabled={busy} className="btn-gold">{busy ? 'Loading demo… ~20s' : '⚡ Load demo data'}</button>{err && <div className="mt-1 text-xs text-red-600">{err}</div>}</div>);
}
