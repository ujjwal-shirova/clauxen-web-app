export type CheckoutPaymentTab = "saved" | "netbanking" | "card" | "upi";

export type SavedPaymentMethod = {
  brand: string;
  last4: string;
  network: "mastercard" | "visa" | "rupay" | "amex";
};
