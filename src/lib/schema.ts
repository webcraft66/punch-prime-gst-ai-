/** Database schema. Plain Postgres SQL — runs on embedded PGlite (local) and any hosted Postgres (Neon, Supabase, Vercel Postgres). */
export const SCHEMA_VERSION = 1;

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS meta (key text PRIMARY KEY, value text NOT NULL);

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL UNIQUE,
  name text NOT NULL,
  email text NOT NULL DEFAULT '',
  mobile text NOT NULL DEFAULT '',
  role int NOT NULL CHECK (role BETWEEN 1 AND 4),
  pass_hash text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  fails int NOT NULL DEFAULT 0,
  locked_until timestamptz,
  last_login timestamptz,
  last_seen timestamptz,
  created_by text NOT NULL DEFAULT 'system',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_name text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  pincode text NOT NULL DEFAULT '',
  state text NOT NULL,
  state_code text NOT NULL,
  gstin text NOT NULL DEFAULT '',
  pan text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  fy_start date NOT NULL,
  bank_name text NOT NULL DEFAULT '',
  bank_account text NOT NULL DEFAULT '',
  bank_ifsc text NOT NULL DEFAULT '',
  upi text NOT NULL DEFAULT '',
  allow_negative_stock boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ledgers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  group_key text NOT NULL,
  opening numeric(16,2) NOT NULL DEFAULT 0,
  opening_type text NOT NULL DEFAULT 'Dr' CHECK (opening_type IN ('Dr','Cr')),
  system_key text,
  party_type text CHECK (party_type IN ('customer','supplier')),
  gstin text NOT NULL DEFAULT '',
  state text NOT NULL DEFAULT '',
  state_code text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  credit_days int NOT NULL DEFAULT 0,
  credit_limit numeric(16,2) NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, name)
);
CREATE UNIQUE INDEX IF NOT EXISTS ledgers_system_key ON ledgers(company_id, system_key) WHERE system_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS ledgers_company ON ledgers(company_id, group_key);

CREATE TABLE IF NOT EXISTS items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  sku text NOT NULL DEFAULT '',
  hsn text NOT NULL DEFAULT '',
  unit text NOT NULL DEFAULT 'Pcs',
  gst_rate numeric(5,2) NOT NULL DEFAULT 18,
  cess numeric(5,2) NOT NULL DEFAULT 0,
  purchase_rate numeric(16,2) NOT NULL DEFAULT 0,
  sales_rate numeric(16,2) NOT NULL DEFAULT 0,
  opening_qty numeric(16,3) NOT NULL DEFAULT 0,
  opening_rate numeric(16,2) NOT NULL DEFAULT 0,
  reorder_level numeric(16,3) NOT NULL DEFAULT 0,
  is_service boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, name)
);

CREATE TABLE IF NOT EXISTS vouchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('sales','purchase','credit_note','debit_note','receipt','payment','contra','journal')),
  number text NOT NULL,
  date date NOT NULL,
  party_id uuid REFERENCES ledgers(id),
  account_id uuid REFERENCES ledgers(id),
  ref_no text NOT NULL DEFAULT '',
  ref_date date,
  narration text NOT NULL DEFAULT '',
  place_of_supply text NOT NULL DEFAULT '',
  intra_state boolean NOT NULL DEFAULT true,
  taxable numeric(16,2) NOT NULL DEFAULT 0,
  cgst numeric(16,2) NOT NULL DEFAULT 0,
  sgst numeric(16,2) NOT NULL DEFAULT 0,
  igst numeric(16,2) NOT NULL DEFAULT 0,
  cess numeric(16,2) NOT NULL DEFAULT 0,
  round_off numeric(16,2) NOT NULL DEFAULT 0,
  total numeric(16,2) NOT NULL DEFAULT 0,
  punch_id uuid,
  created_by text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by text,
  updated_at timestamptz,
  UNIQUE (company_id, type, number)
);
CREATE INDEX IF NOT EXISTS vouchers_company_date ON vouchers(company_id, date);
CREATE INDEX IF NOT EXISTS vouchers_party ON vouchers(party_id);

