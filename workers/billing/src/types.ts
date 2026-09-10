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
  /** domestic_gst (18% GST) | export_lut (zero-rated, USD) | exempt_gstin. */
  invoiceKind?: "domestic_gst" | "export_lut" | "exempt_gstin";
  /** LUT number printed on export invoices (fallback: INVOICE_LUT_NUMBER). */
  lutNumber?: string | null;
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
  salesKey: string;
  contentType: "application/pdf";
  bytes: number;
  razorpayDocumentId?: string | null;
  razorpayDocumentPurpose?: string | null;
};

/**
 * Single-call invoice fulfillment: PDF → R2 (+ sales copy) →
 * Razorpay Documents → receipt email with the PDF attached.
 */
export type InvoiceFulfillRequest = InvoiceGenerateRequest & {
  email: {
    to: string;
    billedToName?: string;
    addressSummary?: string;
    /** App download URL for the invoice PDF (auth'd route). */
    pdfDownloadUrl?: string;
  };
};

export type InvoiceFulfillResponse = InvoiceGenerateResponse & {
  emailed: boolean;
  emailError?: string | null;
};
