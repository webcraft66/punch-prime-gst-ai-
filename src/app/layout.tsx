import './globals.css';
import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: { default: 'Punch Prime — GST Accounting, Inventory & AI Billing', template: '%s · Punch Prime' },
  description: 'Accounting, inventory and GST software with AI invoice punching.',
  icons: { icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%230b1f44'/%3E%3Cpath d='M10 24V8h7.2c3.4 0 5.4 1.9 5.4 4.8S20.600 17.600 17.200 17.600H13.800V24z' fill='%23f5c542'/%3E%3C/svg%3E" },
};
export const viewport: Viewport = { themeColor: '#0b1f44', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en"><body>{children}</body></html>);
}
