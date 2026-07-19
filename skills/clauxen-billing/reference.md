# Billing reference

## Flow

plans → checkout-session (`/checkout/shirova/cs_live_…`) → Custom Checkout card / UPI QR+poll → verify + webhook → subscriptions / gift_codes.

## Card

`razorpay.js` `createPayment({ method: "card" })` — PAN/CVV browser→Razorpay only; server verifies signature.

## UPI

Prefer Razorpay QR Codes API (`POST /v1/payments/qr_codes`) → custom modal → poll.
If QR Codes product is **not enabled** on the merchant (API returns URL not found), fall back to Standard Checkout with `method: "upi"` (intent/collect). Smoke: `scripts/ops/smoke-razorpay-upi-qr.mjs`.

## Webhooks (Live Mode)

URL: `https://clauxen.com/api/v1/webhooks/razorpay`  
Required event: `payment.captured` (handler ignores others). Also enable `payment.failed` / `order.paid` for ops visibility.  
Secret → `RAZORPAY_WEBHOOK_SECRET` on Vercel Production+Preview.
