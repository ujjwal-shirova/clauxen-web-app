# Billing and Checkout

## 1. Overview

Clauxen billing is **Razorpay**-based (customer-facing brand: **shirova**):

- Hosted checkout sessions at `/checkout/shirova/cs_live_…` (HMAC-signed, multi-tab)
- Card payments via **Custom Checkout** (`razorpay.js` + `createPayment`) — PAN/CVV never hit our API
- Netbanking (INR) via Custom Checkout `createPayment({ method: "netbanking", bank })` — activated banks only
- UPI (INR) via Razorpay UPI QR Codes API + custom QR modal + poll
- UPI billing address: **full form in one view** (name, country, lines, city, PIN, state) — no Google Places, no progressive expand
- Apple Pay express still uses Standard Checkout when available
- Invoices list, gift purchase + redeem; PDF archived to R2 (`invoices/{userId}/…` + `invoices/sales/YYYY/MM/…`)
- Webhook-driven activation (`/api/v1/webhooks/razorpay`)
- Checkout session TTL: **6 hours** (`cs_live_…`)

Plans live in Postgres `plans` (seeded by migrations including personal catalog + Pro yearly 20%).

---

## 2. Key files

| Path | Role |
|---|---|
| `src/backend/billing/razorpay.ts` | Orders, QR create/fetch/close, signature verify |
| `src/backend/billing/checkout-session.ts` | `cs_live_` mint/verify; merchant `shirova`; `returnPath` |
| `src/backend/billing/checkout-pricing.ts` | Price math |
| `src/backend/billing/checkout-currency-server.ts` | Currency |
| `src/backend/billing/checkout-billing.ts` | Billing helpers |
| `src/backend/services/billing.service.ts` | Orchestration |
| `src/backend/services/gift.service.ts` | Gifts |
| `src/backend/repositories/billing.repository.ts` | SQL |
| `src/lib/plans-catalog.ts` | Plan helpers |
| `src/lib/checkout-currency.ts` / tax / gstin / payment icons | UI + tax |
| `src/frontend/lib/razorpay-custom-checkout.ts` | Card + netbanking Custom Checkout |
| `src/lib/razorpay-netbanking-banks.ts` | Activated Razorpay netbanking bank codes |
| `src/frontend/lib/razorpay-checkout.ts` | Standard Checkout (Apple Pay / wallets) |
| `src/frontend/components/checkout-*.tsx` | Checkout UI |
| `src/frontend/components/billing-checkout.tsx` | In-app checkout |
| `src/app/checkout/[merchant]/[sessionId]/page.tsx` | Hosted checkout page |
| `scripts/ops/smoke-razorpay-upi-qr.mjs` | UPI QR API smoke (create→fetch→close) |
| Overlay `#pricing` / legacy `/upgrade` | Pricing overlay |

---

## 3. API

See [`../reference/api-reference.md`](../reference/api-reference.md) § Billing.

Critical paths:

1. `GET /api/v1/billing/plans`
2. `POST /api/v1/billing/checkout-sessions` → `{ sessionId, checkoutPath, returnPath }`
3. Card: `POST /api/v1/billing/orders` → browser `createPayment` (Custom Checkout) → `POST /api/v1/billing/orders/verify`
3b. Netbanking (INR): same order + verify; browser `createPayment({ method: "netbanking", bank })` after bank picker
4. UPI: `POST /api/v1/billing/orders/upi` → custom QR modal (shimmer while generating) → `POST …/upi/poll`
5. Subscription row activated (app-level auto-renew period); entitlements applied
6. Webhook `payment.captured` also fulfills (idempotent)
7. Invoice: Cloudflare `clauxen-billing` Worker generates PDF → R2; `GET /api/v1/billing/invoices/:paymentId` + `/pdf`

### Cloudflare billing Worker

- Worker: `workers/billing` (`clauxen-billing`)
- When `BILLING_WORKER_URL` + `BILLING_INTERNAL_TOKEN` are set, Razorpay REST (orders, UPI QR, payment fetch, signature verify) is proxied through the Worker — secrets can live only on Cloudflare.
- After capture, Vercel enqueues invoice PDF generation on the Worker (plan, IGST/GST, seats for team/enterprise, Shirova logo).
- PDFs land in dedicated R2 bucket `clauxen-invoices` at `invoices/{userId}/{paymentId}.pdf` plus sales archive `invoices/sales/YYYY/MM/{paymentId}.pdf`.
- Worker best-effort uploads the PDF to Razorpay Documents (`POST /v1/documents`, then payment documents fallback) so invoices can appear under Dashboard → Payments → Upload Invoices when the merchant product supports it.
- Card PAN still uses Razorpay.js in the browser (PCI); never POSTed to our API or Worker.

### Card security (Custom Checkout)

