import { PageHeader } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { stockPosition } from '@/lib/engine/reports';
import { fmtDate, fmtMoney, fmtQty, todayISO } from '@/lib/money';
import { needCompany } from '@/lib/page';

export const metadata = { title: 'Stock summary' };
export default async function StockReport({ searchParams }: { searchParams: { to?: string } }) {
  const { db, company } = await needCompany('report.view');
  const to = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.to ?? '') ? searchParams.to! : todayISO();
  const rows = await stockPosition(db, company.id, to);
  const total = rows.reduce((a, r) => a + r.value, 0);
  return (<div><PageHeader title="Stock summary" subtitle={`As on ${fmtDate(to)} · weighted-average cost`} actions={<a className="btn-ghost" href={`/api/export/stock?to=${to}`}><Icon name="download" size={16} />CSV</a>} />
    <form className="no-print mb-4 flex items-end gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-card"><div><label className="label">As on</label><input type="date" name="to" defaultValue={to} className="input !w-44" /></div><button className="btn-primary">Apply</button></form>
    <div className="card overflow-hidden"><table className="w-full"><thead><tr><th className="th">Item</th><th className="th">HSN</th><th className="th text-right">Quantity</th><th className="th text-right">Avg cost</th><th className="th text-right">Value (₹)</th></tr></thead>
      <tbody className="divide-y divide-slate-100">{rows.map((r) => (<tr key={r.id} className="hover:bg-slate-50"><td className="td font-medium">{r.name}</td><td className="td font-mono text-xs">{r.hsn}</td><td className="td num">{fmtQty(r.qty)} {r.unit}</td><td className="td num">{fmtMoney(r.avg)}</td><td className="td num">{fmtMoney(r.value)}</td></tr>))}</tbody>
      <tfoot><tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold"><td className="td" colSpan={4}>Total stock value</td><td className="td num">{fmtMoney(total)}</td></tr></tfoot></table></div></div>);
}
