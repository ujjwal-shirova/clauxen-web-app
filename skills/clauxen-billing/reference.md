# Billing reference

## Flow

plans → checkout-session (`/checkout/shirova/cs_live_…`) → Custom Checkout card / UPI QR+poll → verify + webhook → subscriptions / gift_codes.

## Card

`razorpay.js` `createPayment({ method: "card" })` — PAN/CVV browser→Razorpay only; server verifies signature.

## UPI

`POST /v1/payments/qr_codes` → custom modal → poll; smoke via `scripts/ops/smoke-razorpay-upi-qr.mjs`.
