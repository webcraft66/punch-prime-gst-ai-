import { cookies } from 'next/headers';
import { z } from 'zod';
import { handle } from '@/lib/api';
import { COMPANY_COOKIE, requireSession } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { AppError } from '@/lib/errors';

export const POST = handle(async (req: Request) => {
  await requireSession();
  const { id } = z.object({ id: z.string().uuid() }).parse(await req.json());
  const c = await (await getDb()).one('SELECT id FROM companies WHERE id=$1', [id]);
  if (!c) throw new AppError('Company not found.', 404);
  cookies().set(COMPANY_COOKIE, id, { path: '/', httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 365 });
  return { ok: true };
});
