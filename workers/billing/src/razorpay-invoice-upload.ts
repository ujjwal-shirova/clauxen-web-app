/**
 * Upload tax invoice PDF into Razorpay Documents so it can appear against the
 * payment (Dashboard → Payments → Upload Invoices / payment documents).
 *
 * Docs: https://razorpay.com/docs/api/documents/create/
 * Purposes for OPGSP / export compliance accept application/pdf.
 */

export type RazorpayDocumentUploadResult = {
  documentId: string;
  purpose: string;
};

type EnvKeys = {
  RAZORPAY_KEY_ID?: string;
  RAZORPAY_KEY_SECRET?: string;
};

function authHeader(env: EnvKeys): string | null {
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) return null;
  return `Basic ${btoa(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`)}`;
}

export async function uploadInvoicePdfToRazorpay(
  env: EnvKeys,
  input: {
    paymentId: string;
    pdfBytes: Uint8Array;
    fileName: string;
  },
): Promise<RazorpayDocumentUploadResult | null> {
  const auth = authHeader(env);
  if (!auth) {
    console.warn(
      "[billing] Razorpay keys missing on worker — skip invoice document upload",
    );
    return null;
  }

  const purposes = ["opgsp_export_invoice", "invoice"] as const;

  for (const purpose of purposes) {
    try {
      const form = new FormData();
      form.append("purpose", purpose);
      form.append(
        "file",
        new Blob([input.pdfBytes], { type: "application/pdf" }),
        input.fileName,
      );
      form.append("payment_id", input.paymentId);

      const res = await fetch("https://api.razorpay.com/v1/documents", {
        method: "POST",
        headers: { Authorization: auth },
        body: form,
      });

      const body = (await res.json().catch(() => ({}))) as {
        id?: string;
        error?: { description?: string };
      };

      if (res.ok && body.id) {
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

  try {
    const form = new FormData();
    form.append(
      "file",
      new Blob([input.pdfBytes], { type: "application/pdf" }),
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
    const body = (await res.json().catch(() => ({}))) as {
      id?: string;
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
    // Non-fatal — document may already be stored in Razorpay.
  }
}
