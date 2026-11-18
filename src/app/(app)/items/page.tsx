import { Badge, Empty, PageHeader, Stat } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { ItemDialog } from '@/components/MasterForms';
import { stockPosition } from '@/lib/engine/reports';
import { fmtCompact, fmtMoney, fmtQty, todayISO } from '@/lib/money';
import { needCompany } from '@/lib/page';
import { can } from '@/lib/permissions';

export const metadata = { title: 'Items & Stock' };
export default async function ItemsPage({ searchParams }: { searchParams: { q?: string } }) {
  const { db, company, role } = await needCompany();
  const stock = await stockPosition(db, company.id, todayISO());
  const services = await db.query<any>('SELECT * FROM items WHERE company_id=$1 AND is_service ORDER BY name', [company.id]);
  const masters = await db.query<any>('SELECT * FROM items WHERE company_id=$1', [company.id]);
  const M = new Map(masters.map((m: any) => [m.id, m]));
  const q = (searchParams.q ?? '').toLowerCase();
  const rows = [...stock.map((s) => ({ ...s, m: M.get(s.id) })), ...services.map((m: any) => ({ id: m.id, name: m.name, unit: m.unit, hsn: m.hsn, reorder: 0, isService: true, qty: 0, avg: 0, value: 0, saleRate: Number(m.sales_rate), gstRate: Number(m.gst_rate), m }))]
    .filter((r) => !q || r.name.toLowerCase().includes(q) || r.hsn.includes(q)).sort((a, b) => a.name.localeCompare(b.name));
  const total = stock.reduce((a, s) => a + s.value, 0), low = stock.filter((s) => s.reorder > 0 && s.qty <= s.reorder).length;
  const canEdit = can(role, 'master.edit');
  return (
    <div>
      <PageHeader title="Items & Stock" subtitle="Products and services, with live stock at weighted-average cost."
        actions={can(role, 'master.create') && <ItemDialog trigger={<button className="btn-primary"><Icon name="plus" size={16} />Add item</button>} />} />
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <Stat label="Stock value" value={fmtCompact(total)} icon="rupee" tone="brand" />
        <Stat label="Stock items" value={String(stock.length)} sub={`${services.length} services`} icon="items" tone="slate" />
        <Stat label="Low stock" value={String(low)} sub="At or below reorder level" icon="alert" tone={low ? 'red' : 'green'} />
      </div>
      <form className="no-print mb-4 flex gap-3"><div className="relative max-w-sm flex-1"><Icon name="search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input name="q" defaultValue={searchParams.q} className="input pl-9" placeholder="Search item or HSN…" /></div><button className="btn-ghost">Search</button></form>
      <div className="card overflow-hidden">
        {rows.length === 0 ? <Empty title="No items yet" hint="Add products or services to use them in invoices." /> : (
          <div className="overflow-x-auto"><table className="w-full"><thead><tr><th className="th">Item</th><th className="th">HSN/SAC</th><th className="th text-right">GST</th><th className="th text-right">Sell rate</th><th className="th text-right">In stock</th><th className="th text-right">Avg cost</th><th className="th text-right">Value (₹)</th><th className="th" /></tr></thead>
            <tbody className="divide-y divide-slate-100">{rows.map((r: any) => {
              const isLow = !r.isService && r.reorder > 0 && r.qty <= r.reorder;
              return (<tr key={r.id} className="hover:bg-slate-50">
                <td className="td font-medium text-slate-900">{r.name}{r.isService && <Badge tone="blue"> Service</Badge>}</td><td className="td font-mono text-xs">{r.hsn || '—'}</td><td className="td num">{r.gstRate}%</td><td className="td num">{fmtMoney(r.saleRate)}</td>
                <td className={`td num font-medium ${isLow ? 'text-red-600' : ''}`}>{r.isService ? '—' : `${fmtQty(r.qty)} ${r.unit}`}{isLow && <Badge tone="red"> Low</Badge>}</td>
                <td className="td num">{r.isService ? '—' : fmtMoney(r.avg)}</td><td className="td num">{r.isService ? '—' : fmtMoney(r.value)}</td>
                <td className="td text-right">{canEdit && <ItemDialog canDelete={can(role, 'master.delete')} initial={{ id: r.id, name: r.m.name, sku: r.m.sku, hsn: r.m.hsn, unit: r.m.unit, gstRate: Number(r.m.gst_rate), purchaseRate: Number(r.m.purchase_rate), salesRate: Number(r.m.sales_rate), openingQty: Number(r.m.opening_qty), openingRate: Number(r.m.opening_rate), reorderLevel: Number(r.m.reorder_level), isService: r.m.is_service }} trigger={<button className="btn-ghost btn-sm"><Icon name="edit" size={13} />Edit</button>} />}</td></tr>);
            })}</tbody></table></div>)}
      </div>
    </div>
  );
}
