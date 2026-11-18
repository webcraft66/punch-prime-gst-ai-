import { cookies } from 'next/headers';
import { z } from 'zod';
import { handle } from '@/lib/api';
import { hashPassword, setSessionCookie, signSession } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { audit } from '@/lib/audit';
import { AppError } from '@/lib/errors';
import { passwordPolicy } from '@/lib/permissions';
import { createCompany } from '@/lib/engine/company';
import { validateGstin } from '@/lib/gst';
import { seedDemo } from '@/lib/demo';

export const maxDuration = 60;
const schema = z.object({
  name: z.string().min(2).max(80), username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9._-]+$/, 'letters, numbers, . _ - only'),
  password: z.string(), email: z.string().max(100).optional().default(''),
  mode: z.enum(['demo', 'company']),
  company: z.object({ name: z.string().max(100), state: z.string(), gstin: z.string().optional().default(''), fyStart: z.string() }).optional(),
});

/** First-run only: creates the Owner account (and a company, or the demo company). */
export const POST = handle(async (req: Request) => {
  const b = schema.parse(await req.json());
  const db = await getDb();
  const bad = passwordPolicy(b.password); if (bad) throw new AppError(bad);
  if (b.mode === 'company') {
    if (!b.company?.name.trim()) throw new AppError('Enter your company name.');
    if (b.company.gstin) { const g = validateGstin(b.company.gstin); if (!g.ok) throw new AppError(`GSTIN: ${g.message}`); }
  }
  const hash = await hashPassword(b.password);
  const user = await db.tx(async (q) => {
    // lock to make the "first user" check race-free
    const n = await q.one<{ c: number }>('SELECT COUNT(*)::int AS c FROM users');
    if (n && n.c > 0) throw new AppError('Setup has already been completed. Please sign in.', 409);
    return (await q.one<any>(`INSERT INTO users (username,name,email,role,pass_hash,created_by) VALUES ($1,$2,$3,1,$4,'setup') RETURNING id, username`, [b.username.toLowerCase(), b.name.trim(), b.email, hash]))!;
  });
  const actor = { id: user.id, username: user.username, role: 1 };
  if (b.mode === 'demo') await seedDemo(db, actor, b.name.trim());
  else {
    const c = b.company!;
    await db.tx((q) => createCompany(q, { name: c.name, ownerName: b.name.trim(), state: c.state, gstin: c.gstin, pan: c.gstin ? c.gstin.slice(2, 12) : '', fyStart: c.fyStart }));
  }
  await audit(db, actor, 'SETUP', `Owner account created (${b.mode})`, null);
  setSessionCookie(cookies(), await signSession(user.id));
  return { ok: true };
});
