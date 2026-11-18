/** AI Punch: read a supplier bill (photo / PDF / pasted text) and return structured fields. */
export interface BillItem { name: string; qty: number; rate: number; hsn: string; gstRate: number }
export interface Bill { sellerName: string; sellerGstin: string; invoiceNo: string; invoiceDate: string; items: BillItem[]; total: number; notes?: string }
export const emptyBill = (): Bill => ({ sellerName: '', sellerGstin: '', invoiceNo: '', invoiceDate: '', items: [], total: 0 });

export const aiConfigured = () => !!process.env.ANTHROPIC_API_KEY?.trim();

const TOOL = {
  name: 'record_bill',
  description: 'Record the fields read from a supplier invoice / purchase bill.',
  input_schema: {
    type: 'object' as const,
    properties: {
      sellerName: { type: 'string', description: 'Name of the seller / supplier issuing the bill' },
      sellerGstin: { type: 'string', description: "Seller's 15-character GSTIN, or empty if absent" },
      invoiceNo: { type: 'string' }, invoiceDate: { type: 'string', description: 'YYYY-MM-DD' },
      items: { type: 'array', items: { type: 'object', properties: {
        name: { type: 'string' }, qty: { type: 'number' }, rate: { type: 'number', description: 'Unit price before tax' },
        hsn: { type: 'string' }, gstRate: { type: 'number', description: 'Total GST % (e.g. 5, 12, 18, 28)' } }, required: ['name', 'qty', 'rate'] } },
      total: { type: 'number', description: 'Grand total payable on the bill' },
    },
    required: ['sellerName', 'invoiceNo', 'invoiceDate', 'items', 'total'],
  },
};

export async function extractWithClaude(input: { mime: string; base64: string } | { text: string }): Promise<Bill> {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const content: any[] = [];
  if ('text' in input) content.push({ type: 'text', text: `Supplier bill text:\n\n${input.text.slice(0, 20000)}` });
  else if (input.mime === 'application/pdf') content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: input.base64 } });
  else content.push({ type: 'image', source: { type: 'base64', media_type: input.mime, data: input.base64 } });
  content.push({ type: 'text', text: 'Read this purchase bill and call record_bill. Use unit prices before tax. If a value is not visible, leave it empty or 0 — never invent values.' });
  const msg = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5', max_tokens: 2000,
    tools: [TOOL], tool_choice: { type: 'tool', name: 'record_bill' }, messages: [{ role: 'user', content }],
  });
  const tu: any = (msg.content as any[]).find((c) => c.type === 'tool_use');
  if (!tu) throw new Error('The AI did not return any fields.');
  return normalize(tu.input);
}

function normalize(x: any): Bill {
  const n = (v: any) => { const t = Number(String(v ?? '').replace(/[^\d.\-]/g, '')); return Number.isFinite(t) ? t : 0; };
  return {
    sellerName: String(x.sellerName ?? '').trim(), sellerGstin: String(x.sellerGstin ?? '').replace(/\s/g, '').toUpperCase(),
    invoiceNo: String(x.invoiceNo ?? '').trim(), invoiceDate: /^\d{4}-\d{2}-\d{2}$/.test(x.invoiceDate ?? '') ? x.invoiceDate : '',
    items: (Array.isArray(x.items) ? x.items : []).slice(0, 100).map((i: any) => ({ name: String(i.name ?? '').trim(), qty: n(i.qty) || 1, rate: n(i.rate), hsn: String(i.hsn ?? '').replace(/\D/g, ''), gstRate: n(i.gstRate) })),
    total: n(x.total),
  };
}

/** Very small fallback for pasted text when no AI key is configured. */
export function heuristicParse(text: string): Bill {
  const b = emptyBill();
  b.sellerGstin = text.match(/\b\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]\b/)?.[0] ?? '';
  b.invoiceNo = text.match(/(?:invoice|bill|inv)\s*(?:no\.?|number|#)?\s*[:\-]?\s*([A-Z0-9][A-Z0-9\/\-]{2,})/i)?.[1] ?? '';
  const d = text.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})\b/);
  if (d) b.invoiceDate = `${d[3]}-${d[2].padStart(2, '0')}-${d[1].padStart(2, '0')}`;
  const tot = [...text.matchAll(/(?:grand\s*total|total\s*amount|net\s*payable|total)\D{0,12}([\d,]+(?:\.\d{1,2})?)/gi)].map((m) => Number(m[1].replace(/,/g, ''))).filter(Boolean);
  b.total = tot.length ? Math.max(...tot) : 0;
  b.sellerName = text.split('\n').map((l) => l.trim()).find((l) => l.length > 3 && !/invoice|bill|gstin|date/i.test(l)) ?? '';
  return b;
}
