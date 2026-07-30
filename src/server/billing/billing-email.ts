import { env } from "@/server/config/env";
import { isBillingWorkerConfigured } from "@/server/billing/billing-worker";

export type BillingEmailKind =
  | "invoice_paid"
  | "billing_address_saved"
  | "billing_address_updated"
  | "gift_received"
  | "gift_share_link";

type InvoiceEmailPayload = {
  to: string;
  kind: "invoice_paid";
  invoiceNumber: string;
  planName: string;
  amountLabel: string;
  currency: string;
  paymentId: string;
  billedToName?: string;
  addressSummary?: string;
  pdfAvailable?: boolean;
};

type AddressEmailPayload = {
  to: string;
  kind: "billing_address_saved" | "billing_address_updated";
  fullName: string;
  summary: string;
};

type GiftEmailPayload = {
  to: string;
  kind: "gift_received" | "gift_share_link";
  planName: string;
  monthsLabel: string;
  senderName: string;
  message?: string | null;
  claimUrl: string;
};

export type BillingEmailPayload =
  | InvoiceEmailPayload
  | AddressEmailPayload
  | GiftEmailPayload;

async function postBillingEmail(payload: BillingEmailPayload): Promise<boolean> {
  if (!isBillingWorkerConfigured()) {
    if (!env.authEmailWorkerUrl || !env.authEmailInternalToken) {
      console.warn("[billing-email] No email worker configured — skip send");
      return false;
    }
  }

  const url = isBillingWorkerConfigured()
    ? `${env.billingWorkerUrl}/v1/email/send`
    : `${env.authEmailWorkerUrl}/v1/notify/send`;
  const token = isBillingWorkerConfigured()
    ? env.billingInternalToken!
    : env.authEmailInternalToken!;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "x-clauxen-billing": token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn("[billing-email] send failed", res.status, text.slice(0, 200));
      return false;
    }
    return true;
  } catch (err) {
    console.warn("[billing-email] send error", err);
    return false;
  }
}

export async function sendBillingNotificationEmail(payload: BillingEmailPayload) {
  return postBillingEmail(payload);
}

export async function sendInvoicePaidEmail(input: Omit<InvoiceEmailPayload, "kind">) {
  return postBillingEmail({ ...input, kind: "invoice_paid" });
}

export async function sendGiftNotificationEmail(
  input: Omit<GiftEmailPayload, "kind"> & {
    kind: "gift_received" | "gift_share_link";
  },
) {
  return postBillingEmail(input);
}
