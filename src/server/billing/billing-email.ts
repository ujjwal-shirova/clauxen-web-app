import { env } from "@/server/config/env";
import { isBillingWorkerConfigured } from "@/server/billing/billing-worker";

export type BillingEmailKind =
  | "invoice_paid"
  | "billing_address_saved"
  | "billing_address_updated"
  | "gift_received"
  | "gift_share_link"
  | "gift_sent"
  | "automation_run";

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
  pdfDownloadUrl?: string;
};

type AddressEmailPayload = {
  to: string;
  kind: "billing_address_saved" | "billing_address_updated";
  fullName: string;
  summary: string;
};

type GiftEmailPayload = {
  to: string;
  kind: "gift_received" | "gift_share_link" | "gift_sent";
  planName: string;
  monthsLabel: string;
  senderName: string;
  message?: string | null;
  claimUrl: string;
  /** Final 20-char gift code (link delivery + recipient backup). */
  giftCode?: string | null;
  /** Recipient display name for purchaser confirmation ("gift_sent"). */
  recipientName?: string | null;
  recipientEmail?: string | null;
  /** Gift card theme color for branded email header. */
  themeColor?: string | null;
};

type AutomationEmailPayload = {
  to: string;
  kind: "automation_run";
  taskName: string;
  status: "success" | "failed" | "skipped";
  summary: string;
  chatUrl?: string | null;
};

export type BillingEmailPayload =
  | InvoiceEmailPayload
  | AddressEmailPayload
  | GiftEmailPayload
  | AutomationEmailPayload;

async function postBillingEmail(
  payload: BillingEmailPayload,
): Promise<{ ok: boolean; error?: string }> {
  if (!isBillingWorkerConfigured()) {
    if (!env.authEmailWorkerUrl || !env.authEmailInternalToken) {
      console.warn("[billing-email] No email worker configured — skip send");
      return { ok: false, error: "email_worker_unconfigured" };
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
      console.warn(
        "[billing-email] send failed",
        res.status,
        text.slice(0, 200),
      );
      return { ok: false, error: text.slice(0, 300) || `http_${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    console.warn("[billing-email] send error", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "send_error",
    };
  }
}

export async function sendBillingNotificationEmail(
  payload: BillingEmailPayload,
) {
  const result = await postBillingEmail(payload);
  return result.ok;
}

export async function sendInvoicePaidEmail(
  input: Omit<InvoiceEmailPayload, "kind">,
) {
  const result = await postBillingEmail({ ...input, kind: "invoice_paid" });
  return result.ok;
}

export async function sendGiftNotificationEmail(
  input: Omit<GiftEmailPayload, "kind"> & {
    kind: "gift_received" | "gift_share_link" | "gift_sent";
  },
) {
  return postBillingEmail(input);
}

export async function sendAutomationRunEmail(
  input: Omit<AutomationEmailPayload, "kind">,
) {
  const result = await postBillingEmail({ ...input, kind: "automation_run" });
  return result.ok;
}