CREATE TABLE IF NOT EXISTS voucher_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id uuid NOT NULL REFERENCES vouchers(id) ON DELETE CASCADE,
  seq int NOT NULL,
  item_id uuid REFERENCES items(id),
  description text NOT NULL DEFAULT '',
  hsn text NOT NULL DEFAULT '',
  unit text NOT NULL DEFAULT '',
  qty numeric(16,3) NOT NULL DEFAULT 0,
  rate numeric(16,2) NOT NULL DEFAULT 0,
  discount_pct numeric(5,2) NOT NULL DEFAULT 0,
  gst_rate numeric(5,2) NOT NULL DEFAULT 0,
  cess_rate numeric(5,2) NOT NULL DEFAULT 0,
  taxable numeric(16,2) NOT NULL DEFAULT 0,
  cgst numeric(16,2) NOT NULL DEFAULT 0,
  sgst numeric(16,2) NOT NULL DEFAULT 0,
  igst numeric(16,2) NOT NULL DEFAULT 0,
  cess numeric(16,2) NOT NULL DEFAULT 0,
  amount numeric(16,2) NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS voucher_lines_voucher ON voucher_lines(voucher_id);

CREATE TABLE IF NOT EXISTS ledger_entries (
  id bigserial PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  voucher_id uuid NOT NULL REFERENCES vouchers(id) ON DELETE CASCADE,
  date date NOT NULL,
  ledger_id uuid NOT NULL REFERENCES ledgers(id),
  debit numeric(16,2) NOT NULL DEFAULT 0,
  credit numeric(16,2) NOT NULL DEFAULT 0,
  narration text NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS le_ledger ON ledger_entries(ledger_id, date);
CREATE INDEX IF NOT EXISTS le_company_date ON ledger_entries(company_id, date);
CREATE INDEX IF NOT EXISTS le_voucher ON ledger_entries(voucher_id);

CREATE TABLE IF NOT EXISTS stock_moves (
  id bigserial PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  voucher_id uuid NOT NULL REFERENCES vouchers(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES items(id),
  date date NOT NULL,
  qty_in numeric(16,3) NOT NULL DEFAULT 0,
  qty_out numeric(16,3) NOT NULL DEFAULT 0,
  rate numeric(16,2) NOT NULL DEFAULT 0,
  kind text NOT NULL DEFAULT 'sale'
);
CREATE INDEX IF NOT EXISTS sm_item ON stock_moves(item_id, date);
CREATE INDEX IF NOT EXISTS sm_company ON stock_moves(company_id, date);

CREATE TABLE IF NOT EXISTS counters (
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  type text NOT NULL,
  fy text NOT NULL,
  last int NOT NULL DEFAULT 0,
  PRIMARY KEY (company_id, type, fy)
);

CREATE TABLE IF NOT EXISTS punches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  seq int NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  source text NOT NULL DEFAULT 'manual',
  file_name text NOT NULL DEFAULT '',
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence int NOT NULL DEFAULT 0,
  voucher_id uuid,
  note text NOT NULL DEFAULT '',
  created_by text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by text,
  reviewed_at timestamptz
);
CREATE INDEX IF NOT EXISTS punches_company ON punches(company_id, created_at DESC);

CREATE TABLE IF NOT EXISTS data_locks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  from_date date NOT NULL,
  to_date date NOT NULL,
  note text NOT NULL DEFAULT '',
  created_by text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS audit (
  id bigserial PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  user_id uuid,
  username text NOT NULL DEFAULT 'system',
  role int NOT NULL DEFAULT 0,
  company_id uuid,
  action text NOT NULL,
  detail text NOT NULL DEFAULT '',
  ip text NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS audit_at ON audit(at DESC);

ALTER TABLE companies ADD COLUMN IF NOT EXISTS owner_name text NOT NULL DEFAULT '';
`;
