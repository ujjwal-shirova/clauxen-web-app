---
name: clauxen-billing
description: >-
  Clauxen billing and checkout: Razorpay orders, UPI INR, subscriptions, webhooks, gifts, plans catalog. Use when working on pricing overlay, checkout pages, Razorpay, UPI QR, invoices, gift purchase/redeem, or plan entitlements.
---

# Clauxen billing

## Read first

- `docs/systems/billing-and-checkout.md`

## Stack

Razorpay server keys + `NEXT_PUBLIC_RAZORPAY_KEY_ID` for browser only.  
Plans in Postgres `plans` (migrations seed catalog).

## Hard rules

1. **UPI is INR-only** — prefer browser India heuristic; geo alone can wrongly hide UPI.
2. Local UPI/card SVG icons — **no** Stripe/logo CDNs.
3. Pricing via **hash overlay** `#pricing` (keep chat mounted).
4. Webhooks: verify `RAZORPAY_WEBHOOK_SECRET`; idempotent `webhook_events`.
5. Never expose `RAZORPAY_KEY_SECRET` to client.

## Key paths

`src/backend/billing/*`, `src/backend/services/billing.service.ts`, `gift.service.ts`  
`src/frontend/components/checkout-*.tsx`, `billing-checkout.tsx`  
`/api/v1/billing/*`, `/api/v1/webhooks/razorpay`, `/api/v1/gifts/*`

## Additional resources

- [reference.md](reference.md)
