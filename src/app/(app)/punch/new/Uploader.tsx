'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/Icon';

/** Shrinks big phone photos in the browser so they upload fast and stay under the 4 MB limit. */
async function shrink(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.size < 900_000) return file;
  const bmp = await createImageBitmap(file); const scale = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), 'image/jpeg', 0.82));
  return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
}
export default function Uploader({ ai }: { ai: boolean }) {
  const router = useRouter(); const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [drag, setDrag] = useState(false); const [text, setText] = useState('');
  async function go(file?: File) {
    setBusy(true); setErr('');
    try {
      const fd = new FormData();
      if (file) fd.set('file', await shrink(file)); else fd.set('text', text);
      const r = await fetch('/api/punch/extract', { method: 'POST', body: fd });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Upload failed.');
      router.push(`/punch/${j.id}`);
    } catch (e: any) { setErr(e.message); setBusy(false); }
  }
  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="lg:col-span-3">
        <div onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) go(f); }}
          onClick={() => input.current?.click()} className={`card flex cursor-pointer flex-col items-center justify-center gap-3 border-2 border-dashed px-6 py-16 text-center transition ${drag ? 'border-brand-500 bg-brand-50' : 'border-slate-300 hover:border-brand-400'}`}>
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-800 text-gold-300"><Icon name="upload" size={26} /></div>
          <div className="text-base font-semibold text-slate-900">{busy ? (ai ? 'Reading your bill with AI…' : 'Saving…') : 'Drop a bill here, or click to browse'}</div>
          <p className="text-sm text-slate-500">JPG, PNG or PDF · up to 4 MB</p>
          <input ref={input} type="file" accept="image/*,application/pdf" capture="environment" hidden onChange={(e) => e.target.files?.[0] && go(e.target.files[0])} />
        </div>
        {err && <div role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}
      </div>
      <div className="card p-5 lg:col-span-2">
        <h2 className="text-sm font-semibold text-slate-900">Or paste bill text</h2>
        <textarea className="input mt-3 min-h-[160px] font-mono text-xs" value={text} onChange={(e) => setText(e.target.value)} placeholder={'Annapurna Wholesale Foods\nGSTIN: 10AABCA5566F1Z5\nInvoice No: AWF/2291   Date: 12/11/2026\n…\nGrand Total 38,850.00'} />
        <button className="btn-primary mt-3 w-full" disabled={busy || text.trim().length < 10} onClick={() => go()}>Read text</button>
        <p className="mt-3 text-xs text-slate-500">{ai ? 'AI is switched on: photos, PDFs and text are read automatically.' : 'AI is off: you will type the details on the next screen (text paste fills what it can).'}</p>
      </div>
    </div>
  );
}
