# Billing reference

## Flow

plans → checkout-session (`/checkout/shirova/cs_live_…`) → Custom Checkout card / UPI QR+poll → verify + webhook → subscriptions / gift_codes.

## Card

On-page fields + `razorpay.js` `createPayment({ method: "card" })` only — PAN/CVV never hit our API; no Standard Checkout modal.

## UPI

Always show our custom **UPI QR** modal (countdown + scan row) — never Razorpay Standard Checkout.
1. Prefer `POST /v1/payments/qr_codes` → same-origin image proxy.
2. If QR Codes product is disabled: create UPI `payment_links` (`upi_link: true`) and render a PNG QR of `short_url` via `qrcode`.
Poll: `qr_*` via QR payments API; `plink_*` via payment link status.

## Hosted checkout scroll

`/checkout/shirova/…` wrapper: `fixed inset-0 overflow-y-auto` (globals lock `html/body` overflow). Gate UI with `CheckoutBootstrapping` until session + auth ready.

## Webhooks (Live Mode)

URL: `https://clauxen.com/api/v1/webhooks/razorpay`  
Required event: `payment.captured` (handler ignores others). Also enable `payment.failed` / `order.paid` for ops visibility.  
Secret → `RAZORPAY_WEBHOOK_SECRET` on Vercel Production+Preview.
