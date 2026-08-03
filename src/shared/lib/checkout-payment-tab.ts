export type CheckoutPaymentTab = "saved" | "netbanking" | "card" | "upi";

export type SavedPaymentMethod = {
  id?: string;
  methodType?: "card" | "upi";
  brand: string;
  /** First 4 digits shown in UI (PCI-safe). */
  first4?: string;
  last4?: string;
  upiVpa?: string | null;
  maskedNumber?: string;
  network:
    | "mastercard"
    | "visa"
    | "rupay"
    | "amex"
    | "jcb"
    | "discover"
    | "unknown"
    | "upi";
};
