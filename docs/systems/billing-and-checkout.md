# Billing and Checkout

## 1. Overview

Clauxen billing is **Razorpay**-based:

- One-time orders and subscription flows
- UPI (INR) with QR + poll
- Cards / Apple Pay association where configured
- Invoices list
- Gift purchase + redeem
- Webhook-driven activation (`/api/v1/webhooks/razorpay`)

Plans live in Postgres `plans` (seeded by migrations including personal catalog + Pro yearly 20%).

---

## 2. Key files

| Path | Role |
|---|---|
| `src/backend/billing/razorpay.ts` | SDK wrapper |
| `src/backend/billing/checkout-session.ts` | Session creation |
| `src/backend/billing/checkout-pricing.ts` | Price math |
| `src/backend/billing/checkout-currency-server.ts` | Currency |
| `src/backend/billing/checkout-billing.ts` | Billing helpers |
| `src/backend/services/billing.service.ts` | Orchestration |
| `src/backend/services/gift.service.ts` | Gifts |
| `src/backend/repositories/billing.repository.ts` | SQL |
| `src/backend/repositories/gifts.repository.ts` | Gift SQL |
| `src/lib/plans-catalog.ts` | Plan helpers |
| `src/lib/checkout-currency.ts` / tax / gstin / payment icons | UI + tax |
| `src/frontend/components/checkout-*.tsx` | Checkout UI |
| `src/frontend/components/billing-checkout.tsx` | In-app checkout |
| `src/app/checkout/[merchant]/[sessionId]/page.tsx` | Hosted checkout page |
| Overlay `#pricing` / legacy `/upgrade` | Pricing overlay |

---

## 3. API

See [`../reference/api-reference.md`](../reference/api-reference.md) § Billing.

Critical paths:

1. `GET /api/v1/billing/plans`
2. `POST /api/v1/billing/checkout-sessions` or `orders`
3. Client confirms via Razorpay.js (`NEXT_PUBLIC_RAZORPAY_KEY_ID` only public)
4. `POST /api/v1/billing/orders/verify` and/or webhook
5. Subscription row activated; entitlements applied

UPI:

1. `POST /api/v1/billing/orders/upi`
2. Show QR modal
3. `GET /api/v1/billing/orders/upi/poll` until paid/failed

Webhook:

- Verify `RAZORPAY_WEBHOOK_SECRET`
- Persist `webhook_events` idempotently
- Activate subscription / gift delivery jobs

---

## 4. Currency & geo

- INR and USD supported in UI
- **UPI is INR-only**
- Do not trust geo alone to hide UPI — prefer browser India heuristic (`use-checkout-currency`, `geo/checkout-default`)
- `CHECKOUT_USD_INR_RATE` for display conversion when needed
- GSTIN helpers for Indian tax fields (`src/lib/gstin.ts`, `checkout-tax.ts`)

---

## 5. Gifts

- Purchase → `gift_codes` + optional `gift_delivery_jobs`
- Redeem → `gift_redemptions` → subscription activation events
- UI overlay `#gift` / legacy `/gift`

---

## 6. Entitlements

Billing service consulted during chat/generate for plan limits where enforced.

`usage_daily_rollups` supports usage metering.

---

## 7. Env

| Variable | Notes |
|---|---|
| `RAZORPAY_KEY_ID` | Server |
| `RAZORPAY_KEY_SECRET` | Server |
| `RAZORPAY_WEBHOOK_SECRET` | Server |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Browser checkout only |
| `CHECKOUT_USD_INR_RATE` | Optional |
| `APPLE_PAY_DOMAIN_ASSOCIATION` | Apple Pay domain file content |

---

## 8. UX rules

- Local UPI/card SVG icons — no Stripe/logo CDNs
- Preparing state + error banners
- Pricing overlay must not blank main chat panel (hash overlay pattern)

---

## 9. Related

- [`../reference/database-schema.md`](../reference/database-schema.md) § Billing
- [`routing-and-navigation.md`](./routing-and-navigation.md)
