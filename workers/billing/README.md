# clauxen-billing Worker

Server-side Razorpay orchestration + Hostinger-style invoice PDF generation.

## Deploy

```bash
cd workers/billing
npm install
npx wrangler secret put BILLING_INTERNAL_TOKEN
npx wrangler secret put RAZORPAY_KEY_ID
npx wrangler secret put RAZORPAY_KEY_SECRET
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_ANON_KEY
npm run deploy
```

Then set on Vercel (Production + Preview, sensitive):

- `BILLING_WORKER_URL=https://clauxen-billing.<subdomain>.workers.dev`
- `BILLING_INTERNAL_TOKEN=<same as worker secret>`

When `BILLING_WORKER_URL` is set, Next.js proxies Razorpay REST calls through this Worker.
Card PAN still uses Razorpay.js in the browser (PCI) — never hits our servers.

## Routes

| Method | Path | Auth |
|--------|------|------|
| GET | `/health` | public |
| POST | `/v1/razorpay/*` | internal token |
| POST | `/v1/invoices/generate` | internal token |
| GET | `/v1/invoices/:paymentId/pdf` | user JWT or internal |

## Invoice storage

Dedicated R2 bucket **`clauxen-invoices`** (binding `INVOICES`):

- Customer copy: `invoices/{userId}/{paymentId}.pdf`
- Sales archive: `invoices/sales/YYYY/MM/{paymentId}.pdf`

After PDF write, the Worker best-effort uploads the same file to Razorpay Documents (`POST /v1/documents`, purposes `opgsp_export_invoice` → `invoice`, then payment documents fallback) so compliance invoices can surface under Dashboard → Payments → Upload Invoices when the merchant product supports it.
