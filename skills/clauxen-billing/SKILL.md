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
2. UPI icon: `/public/checkout/icon-pm-upi.svg` (vendored) — **no** Stripe CDN at runtime. UPI app marks (PhonePe / GPay / Paytm / NPCI) live at `/public/checkout/upi-apps/*.svg`.
3. **Cards:** Razorpay Custom Checkout (`razorpay.js` createPayment); never POST PAN/CVV to our API.
4. Checkout merchant path: `/checkout/shirova/cs_live_…`; brand copy **shirova**.
5. Pricing via **hash overlay** `#pricing` (keep chat mounted).
6. Webhooks: verify `RAZORPAY_WEBHOOK_SECRET`; idempotent `razorpay_webhook_events`.
7. Never expose `RAZORPAY_KEY_SECRET` to client.
8. Prefer Cloudflare `clauxen-billing` Worker (`BILLING_WORKER_URL`) for Razorpay REST + invoice PDF — never generate payment/invoice engines in the browser.
9. Checkout session TTL is **6 hours**. UPI address is a full form (no Google Places). Expired hosted sessions remint for the same logged-in user (no 404). Gate full checkout UI behind auth + session mint (`CheckoutBootstrapping`); never paint the form until ready.
10. Invoice PDFs go to dedicated R2 bucket **`clauxen-invoices`** (`invoices/{userId}/…` + `invoices/sales/YYYY/MM/…`). After generate, Worker best-effort uploads the PDF to Razorpay Documents for Dashboard → Payments → Upload Invoices.
11. If Razorpay QR Codes API is unavailable (`URL was not found`), UPI falls back to Standard Checkout (`mode: "checkout"`) so Pay still works. QR images are served via same-origin proxy `/api/v1/billing/orders/upi/qr/:id/image`. CSP must allow `https://*.razorpay.com` / `https://*.rzp.io` for Checkout frames/scripts.
12. Hosted checkout scroll: page wrapper is `fixed inset-0 overflow-y-auto` (body is `overflow:hidden`); do not nest a second `min-h` scrollport on `BillingCheckout`.

## Key paths

`src/backend/billing/*`, `src/backend/services/billing.service.ts`, `gift.service.ts`  
`workers/billing/` — Razorpay proxy + PDF invoices → R2 `clauxen-invoices` + Razorpay Documents upload  
`src/frontend/components/checkout-*.tsx`, `billing-checkout.tsx`, `invoice-view.tsx`  
`/api/v1/billing/*`, `/api/v1/webhooks/razorpay`, `/api/v1/gifts/*`

## Additional resources

- [reference.md](reference.md)
