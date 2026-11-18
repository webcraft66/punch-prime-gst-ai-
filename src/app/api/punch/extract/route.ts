import { handle } from '@/lib/api';
import { requireCompany } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { audit } from '@/lib/audit';
import { AppError } from '@/lib/errors';
import { aiConfigured, emptyBill, extractWithClaude, heuristicParse } from '@/lib/ai/extract';

export const maxDuration = 60;
const OK = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];

/** Accepts a bill (image / PDF) or pasted text, creates a pending punch and returns its id. */
export const POST = handle(async (req: Request) => {
  const s = await requireCompany('punch.create');
  const form = await req.formData();
  const file = form.get('file') as File | null;
  const text = String(form.get('text') ?? '').trim();
  let bill = emptyBill(), source = 'manual', note = '', fileName = '';
  if (file && file.size > 0) {
    if (!OK.includes(file.type)) throw new AppError('Upload a JPG, PNG, WebP or PDF file.');
    if (file.size > 4 * 1024 * 1024) throw new AppError('File is too large (max 4 MB). Try a smaller photo.');
    fileName = file.name.slice(0, 120);
    if (aiConfigured()) {
      try { bill = await extractWithClaude({ mime: file.type, base64: Buffer.from(await file.arrayBuffer()).toString('base64') }); source = 'ai'; }
      catch (e: any) { console.error('[punch]', e?.message); note = 'AI could not read this file — please fill the details manually.'; }
    } else note = 'AI reading is not switched on (no ANTHROPIC_API_KEY). Enter the details manually below.';
  } else if (text) {
    if (aiConfigured()) { try { bill = await extractWithClaude({ text }); source = 'ai'; } catch { bill = heuristicParse(text); source = 'text'; note = 'AI unavailable — basic text parsing used. Please check every field.'; } }
    else { bill = heuristicParse(text); source = 'text'; note = 'Basic text parsing used (no AI key). Please check every field.'; }
  } else throw new AppError('Choose a file or paste the bill text.');
  const db = await getDb();
  const filled = [bill.sellerName, bill.invoiceNo, bill.invoiceDate, bill.items.length, bill.total].filter(Boolean).length;
  const row = await db.one<{ id: string }>(
    `INSERT INTO punches (company_id,seq,status,source,file_name,data,confidence,note,created_by)
     VALUES ($1,(SELECT COALESCE(MAX(seq),0)+1 FROM punches WHERE company_id=$1),'pending',$2,$3,$4,$5,$6,$7) RETURNING id`,
    [s.companyId, source, fileName, JSON.stringify(bill), Math.round((filled / 5) * 100), note, s.user.username]);
  await audit(db, s.user, 'PUNCH_CREATE', `${fileName || 'pasted text'} (${source})`, s.companyId);
  return { id: row!.id, source, note };
});
