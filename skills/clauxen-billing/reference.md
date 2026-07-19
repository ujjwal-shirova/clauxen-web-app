# Billing reference

## Flow

plans → checkout-session (`/checkout/shirova/cs_live_…`) → Custom Checkout card / UPI QR+poll → verify + webhook → subscriptions / gift_codes.

## Card

`razorpay.js` `createPayment({ method: "card" })` — PAN/CVV browser→Razorpay only; server verifies signature.

## UPI

Prefer Razorpay QR Codes API (`POST /v1/payments/qr_codes`) → custom modal → poll.
QR `<img>` must use same-origin proxy `GET /api/v1/billing/orders/upi/qr/:qrId/image` (not raw `rzp.io`).
If QR Codes product is **not enabled** on the merchant (API returns URL not found), fall back to Standard Checkout with `method: "upi"` (intent/collect). Smoke: `scripts/ops/smoke-razorpay-upi-qr.mjs`.

CSP (`next.config.ts`): allow `https://*.razorpay.com` and `https://*.rzp.io` in `script-src` / `frame-src` / `connect-src` or Checkout iframes show Chrome’s “This content is blocked”.

## Hosted checkout scroll

`/checkout/shirova/…` wrapper: `fixed inset-0 overflow-y-auto` (globals lock `html/body` overflow). Gate UI with `CheckoutBootstrapping` until session + auth ready.

## Webhooks (Live Mode)

URL: `https://clauxen.com/api/v1/webhooks/razorpay`  
Required event: `payment.captured` (handler ignores others). Also enable `payment.failed` / `order.paid` for ops visibility.  
Secret → `RAZORPAY_WEBHOOK_SECRET` on Vercel Production+Preview.
