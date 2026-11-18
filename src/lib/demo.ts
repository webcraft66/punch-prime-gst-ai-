/** Demo company with ~6 months of realistic, fully balanced transactions. Uses the real voucher engine. */
import type { Db } from './db';
import { createCompany, systemLedgerIds } from './engine/company';
import { saveItem, saveLedger } from './engine/masters';
import { createVoucher, type VoucherIn } from './engine/vouchers';
import { gstinCheckChar } from './gst';
import { addDays, fyLabel, todayISO } from './money';
import type { Actor } from './audit';

const mkGstin = (sc: string, pan: string) => { const b = `${sc}${pan}1Z`; return b + gstinCheckChar(b); };
function rng(seed: number) { return () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; }; }

export async function seedDemo(db: Db, actor: Actor, ownerName = ''): Promise<string> {
  const today = todayISO();
  const y = Number(today.slice(0, 4)), m = Number(today.slice(5, 7));
  const fyStart = `${m >= 4 ? y : y - 1}-04-01`;
  const rand = rng(20260401);
  const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)];

  const companyId = await db.tx(async (q) => {
    const id = await createCompany(q, {
      name: 'Sharma Traders Pvt Ltd (Demo)', ownerName, address: '14, Fraser Road, Patna', pincode: '800001', state: 'Bihar',
      gstin: mkGstin('10', 'AABCS4521K'), pan: 'AABCS4521K', phone: '9876543210', email: 'accounts@sharmatraders.example', fyStart,
      bankName: 'State Bank of India', bankAccount: '30128877654', bankIfsc: 'SBIN0001234', upi: 'sharmatraders@sbi',
    });
    return id;
  });

  const items = [
    ['Basmati Rice 25kg', '1006', 'Bag', 5, 1850, 2150, 120], ['Refined Sunflower Oil 15L', '1512', 'Box', 5, 1720, 1980, 80],
    ['Toor Dal 30kg', '0713', 'Bag', 5, 3300, 3750, 60], ['Sugar 50kg', '1701', 'Bag', 5, 2050, 2300, 100],
    ['Notebook A4 (Pack of 12)', '4820', 'Pack', 12, 360, 480, 200], ['LED Bulb 9W (Box of 10)', '8539', 'Box', 12, 540, 720, 150],
    ['Ceiling Fan 1200mm', '8414', 'Pcs', 18, 1450, 1890, 40], ['Steel Water Bottle 1L', '7323', 'Pcs', 18, 210, 320, 250],
    ['Laundry Detergent 5kg', '3402', 'Pcs', 18, 410, 560, 90], ['Mobile Charger 20W', '8504', 'Pcs', 18, 330, 499, 180],
    ['Packed Tea 1kg', '0902', 'Pcs', 5, 290, 380, 140], ['Plastic Chair', '9401', 'Pcs', 18, 520, 690, 70],
  ] as const;
  const itemIds: { id: string; name: string; rate: number; sale: number; gst: number }[] = [];
  for (const [name, hsn, unit, gst, pr, sr, oq] of items) {
    const id = await saveItem(db, companyId, { name, hsn, unit, gstRate: gst, purchaseRate: pr, salesRate: sr, openingQty: oq, openingRate: pr, reorderLevel: 25 });
    itemIds.push({ id, name, rate: pr, sale: sr, gst });
  }
  await saveItem(db, companyId, { name: 'Delivery & Installation Service', hsn: '9954', unit: 'Service', gstRate: 18, salesRate: 500, isService: true });

  const sys = await systemLedgerIds(db, companyId);
  const bank = (await db.one<any>(`SELECT id FROM ledgers WHERE company_id=$1 AND group_key='bank'`, [companyId]))!.id;
  const openingStock = items.reduce((a, i) => a + i[6] * i[4], 0);
  const bankOpen = 650000, cashOpen = 45000, fixedAssets = 380000;

  const cust: [string, string, string, string][] = [
    ['Gupta General Store', '10', 'AAFPG7788H', 'Patna'], ['Singh Kirana & Co', '10', 'AAHFS3321C', 'Gaya'], ['Metro Supermart', '09', 'AACCM1190P', 'Lucknow'],
    ['Jha Super Bazaar', '10', 'ABCPJ4410L', 'Muzaffarpur'], ['Bengal Mart', '19', 'AAECB6023R', 'Kolkata'], ['Ravi Electricals', '20', 'AAJPR9012D', 'Ranchi'], ['Walk-in Customer', '', '', ''],
  ];
  const sup: [string, string, string][] = [['Annapurna Wholesale Foods', '10', 'AAACA5566F'], ['Delhi Agro Traders', '07', 'AABCD8890M'], ['Mumbai Home Supplies', '27', 'AAECM2210G'], ['Bright Electricals Ltd', '09', 'AABCB7731Q']];
  const custIds: string[] = [], supIds: string[] = [];
  for (const [name, sc, pan, city] of cust) {
    custIds.push(await saveLedger(db, companyId, { name, group: 'sundry_debtors', gstin: sc ? mkGstin(sc, pan) : '', stateCode: sc || '10', address: city, phone: '98' + String(Math.floor(rand() * 1e8)).padStart(8, '0'), creditDays: 30, creditLimit: 300000 }));
  }
  for (const [name, sc, pan] of sup) {
    supIds.push(await saveLedger(db, companyId, { name, group: 'sundry_creditors', gstin: mkGstin(sc, pan), stateCode: sc, creditDays: 45, phone: '97' + String(Math.floor(rand() * 1e8)).padStart(8, '0') }));
  }
  const rentId = sys.rent, salaryId = sys.salary, elecId = sys.electricity;
  // opening balances (balanced against capital)
  await db.query('UPDATE ledgers SET opening=$2, opening_type=\'Dr\' WHERE id=$1', [bank, bankOpen]);
  await db.query('UPDATE ledgers SET opening=$2, opening_type=\'Dr\' WHERE id=$1', [sys.cash, cashOpen]);
  const fa = await saveLedger(db, companyId, { name: 'Furniture & Fixtures', group: 'fixed_assets', opening: fixedAssets, openingType: 'Dr' });
  void fa;
  await db.query('UPDATE ledgers SET opening=$2, opening_type=\'Cr\' WHERE id=$1', [sys.capital, bankOpen + cashOpen + fixedAssets + openingStock]);

  const ctx = { companyId, actor };
  const make = async (v: VoucherIn) => { try { return await createVoucher(db, ctx, v); } catch (e: any) { if (!/Not enough stock/.test(e.message)) throw e; return null; } };
  let cashHeld = cashOpen;
  const owedByCust = new Map<string, number>(), owedToSup = new Map<string, number>();
  const settle = async (map: Map<string, number>, ids: string[], type: 'receipt' | 'payment', date: string, lo: number, hi: number) => {
    for (const id of ids) {
      const owed = map.get(id) ?? 0; if (owed < 500) continue;
      const amt = Math.round((owed * (lo + rand() * (hi - lo))) / 100) * 100; if (amt <= 0) continue;
      const r = await make({ type, date, partyId: id, accountId: bank, amount: amt, narration: type === 'receipt' ? 'Payment received' : 'Payment to supplier' });
      if (r) map.set(id, owed - amt);
    }
  };
  const fy = fyLabel(fyStart); void fy;
  // On a hosted database every query has network latency, so the demo covers fewer days (keeps it under serverless time limits).
  let day = process.env.DATABASE_URL ? (addDays(today, -75) > fyStart ? addDays(today, -75) : fyStart) : fyStart;
  let n = 0;
  while (day <= today) {
    const dow = new Date(day + 'T00:00:00Z').getUTCDay();
    const dom = Number(day.slice(8, 10));
    if (dom === 1) {
      await make({ type: 'payment', date: day, partyId: rentId, accountId: bank, amount: 28000, narration: 'Shop rent' });
      await make({ type: 'payment', date: day, partyId: salaryId, accountId: bank, amount: 48000, narration: 'Staff salary' });
    }
    if (dom === 12) await make({ type: 'payment', date: day, partyId: elecId, accountId: sys.cash, amount: 4200, narration: 'Electricity bill' }).then(() => { cashHeld -= 4200; });
    if (dom === 9 || dom === 24) await settle(owedByCust, custIds.slice(0, 6), 'receipt', day, 0.55, 0.85);
    if (dom === 6 || dom === 21) await settle(owedToSup, supIds, 'payment', day, 0.7, 0.95);
    if (dow === 6 && cashHeld > 80000) { const dep = Math.floor((cashHeld - 40000) / 1000) * 1000; await make({ type: 'contra', date: day, partyId: bank, accountId: sys.cash, amount: dep, narration: 'Cash deposited in bank' }); cashHeld -= dep; }
    if (dow !== 0) {
      if (rand() < 0.22) { // purchase
        const s = pick(supIds); const k = 1 + Math.floor(rand() * 3);
        const lines = Array.from({ length: k }, () => { const it = pick(itemIds); return { itemId: it.id, qty: 10 + Math.floor(rand() * 60), rate: Math.round(it.rate * (0.97 + rand() * 0.06)), gstRate: it.gst }; });
        const pv = await make({ type: 'purchase', date: day, partyId: s, lines, refNo: 'SUP-' + (1000 + n++) });
        if (pv) owedToSup.set(s, (owedToSup.get(s) ?? 0) + pv.total);
      }
      const sales = 1 + (rand() < 0.5 ? 1 : 0) + (rand() < 0.2 ? 1 : 0);
      void 0;
      for (let s = 0; s < sales; s++) {
        const c = pick(custIds); const k = 1 + Math.floor(rand() * 3);
        const lines = Array.from({ length: k }, () => { const it = pick(itemIds); return { itemId: it.id, qty: 2 + Math.floor(rand() * 18), rate: it.sale, discountPct: rand() < 0.3 ? 5 : 0, gstRate: it.gst }; });
        const sv = await make({ type: 'sales', date: day, partyId: c, lines });
        if (sv && c !== custIds[6]) owedByCust.set(c, (owedByCust.get(c) ?? 0) + sv.total);
        if (sv && c === custIds[6]) await make({ type: 'receipt', date: day, partyId: c, accountId: sys.cash, amount: sv.total, narration: 'Cash sale' }).then((r) => { if (r) cashHeld += sv.total; });
      }
      if (rand() < 0.04) { const it = pick(itemIds); await make({ type: 'credit_note', date: day, partyId: pick(custIds.slice(0, 5)), lines: [{ itemId: it.id, qty: 1 + Math.floor(rand() * 3), rate: it.sale, gstRate: it.gst }], narration: 'Goods returned' }); }
    }
    day = addDays(day, 1);
  }

  // a couple of AI-punch style entries awaiting review
  const pdata = (supplier: string, gstin: string, inv: string, total: number) => ({ sellerName: supplier, sellerGstin: gstin, invoiceNo: inv, invoiceDate: addDays(today, -1), items: [{ name: 'Basmati Rice 25kg', qty: 20, rate: Math.round(total / 21), hsn: '1006', gstRate: 5 }], total });
  for (const [i, d] of [pdata('Annapurna Wholesale Foods', mkGstin('10', 'AAACA5566F'), 'AWF/2291', 38850), pdata('Delhi Agro Traders', mkGstin('07', 'AABCD8890M'), 'DAT-8841', 52500)].entries()) {
    await db.query(`INSERT INTO punches (company_id,seq,status,source,file_name,data,confidence,created_by) VALUES ($1,$2,'pending','demo',$3,$4,$5,$6)`,
      [companyId, i + 1, `invoice-${i + 1}.jpg`, JSON.stringify(d), 91 - i * 6, actor.username]);
  }
  return companyId;
}
