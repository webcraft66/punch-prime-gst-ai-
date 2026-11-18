import { fmtCompact } from '@/lib/money';

/** Server-rendered grouped bar chart (Sales vs Purchases by month). No client JS needed. */
export function TrendChart({ data }: { data: { label: string; a: number; b: number }[] }) {
  const W = 640, H = 220, pl = 46, pb = 28, pt = 12, pr = 8;
  const max = Math.max(1, ...data.flatMap((d) => [d.a, d.b]));
  const nice = (() => { const p = Math.pow(10, Math.floor(Math.log10(max))); const m = max / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p; })();
  const iw = W - pl - pr, ih = H - pt - pb;
  const gw = iw / Math.max(1, data.length), bw = Math.min(26, gw / 3);
  const y = (v: number) => pt + ih - (v / nice) * ih;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * nice);
  if (!data.length) return <div className="flex h-[220px] items-center justify-center text-sm text-slate-400">No transactions yet</div>;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Sales and purchases by month">
      {ticks.map((t) => (<g key={t}><line x1={pl} x2={W - pr} y1={y(t)} y2={y(t)} stroke="#e2e8f0" strokeDasharray={t === 0 ? '' : '3 3'} /><text x={pl - 8} y={y(t) + 4} textAnchor="end" fontSize="10" fill="#94a3b8">{fmtCompact(t).replace('₹', '')}</text></g>))}
      {data.map((d, i) => {
        const cx = pl + gw * i + gw / 2;
        return (<g key={d.label}>
          <rect x={cx - bw - 2} y={y(d.a)} width={bw} height={Math.max(0, pl && y(0) - y(d.a))} rx="3" fill="#1f4a92"><title>{`${d.label} sales ${fmtCompact(d.a)}`}</title></rect>
          <rect x={cx + 2} y={y(d.b)} width={bw} height={Math.max(0, y(0) - y(d.b))} rx="3" fill="#f5c542"><title>{`${d.label} purchases ${fmtCompact(d.b)}`}</title></rect>
          <text x={cx} y={H - 9} textAnchor="middle" fontSize="11" fill="#64748b">{d.label}</text>
        </g>);
      })}
    </svg>
  );
}

export function HBar({ rows }: { rows: { label: string; value: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.label}>
          <div className="mb-1 flex justify-between text-xs"><span className="truncate pr-3 font-medium text-slate-700">{r.label}</span><span className="tabular-nums text-slate-500">{fmtCompact(r.value)}</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-brand-700 to-brand-400" style={{ width: `${Math.max(3, (r.value / max) * 100)}%` }} /></div>
        </div>))}
    </div>
  );
}
