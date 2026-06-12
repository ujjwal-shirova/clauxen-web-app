export type CheckoutPaymentTab = "saved" | "upi" | "card";

export type SavedPaymentMethod = {
  brand: string;
  last4: string;
  network: "mastercard" | "visa" | "rupay" | "amex";
};
