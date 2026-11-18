'use client';
import { useEffect, useMemo, useRef, useState } from 'react';

export interface ComboOption { value: string; label: string; sub?: string }
/** Searchable select with keyboard support. */
export default function Combo({ options, value, onChange, placeholder = 'Select…', disabled, className = '', autoFocus, emptyHint }: {
  options: ComboOption[]; value: string | null | undefined; onChange: (v: string) => void; placeholder?: string; disabled?: boolean; className?: string; autoFocus?: boolean; emptyHint?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [hi, setHi] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const sel = options.find((o) => o.value === value);
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (t ? options.filter((o) => o.label.toLowerCase().includes(t) || (o.sub ?? '').toLowerCase().includes(t)) : options).slice(0, 80);
  }, [q, options]);
  useEffect(() => { setHi(0); }, [q, open]);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) { setOpen(false); setQ(''); } };
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
  }, []);
  const pick = (o: ComboOption) => { onChange(o.value); setOpen(false); setQ(''); };
  return (
    <div ref={box} className={`relative ${className}`}>
      <input
        className="input pr-8" disabled={disabled} autoFocus={autoFocus} placeholder={placeholder}
        value={open ? q : sel?.label ?? ''} onFocus={() => { setOpen(true); setQ(''); }}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setHi((h) => Math.min(h + 1, list.length - 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
          else if (e.key === 'Enter' && open && list[hi]) { e.preventDefault(); pick(list[hi]); }
          else if (e.key === 'Escape') { setOpen(false); setQ(''); }
        }}
      />
      <svg className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" viewBox="0 0 20 20" fill="currentColor"><path d="M5.5 7.5L10 12l4.5-4.500z" /></svg>
      {open && (
        <ul className="absolute z-30 mt-1 max-h-64 w-full min-w-[14rem] overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-pop">
          {list.length === 0 && <li className="px-3 py-2 text-sm text-slate-500">{emptyHint ?? 'No matches'}</li>}
          {list.map((o, i) => (
            <li key={o.value} onMouseDown={(e) => { e.preventDefault(); pick(o); }} onMouseEnter={() => setHi(i)}
              className={`cursor-pointer px-3 py-1.5 text-sm ${i === hi ? 'bg-brand-50 text-brand-900' : 'text-slate-700'} ${o.value === value ? 'font-semibold' : ''}`}>
              <div className="truncate">{o.label}</div>{o.sub && <div className="truncate text-[11px] text-slate-500">{o.sub}</div>}
            </li>))}
        </ul>)}
    </div>
  );
}
