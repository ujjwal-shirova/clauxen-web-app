"use client";

/**
 * Razorpay one-click checkout — Stripe Link equivalent.
 *
 * Stripe Link is Stripe-only. Razorpay's production analogue is Standard
 * Checkout with `customer_id` + `remember_customer`, which restores saved
 * cards after an OTP on the customer's email/phone. Charge still settles
 * on Razorpay; order creation + verify stay on the Cloudflare billing Worker.
 */

export function CheckoutLinkMark({ className }: { className?: string }) {
  return (
    <span
      className={className}
      aria-hidden
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontWeight: 700,
        letterSpacing: "-0.03em",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <rect width="24" height="24" rx="6" fill="#00D66F" />
        <path
          d="M10.2 13.8a3.2 3.2 0 0 1 0-4.5l1.6-1.6a3.2 3.2 0 0 1 4.5 4.5l-.7.7"
          stroke="#fff"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <path
          d="M13.8 10.2a3.2 3.2 0 0 1 0 4.5l-1.6 1.6a3.2 3.2 0 1 1-4.5-4.5l.7-.7"
          stroke="#fff"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
      Link
    </span>
  );
}

export function CheckoutPayWithLinkButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="checkout-link-btn no-hover-overlay no-hover"
    >
      <span className="checkout-link-btn__label">Pay with</span>
      <CheckoutLinkMark />
    </button>
  );
}
