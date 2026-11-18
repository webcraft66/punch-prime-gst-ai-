/**
 * Database access.
 *  - If DATABASE_URL is set  -> hosted Postgres (Neon / Supabase / Vercel Postgres) through `pg`.
 *  - Otherwise               -> embedded Postgres (PGlite) stored in ./.data  (zero setup for local use).
 * The same SQL runs on both.
 */
import { SCHEMA_SQL } from './schema';

export type Row = Record<string, any>;
export interface Queryable {
  query<T = Row>(sql: string, params?: any[]): Promise<T[]>;
  one<T = Row>(sql: string, params?: any[]): Promise<T | null>;
}
export interface Db extends Queryable {
  tx<T>(fn: (q: Queryable) => Promise<T>): Promise<T>;
  mode: 'pglite' | 'postgres';
}

const g = globalThis as unknown as { __pp_db?: Promise<Db> };

function wrap(run: (sql: string, params?: any[]) => Promise<Row[]>): Queryable {
  return {
    query: async <T = Row>(sql: string, params?: any[]) => (await run(sql, params)) as T[],
    one: async <T = Row>(sql: string, params?: any[]) => ((await run(sql, params))[0] ?? null) as T | null,
  };
}

async function openPglite(): Promise<Db> {
  const { PGlite } = await import('@electric-sql/pglite');
  const path = process.env.PP_DATA_DIR || './.data/pgdata';
  const memory = process.env.PP_DB_MEMORY === '1';
  if (!memory) {
    const fs = await import('node:fs');
    fs.mkdirSync(path, { recursive: true });
  }
  const pg = new PGlite(memory ? undefined : path);
  await pg.waitReady;
  // numeric -> number, bigint -> number, date -> 'YYYY-MM-DD' (same behaviour as the hosted Postgres driver)
  const opts = { parsers: { 1700: (v: string) => parseFloat(v), 20: (v: string) => parseInt(v, 10), 1082: (v: string) => v } } as any;
  const base = wrap(async (sql, params) => (await pg.query(sql, params, opts)).rows as Row[]);
  // PGlite is single-connection: serialise transactions so they never interleave.
  let chain: Promise<unknown> = Promise.resolve();
  const db: Db = {
    ...base,
    mode: 'pglite',
    tx<T>(fn: (q: Queryable) => Promise<T>) {
      const run = chain.then(() =>
        pg.transaction(async (t) => fn(wrap(async (sql, params) => (await t.query(sql, params, opts)).rows as Row[])))
      ) as Promise<T>;
      chain = run.catch(() => undefined);
      return run;
    },
  };
  // serialise plain queries behind running transactions as well
  const origQuery = base.query;
  db.query = (async (sql: string, params?: any[]) => { await chain; return origQuery(sql, params); }) as any;
  db.one = (async (sql: string, params?: any[]) => ((await db.query(sql, params))[0] ?? null)) as any;
  return db;
}

async function openPostgres(url: string): Promise<Db> {
  const pgmod: any = await import('pg');
  const { Pool, types } = pgmod.default ?? pgmod;
  types.setTypeParser(1700, (v: string) => parseFloat(v)); // numeric -> number
  types.setTypeParser(20, (v: string) => parseInt(v, 10));  // bigint  -> number
  types.setTypeParser(1082, (v: string) => v);              // date    -> 'YYYY-MM-DD'
  const needsSsl = !/localhost|127\.0\.0\.1/.test(url) && !/sslmode=disable/.test(url);
  const pool = new Pool({
    connectionString: url,
    max: Number(process.env.PG_POOL_MAX || 3),
    idleTimeoutMillis: 20000,
    ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
  });
  const base = wrap(async (sql, params) => (await pool.query(sql, params)).rows as Row[]);
  return {
    ...base,
    mode: 'postgres',
    async tx<T>(fn: (q: Queryable) => Promise<T>) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const out = await fn(wrap(async (sql, params) => (await client.query(sql, params)).rows as Row[]));
        await client.query('COMMIT');
        return out;
      } catch (e) {
        try { await client.query('ROLLBACK'); } catch { /* ignore */ }
        throw e;
      } finally { client.release(); }
    },
  };
}

async function migrate(db: Db) {
  // Idempotent: every statement is CREATE ... IF NOT EXISTS.
  const statements = SCHEMA_SQL.split(/;\s*\n/).map((s) => s.trim()).filter(Boolean);
  for (const s of statements) await db.query(s);
}

export function getDb(): Promise<Db> {
  if (!g.__pp_db) {
    g.__pp_db = (async () => {
      const url = process.env.DATABASE_URL?.trim();
      const db = url ? await openPostgres(url) : await openPglite();
      await migrate(db);
      return db;
    })();
    g.__pp_db.catch(() => { g.__pp_db = undefined; });
  }
  return g.__pp_db;
}
