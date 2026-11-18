# Punch Prime 2.0

GST accounting, inventory and **AI bill punching** in one web app.
Create GST invoices, track stock, see live Profit & Loss / Balance Sheet / Trial Balance, prepare GSTR-1 and GSTR-3B, and let AI read supplier bills.

---

## 1. Run it on your computer (easiest way)

You need **Node.js** (free). If you do not have it: https://nodejs.org → download the **LTS** version → install → restart your computer.

**Windows:** double-click **`start.bat`**
**Mac / Linux:** open Terminal in this folder and run `./start.sh`

The first time it installs everything (1–2 minutes). Then your browser opens at **http://localhost:3000**.

Prefer typing commands?

```bash
npm install
npm run dev
```

On the first screen you create your Owner account and choose:
* **Explore with demo data** – a sample company with 8 months of invoices, stock, GST and AI Punch entries.
* **Set up my own company** – clean books for your real business.

Your data is saved in the `.data` folder next to the app. No database to install.
To wipe everything and start again: stop the app, then run `npm run reset`.

---

## 2. Put it live on the internet with Vercel

You need 3 free accounts: **GitHub**, **Vercel**, **Neon** (database). About 15 minutes.

**Step 1 – Upload the code to GitHub**
1. Create a new **private** repository on github.com.
2. Upload this whole folder (do *not* upload `node_modules`, `.next` or `.data` – they are ignored automatically if you use Git).

**Step 2 – Create the database (Neon)**
1. Go to https://neon.tech → sign up → **Create project**.
2. Copy the **connection string** (starts with `postgres://…`). Use the *pooled* one.

**Step 3 – Deploy on Vercel**
1. Go to https://vercel.com → **Add New → Project** → import your GitHub repository.
2. Open **Environment Variables** and add:

| Name | Value |
|------|-------|
| `DATABASE_URL` | the Neon connection string |
| `AUTH_SECRET` | any long random text, 40+ characters (e.g. mash your keyboard) |
| `ANTHROPIC_API_KEY` | *(optional)* turns on AI reading of bills – https://console.anthropic.com |

3. Click **Deploy**. When it finishes, open your Vercel link.
4. On the first screen create your Owner account. **Choose “Set up my own company”** for real use. (Demo data on a hosted database works but is shorter – about 75 days.)

Tables are created automatically on the first visit. There is nothing else to run.

---

## 3. What is inside

| Area | What you can do |
|------|-----------------|
| Vouchers | Sales invoice, purchase bill, credit note, debit note, receipt, payment, contra, journal. Edit, delete, print. |
| GST | Auto CGST/SGST/IGST from place of supply, GSTIN checksum check, GSTR-1 and GSTR-3B (with input-credit set-off), CSV download. |
| Inventory | Items, HSN, stock at weighted-average cost, low-stock alerts, blocks selling more than you have. |
| Reports | Day Book, Ledger statement, Trial Balance, Profit & Loss, Balance Sheet, Receivable/Payable ageing, Stock summary. |
| AI Punch | Upload a bill photo/PDF (or paste text) → review → one click posts a purchase and creates the supplier/items. |
| Security | Login with hashed passwords, lock-out after 5 wrong tries, 30-minute idle logout, 4 roles enforced **on the server**, full audit log, data lock for filed periods, JSON backup. |

**Roles:** Owner (everything) · Manager (vouchers, masters, GST, data lock) · Accountant (create sales/purchase/payments, AI Punch) · Viewer (read only).

## 4. Good to know (honest limits)

* **Not a filing tool.** GSTR-1 / 3B screens are *working papers* built from your books. File on the GST portal and verify the numbers.
* **No e-invoice / e-way bill** generation (needs government API access).
* **Backup is export-only** (JSON download). Restore from a backup is not built yet – for hosted use, Neon also keeps its own history.
* **Ageing** assumes your latest bills are the unpaid ones (no bill-by-bill settlement yet).
* **Forgot password?** Another Owner resets it in *Settings → Users*. If the only Owner forgets, run `npm run reset` locally; on Vercel, delete the row in the Neon table `users`.
* **Security note:** this uses Next.js 14. `npm audit` lists advisories for that line; the biggest login-bypass issue is already patched in the version used, and every page and API re-checks your login on the server. Plan an upgrade to a newer Next.js major version when convenient.

## 5. For developers

```bash
npm test          # 12 tests: GST maths, double-entry, stock, reports, locks (uses an in-memory database)
npm run build     # production build
```
Stack: Next.js 14 (App Router) · TypeScript · Tailwind · PostgreSQL (`pg`) / embedded PGlite for local · `jose` JWT cookie sessions · `bcryptjs` · Anthropic SDK.
The accounting engine lives in `src/lib/engine` and runs on the server; the browser never decides money or permissions.
