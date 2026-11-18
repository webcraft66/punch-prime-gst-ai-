import type { Queryable } from './db';

export interface Actor { id: string; username: string; role: number }
export async function audit(q: Queryable, actor: Actor | null, action: string, detail = '', companyId?: string | null, ip = '') {
  try {
    await q.query(
      `INSERT INTO audit (user_id, username, role, company_id, action, detail, ip) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [actor?.id ?? null, actor?.username ?? 'system', actor?.role ?? 0, companyId ?? null, action, detail.slice(0, 500), ip]
    );
  } catch { /* auditing must never break a business action */ }
}
