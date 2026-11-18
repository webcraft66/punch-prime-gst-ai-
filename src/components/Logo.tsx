export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <defs>
        <linearGradient id="pp-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#183b76" /><stop offset="1" stopColor="#071530" /></linearGradient>
        <linearGradient id="pp-gd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fde18a" /><stop offset="1" stopColor="#e0a915" /></linearGradient>
      </defs>
      <rect width="48" height="48" rx="12" fill="url(#pp-bg)" />
      <rect x="1.5" y="1.5" width="45" height="45" rx="10.5" fill="none" stroke="#f5c542" strokeOpacity=".55" />
      <path d="M16 35V13h9.6c4.7 0 7.6 2.6 7.6 6.6s-2.9 6.6-7.6 6.6H21v8.8z" fill="url(#pp-gd)" />
      <path d="M21 18.2v4.4h4.2c1.7 0 2.7-.9 2.7-2.2s-1-2.2-2.7-2.2z" fill="#0b1f44" />
    </svg>
  );
}
export function Brand({ light = true }: { light?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <LogoMark />
      <div className="leading-tight">
        <div className={`text-[10px] font-semibold tracking-[0.18em] ${light ? 'text-brand-200' : 'text-brand-500'}`}>GST + AI</div>
        <div className={`text-[17px] font-bold tracking-wide ${light ? 'text-gold-400' : 'text-brand-900'}`}>PUNCH PRIME</div>
      </div>
    </div>
  );
}
