import { z } from 'zod';
import { handle } from '@/lib/api';
import { hashPassword, requireSession } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { audit } from '@/lib/audit';
import { AppError } from '@/lib/errors';
import { passwordPolicy } from '@/lib/permissions';

export const POST = handle(async (req: Request) => {
  const s = await requireSession('user.manage');
  const b = z.object({ name: z.string().min(2).max(80), username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9._-]+$/, 'letters, numbers, . _ - only'), password: z.string(),
    role: z.coerce.number().int().min(1).max(4), email: z.string().max(100).optional().default(''), mobile: z.string().max(20).optional().default('') }).parse(await req.json());
  const bad = passwordPolicy(b.password); if (bad) throw new AppError(bad);
  const db = await getDb();
  if (await db.one('SELECT 1 FROM users WHERE username=$1', [b.username.toLowerCase()])) throw new AppError('That username is already taken.');
  const u = await db.one<any>('INSERT INTO users (username,name,email,mobile,role,pass_hash,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id', [b.username.toLowerCase(), b.name.trim(), b.email, b.mobile, b.role, await hashPassword(b.password), s.user.username]);
  await audit(db, s.user, 'USER_CREATE', `${b.username} (role ${b.role})`, s.companyId);
  return { id: u.id };
});
