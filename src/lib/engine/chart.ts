/** Chart of accounts: fixed account groups + the system ledgers created for every company. */
export type Nature = 'asset' | 'liability' | 'income' | 'expense';
export interface Group { key: string; name: string; nature: Nature; /** shown under Trading (direct) or P&L (indirect) */ direct?: boolean }

export const GROUPS: Group[] = [
  { key: 'capital', name: 'Capital Account', nature: 'liability' },
  { key: 'reserves', name: 'Reserves & Surplus', nature: 'liability' },
  { key: 'loans', name: 'Loans (Liability)', nature: 'liability' },
  { key: 'current_liab', name: 'Current Liabilities', nature: 'liability' },
  { key: 'duties_taxes', name: 'Duties & Taxes', nature: 'liability' },
  { key: 'sundry_creditors', name: 'Sundry Creditors', nature: 'liability' },
  { key: 'fixed_assets', name: 'Fixed Assets', nature: 'asset' },
  { key: 'investments', name: 'Investments', nature: 'asset' },
  { key: 'current_assets', name: 'Current Assets', nature: 'asset' },
  { key: 'stock', name: 'Stock-in-Hand', nature: 'asset' },
  { key: 'sundry_debtors', name: 'Sundry Debtors', nature: 'asset' },
  { key: 'cash', name: 'Cash-in-Hand', nature: 'asset' },
  { key: 'bank', name: 'Bank Accounts', nature: 'asset' },
  { key: 'sales', name: 'Sales Accounts', nature: 'income', direct: true },
  { key: 'direct_income', name: 'Direct Incomes', nature: 'income', direct: true },
  { key: 'indirect_income', name: 'Indirect Incomes', nature: 'income' },
  { key: 'purchase', name: 'Purchase Accounts', nature: 'expense', direct: true },
  { key: 'direct_expense', name: 'Direct Expenses', nature: 'expense', direct: true },
  { key: 'indirect_expense', name: 'Indirect Expenses', nature: 'expense' },
];
export const GROUP = Object.fromEntries(GROUPS.map((g) => [g.key, g])) as Record<string, Group>;
export const groupName = (k: string) => GROUP[k]?.name ?? k;
export const isDebitNature = (k: string) => { const n = GROUP[k]?.nature; return n === 'asset' || n === 'expense'; };

export interface SystemLedger { key: string; name: string; group: string }
export const SYSTEM_LEDGERS: SystemLedger[] = [
  { key: 'cash', name: 'Cash', group: 'cash' },
  { key: 'capital', name: 'Capital Account', group: 'capital' },
  { key: 'stock', name: 'Stock-in-Hand', group: 'stock' },
  { key: 'sales', name: 'Sales', group: 'sales' },
  { key: 'sales_return', name: 'Sales Returns', group: 'sales' },
  { key: 'purchase', name: 'Purchases', group: 'purchase' },
  { key: 'purchase_return', name: 'Purchase Returns', group: 'purchase' },
  { key: 'out_cgst', name: 'Output CGST', group: 'duties_taxes' },
  { key: 'out_sgst', name: 'Output SGST', group: 'duties_taxes' },
  { key: 'out_igst', name: 'Output IGST', group: 'duties_taxes' },
  { key: 'out_cess', name: 'Output Cess', group: 'duties_taxes' },
  { key: 'in_cgst', name: 'Input CGST', group: 'duties_taxes' },
  { key: 'in_sgst', name: 'Input SGST', group: 'duties_taxes' },
  { key: 'in_igst', name: 'Input IGST', group: 'duties_taxes' },
  { key: 'in_cess', name: 'Input Cess', group: 'duties_taxes' },
  { key: 'round_off', name: 'Round Off', group: 'indirect_expense' },
  { key: 'rent', name: 'Rent', group: 'indirect_expense' },
  { key: 'salary', name: 'Salary & Wages', group: 'indirect_expense' },
  { key: 'electricity', name: 'Electricity Charges', group: 'indirect_expense' },
  { key: 'office', name: 'Office Expenses', group: 'indirect_expense' },
  { key: 'interest_income', name: 'Interest Received', group: 'indirect_income' },
];

export const VOUCHER_TYPES = ['sales', 'purchase', 'credit_note', 'debit_note', 'receipt', 'payment', 'contra', 'journal'] as const;
export type VoucherType = (typeof VOUCHER_TYPES)[number];
export const VOUCHER_LABEL: Record<VoucherType, string> = {
  sales: 'Sales Invoice', purchase: 'Purchase Bill', credit_note: 'Credit Note', debit_note: 'Debit Note',
  receipt: 'Receipt', payment: 'Payment', contra: 'Contra', journal: 'Journal',
};
export const VOUCHER_PREFIX: Record<VoucherType, string> = {
  sales: 'INV', purchase: 'PUR', credit_note: 'CN', debit_note: 'DN', receipt: 'RCT', payment: 'PAY', contra: 'CON', journal: 'JV',
};
export const ITEM_TYPES: VoucherType[] = ['sales', 'purchase', 'credit_note', 'debit_note'];
