import { NextResponse } from 'next/server';
import { AppError } from './errors';

/** Wrap an API handler: converts AppError / unexpected errors into clean JSON responses. */
export function handle<A extends any[]>(fn: (...a: A) => Promise<Response | object>) {
  return async (...args: A): Promise<Response> => {
    try {
      const out = await fn(...args);
      return out instanceof Response ? out : NextResponse.json(out);
    } catch (e: any) {
      if (e instanceof AppError) return NextResponse.json({ error: e.message }, { status: e.status });
      if (e?.name === 'ZodError') return NextResponse.json({ error: e.issues?.[0] ? `${e.issues[0].path.join('.') || 'input'}: ${e.issues[0].message}` : 'Invalid input.' }, { status: 400 });
      console.error('[api]', e);
      return NextResponse.json({ error: 'Something went wrong on the server. Please try again.' }, { status: 500 });
    }
  };
}
