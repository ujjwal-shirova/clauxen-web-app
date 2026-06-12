declare global {
  interface Window {
    ApplePaySession?: {
      canMakePayments(): boolean;
      canMakePaymentsWithActiveCard(merchantIdentifier: string): boolean;
    };
  }
}

/** True when Safari exposes Apple Pay on this device (Razorpay shows Apple Pay in checkout). */
export function canUseApplePay(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return Boolean(window.ApplePaySession?.canMakePayments());
  } catch {
    return false;
  }
}
