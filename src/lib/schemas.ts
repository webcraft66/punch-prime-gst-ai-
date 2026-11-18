import { z } from 'zod';
import { VOUCHER_TYPES } from './engine/chart';

const num = z.coerce.number().finite();
const uuidOrNull = z.union([z.string().uuid(), z.literal(''), z.null()]).optional().transform((v) => (v ? v : null));
export const lineSchema = z.object({
  itemId: uuidOrNull, description: z.string().max(300).optional(), hsn: z.string().max(10).optional(), unit: z.string().max(12).optional(),
  qty: num, rate: num, discountPct: num.optional(), gstRate: num, cessRate: num.optional(),
});
export const voucherSchema = z.object({
  type: z.enum(VOUCHER_TYPES), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid date'),
  partyId: uuidOrNull, accountId: uuidOrNull, amount: num.optional(),
  refNo: z.string().max(60).optional(), refDate: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal(''), z.null()]).optional().transform((v) => v || null),
  narration: z.string().max(500).optional(), placeOfSupply: z.string().max(2).optional(),
  lines: z.array(lineSchema).max(200).optional(),
  journal: z.array(z.object({ ledgerId: z.string().uuid(), debit: num, credit: num, narration: z.string().optional() })).max(100).optional(),
  punchId: uuidOrNull,
});

export const ledgerSchema = z.object({
  name: z.string().min(1).max(120), group: z.string(), opening: z.coerce.number().optional(), openingType: z.enum(['Dr', 'Cr']).optional(),
  gstin: z.string().max(15).optional(), stateCode: z.string().max(2).optional(), address: z.string().max(300).optional(), phone: z.string().max(20).optional(),
  email: z.string().max(100).optional(), creditDays: z.coerce.number().optional(), creditLimit: z.coerce.number().optional(),
});

export const itemSchema = z.object({
  name: z.string().min(1).max(150), sku: z.string().max(40).optional(), hsn: z.string().max(10).optional(), unit: z.string().max(12).optional(),
  gstRate: z.coerce.number().min(0).max(100).optional(), purchaseRate: z.coerce.number().min(0).optional(), salesRate: z.coerce.number().min(0).optional(),
  openingQty: z.coerce.number().min(0).optional(), openingRate: z.coerce.number().min(0).optional(), reorderLevel: z.coerce.number().min(0).optional(), isService: z.boolean().optional(),
});
