export type InvoiceLineItem = {
  label: string;
  sublabel?: string;
  quantity?: string;
  unitAmountPaise: number;
  discountPaise?: number;
  taxPaise?: number;
  amountPaise: number;
};

export type InvoiceSeatLine = {
  planName: string;
  seats: number;
  unitPaise: number;
  amountPaise: number;
};

export type InvoiceGenerateRequest = {
  invoiceNumber: string;
  paymentId: string;
  orderId: string;
  userId: string;
  issuedAt: string;
  nextBillingAt?: string | null;
  currency: "INR" | "USD";
  status: "paid" | "open" | "draft";
  billedTo: {
    name: string;
    email?: string;
    address?: string;
    gstin?: string;
    phone?: string;
  };
  planName: string;
  billingCycle: string;
  items: InvoiceLineItem[];
  seats?: InvoiceSeatLine[];
  subtotalPaise: number;
  tax?: { label: string; amountPaise: number } | null;
  totalPaise: number;
  amountPaidPaise: number;
  paymentMethod?: string;
  razorpayPaymentId?: string;
  autoRenew?: boolean;
};

export type InvoiceGenerateResponse = {
  ok: true;
  invoiceNumber: string;
  paymentId: string;
  r2Key: string;
  contentType: "application/pdf";
  bytes: number;
};