- UI collects card number / expiry / CVC on-page.
- On Pay, those fields are passed **only** to Razorpay `razorpay.js` `createPayment({ method: "card", card: {…} })`.
- Our servers receive only `razorpay_order_id`, `razorpay_payment_id`, `razorpay_signature` and re-verify HMAC + amount via Orders/Payments APIs.
- Never POST PAN/CVV to `/api/v1/*`.

### Netbanking (Custom Checkout)

- INR checkout tab order: **Net Banking | Card | UPI**.
- Bank list is the Dashboard-activated set in `src/lib/razorpay-netbanking-banks.ts` (not the full Razorpay catalog).
- Prefetch Razorpay order + `razorpay.js` on the Net Banking tab.
- On Pay: sync `createPayment({ method: "netbanking", bank, callback_url })` with **`redirect: true`** (same-tab bank login — do not use popups).
- Callback: `POST /api/v1/billing/orders/razorpay-callback` verifies signature, fulfills, redirects to `?checkout=success|failed|error`.
- Trust line under Pay links the Razorpay logo to the merchant page.

### UPI QR

1. Server creates single-use fixed-amount `upi_qr` (`name: "shirova"`).
2. Server **constructs** native `upi://` from `qr_*` id + amount + merchant VPA profile (`RAZORPAY_UPI_*`) — does **not** download Razorpay’s branded `image_url` PNG (~400KB / ~2s). Renders a clean square PNG as `imageDataUrl`.
3. Client shows custom modal with that clean QR (same-origin `/upi/qr/:id/image` fallback).
4. Poll until captured; webhook is backup.
5. UPI icon: vendored at `/public/checkout/icon-pm-upi.svg` (no Stripe CDN at runtime). App marks (PhonePe / GPay / Paytm / NPCI): `/public/checkout/upi-apps/*.svg`.
6. Smoke: `node scripts/ops/smoke-razorpay-upi-qr.mjs` (needs `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET`).

Webhook:

- Verify `RAZORPAY_WEBHOOK_SECRET`
- Persist `razorpay_webhook_events` / fulfill idempotently
- Activate subscription / gift delivery jobs
- Recommended events: `payment.captured`, `payment.failed`, `order.paid`
- URL: `https://clauxen.com/api/v1/webhooks/razorpay`

---

## 4. Currency & geo

- INR and USD supported in UI
- **UPI is INR-only**
- Do not trust geo alone to hide UPI — prefer browser India heuristic (`use-checkout-currency`, `geo/checkout-default`)
- `CHECKOUT_USD_INR_RATE` for display conversion when needed
- GSTIN helpers for Indian tax fields (`src/lib/gstin.ts`, `checkout-tax.ts`)

---

## 5. Sessions & redirects

- Prefix: `cs_live_` (HMAC body + signature; **6 hour** TTL)
- Path: `/checkout/shirova/{sessionId}` (default merchant `shirova`)
- Overlay and hosted flows `history.replaceState` to that path so the link works in any tab
- Optional claim `returnPath` (sanitized: `/new`, `/onboarding`, `/c/…`, library/projects/customize) — post-pay redirect `{returnPath}?checkout=success`

---

## 6. Gifts

- Purchase → `gift_codes` + optional `gift_delivery_jobs`
- Redeem → `gift_redemptions` → subscription activation events
- UI overlay `#gift` / legacy `/gift`

---

## 7. Entitlements

Billing service consulted during chat/generate for plan limits where enforced.

`usage_daily_rollups` supports usage metering.

Recurring: one-time Razorpay Order activates app-level `subscriptions` (Razorpay Subscriptions / e-mandate auto-debit is a later slice).

---

## 8. Env

| Variable | Notes |
|---|---|
| `RAZORPAY_KEY_ID` | Server (`rzp_live_…`) |
| `RAZORPAY_KEY_SECRET` | Server |
| `RAZORPAY_WEBHOOK_SECRET` | Server |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Browser Custom/Standard Checkout only |
| `GOOGLE_PLACES_API_KEY` | Deprecated for checkout — Places routes removed |
| `BILLING_WORKER_URL` | Cloudflare `clauxen-billing` Worker base URL |
| `BILLING_INTERNAL_TOKEN` | Shared secret for billing Worker internal routes |
| `CHECKOUT_USD_INR_RATE` | Optional |
| `APPLE_PAY_DOMAIN_ASSOCIATION` | Apple Pay domain file content |

Targets: Production + Preview on Vercel (sensitive). Local uses `.env.local`.

---

## 9. UX rules

- Checkout brand copy: **shirova**
- UPI icon from `/checkout/icon-pm-upi.svg`
- Preparing state + error banners
- Pricing overlay must not blank main chat panel (hash overlay pattern)

---

## 10. Related

- [`../reference/database-schema.md`](../reference/database-schema.md) § Billing
- [`routing-and-navigation.md`](./routing-and-navigation.md)
