import { cookies } from 'next/headers';
import { z } from 'zod';
import { handle } from '@/lib/api';
import { attemptLogin, setSessionCookie, signSession } from '@/lib/auth';
import { AppError } from '@/lib/errors';

export const POST = handle(async (req: Request) => {
  const b = z.object({ username: z.string().min(1).max(60), password: z.string().min(1).max(200) }).parse(await req.json());
  const r = await attemptLogin(b.username, b.password);
  if (!r.ok) throw new AppError(r.message, 401);
  setSessionCookie(cookies(), await signSession(r.uid));
  return { ok: true };
});
