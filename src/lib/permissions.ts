/** Four access levels, enforced on the server for every action. */
export const ROLE_NAME: Record<number, string> = { 1: 'Owner (Super Admin)', 2: 'Manager', 3: 'Accountant', 4: 'Viewer' };
export const ROLE_SHORT: Record<number, string> = { 1: 'Owner', 2: 'Manager', 3: 'Accountant', 4: 'Viewer' };
export const ROLE_DESC: Record<number, string> = {
  1: 'Full control: users, companies, backup, settings, deletes',
  2: 'Vouchers, masters, GST, reports, data lock. Cannot manage users',
  3: 'Create sales, purchase, payment & receipt entries and AI Punch. Cannot edit or delete',
  4: 'Read-only: dashboard and reports',
};

export type Action =
  | 'view' | 'report.view'
  | 'company.create' | 'company.edit' | 'company.delete'
  | 'user.manage'
  | 'audit.view'
  | 'master.create' | 'master.edit' | 'master.delete'
  | 'voucher.create.basic' | 'voucher.create.all' | 'voucher.edit' | 'voucher.delete'
  | 'punch.create' | 'punch.review'
  | 'datalock.manage' | 'backup' | 'settings';

const RULES: Record<Action, number[]> = {
  view: [1, 2, 3, 4], 'report.view': [1, 2, 3, 4],
  'company.create': [1, 2], 'company.edit': [1, 2], 'company.delete': [1],
  'user.manage': [1], 'audit.view': [1, 2],
  'master.create': [1, 2, 3], 'master.edit': [1, 2], 'master.delete': [1, 2],
  'voucher.create.basic': [1, 2, 3], 'voucher.create.all': [1, 2], 'voucher.edit': [1, 2], 'voucher.delete': [1, 2],
  'punch.create': [1, 2, 3], 'punch.review': [1, 2, 3],
  'datalock.manage': [1, 2], backup: [1, 2], settings: [1, 2],
};
export const can = (role: number, action: Action): boolean => (RULES[action] ?? []).includes(role);
export const BASIC_VOUCHERS = ['sales', 'purchase', 'receipt', 'payment'];
export const canCreateVoucher = (role: number, type: string): boolean =>
  can(role, 'voucher.create.all') || (can(role, 'voucher.create.basic') && BASIC_VOUCHERS.includes(type));

export function passwordPolicy(p: string): string | null {
  if (p.length < 8) return 'Password must be at least 8 characters';
  if (!/[0-9]/.test(p)) return 'Password must contain at least one number';
  if (!/[A-Z]/.test(p)) return 'Password must contain at least one capital letter';
  return null;
}
