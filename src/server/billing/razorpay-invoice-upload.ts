import { env } from "@/server/config/env";

type RazorpayDocument = {
  id: string;
  entity: string;
  purpose: string;
  name?: string;
  mime_type?: string;
  size?: number;
};

/**
 * Upload a tax invoice PDF into Razorpay so it appears against the payment
 * (Dashboard → Payments → Upload Invoices / payment documents).
 *
 * Docs: https://razorpay.com/docs/api/documents/create/
 * Purposes vary by merchant product; we try compliance-oriented purposes first.
 */
export async function uploadInvoicePdfToRazorpay(input: {
  paymentId: string;
  pdfBytes: Uint8Array;
  fileName: string;
}): Promise<{ documentId: string; purpose: string } | null> {
  if (!env.razorpayKeyId || !env.razorpayKeySecret) {
    console.warn("[billing] Razorpay keys missing — skip invoice document upload");
    return null;
  }

  const auth = `Basic ${Buffer.from(
    `${env.razorpayKeyId}:${env.razorpayKeySecret}`,
  ).toString("base64")}`;

  // Try purposes that accept application/pdf for settlement / export compliance.
  // `opgsp_export_invoice` is used for RBI/audit invoice uploads; fall back to
  // attaching via the payment documents path when purpose is rejected.
  const purposes = ["opgsp_export_invoice", "invoice"] as const;

  for (const purpose of purposes) {
    try {
      const form = new FormData();
      form.append("purpose", purpose);
      form.append(
        "file",
        new Blob([new Uint8Array(input.pdfBytes)], { type: "application/pdf" }),
        input.fileName,
      );
      // Some dashboard flows also accept payment_id alongside the document.
      form.append("payment_id", input.paymentId);

      const res = await fetch("https://api.razorpay.com/v1/documents", {
        method: "POST",
        headers: { Authorization: auth },
        body: form,
      });

      const body = (await res.json().catch(() => ({}))) as RazorpayDocument & {
        error?: { description?: string; code?: string };
      };

      if (res.ok && body.id) {
        // Best-effort link onto the payment entity for dashboard visibility.
        await linkDocumentToPayment({
          auth,
          paymentId: input.paymentId,
          documentId: body.id,
        });
        return { documentId: body.id, purpose };
      }

      console.warn(
        "[billing] Razorpay document upload rejected",
        purpose,
        body.error?.description || res.status,
      );
    } catch (err) {
      console.warn("[billing] Razorpay document upload error", purpose, err);
    }
  }

  // Fallback: multipart upload directly against the payment (Upload Invoices UX).
  try {
    const form = new FormData();
    form.append(
      "file",
      new Blob([new Uint8Array(input.pdfBytes)], { type: "application/pdf" }),
      input.fileName,
    );
    form.append("purpose", "invoice");

    const res = await fetch(
      `https://api.razorpay.com/v1/payments/${encodeURIComponent(input.paymentId)}/documents`,
      {
        method: "POST",
        headers: { Authorization: auth },
        body: form,
      },
    );
    const body = (await res.json().catch(() => ({}))) as RazorpayDocument & {
      error?: { description?: string };
    };
    if (res.ok && body.id) {
      return { documentId: body.id, purpose: "payment_documents" };
    }
    console.warn(
      "[billing] payment documents upload failed",
      body.error?.description || res.status,
    );
  } catch (err) {
    console.warn("[billing] payment documents upload error", err);
  }

  return null;
}

async function linkDocumentToPayment(input: {
  auth: string;
  paymentId: string;
  documentId: string;
}) {
  try {
    await fetch(
      `https://api.razorpay.com/v1/payments/${encodeURIComponent(input.paymentId)}`,
      {
        method: "PATCH",
        headers: {
          Authorization: input.auth,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          notes: {
            shirova_invoice_document_id: input.documentId,
          },
        }),
      },
    );
  } catch {
    // Non-fatal — document is already stored in Razorpay.
  }
}
