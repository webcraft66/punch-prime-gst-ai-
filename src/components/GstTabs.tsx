import { Tabs } from './ui';
export default function GstTabs({ active }: { active: string }) {
  return <Tabs active={active} items={[{ href: '/gst/gstr3b', label: 'GSTR-3B summary' }, { href: '/gst/gstr1', label: 'GSTR-1 outward supplies' }]} />;
}
