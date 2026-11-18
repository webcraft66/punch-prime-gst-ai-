const P: Record<string, string> = {
  dashboard: 'M3 13h8V3H3zm0 8h8v-6H3zm10 0h8V11h-8zm0-18v6h8V3z',
  vouchers: 'M7 3h10a2 2 0 0 1 2 2v16l-3-2-2 2-2-2-2 2-2-2-3 2V5a2 2 0 0 1 2-2zm1 5h8M8 12h8M8 16h5',
  parties: 'M16 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0zM4 21a8 8 0 0 1 16 0',
  items: 'M21 8l-9-5-9 5v8l9 5 9-5zM3 8l9 5 9-5M12 13v8',
  ledger: 'M5 3h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5zM9 3v18M13 8h3M13 12h3',
  reports: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  gst: 'M4 4h16v16H4zM8 9h8M8 13h5M15.500 15.500l2 2M17.500 15.500l-2 2',
  punch: 'M13 2L4 14h7l-1 8 9-12h-7z',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm7.400-3a7.400 7.400 0 0 0-.1-1.300l2-1.600-2-3.400-2.400 1a7.600 7.600 0 0 0-2.200-1.300L14.300 3h-4l-.4 2.400A7.600 7.600 0 0 0 7.700 6.700l-2.400-1-2 3.400 2 1.600a7.400 7.400 0 0 0 0 2.600l-2 1.600 2 3.400 2.400-1a7.600 7.600 0 0 0 2.200 1.300l.4 2.400h4l.4-2.400a7.600 7.600 0 0 0 2.200-1.300l2.400 1 2-3.400-2-1.600c.1-.4.100-.9.100-1.300z',
  audit: 'M9 12l2 2 4-4M12 3l8 3v6c0 4.500-3.200 8-8 9-4.800-1-8-4.500-8-9V6z',
  plus: 'M12 5v14M5 12h14',
  menu: 'M4 6h16M4 12h16M4 18h16',
  close: 'M6 6l12 12M18 6L6 18',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm9 16l-4-4',
  download: 'M12 3v12m0 0l-4-4m4 4l4-4M4 21h16',
  print: 'M7 9V3h10v6M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2M7 14h10v7H7z',
  edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  check: 'M5 12l5 5L20 7',
  alert: 'M12 9v4m0 4h.01M10.300 3.900L2.400 18a2 2 0 0 0 1.700 3h15.800a2 2 0 0 0 1.700-3L13.700 3.900a2 2 0 0 0-3.400 0z',
  chevron: 'M9 6l6 6-6 6',
  logout: 'M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3',
  upload: 'M12 16V4m0 0L8 8m4-4l4 4M4 20h16',
  building: 'M4 21V5l8-3 8 3v16M9 21v-5h6v5M9 9h.01M9 13h.01M15 9h.01M15 13h.01',
  rupee: 'M7 5h10M7 9h10M7 5c5 0 7 2 7 4s-2 4-7 4l7 7',
  wallet: 'M3 7a2 2 0 0 1 2-2h13v4M3 7v11a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1H5a2 2 0 0 1-2-2zM16 14h.01',
  box: 'M21 8l-9-5-9 5v8l9 5 9-5zM3 8l9 5 9-5M12 13v8',
  trend: 'M3 17l6-6 4 4 8-8M15 7h6v6',
  percent: 'M19 5L5 19M7.500 9a1.500 1.500 0 1 0 0-3 1.500 1.500 0 0 0 0 3zm9 9a1.500 1.500 0 1 0 0-3 1.500 1.500 0 0 0 0 3z',
  clock: 'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
  users: 'M17 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM21 20v-1a4 4 0 0 0-3-3.900M16 3.100a4 4 0 0 1 0 7.800',
  lock: 'M6 11V8a6 6 0 0 1 12 0v3M5 11h14v10H5z',
  info: 'M12 8h.01M11 12h1v5h1M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
};
export function Icon({ name, size = 18, className = '' }: { name: keyof typeof P | string; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={P[name] ?? P.info} />
    </svg>
  );
}
