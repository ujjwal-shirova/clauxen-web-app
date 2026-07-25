/**
 * Billing notification emails via Cloudflare Email Workers binding.
 */

export type BillingEmailEnv = {
  EMAIL?: {
    send: (msg: {
      to: string | { email: string; name?: string };
      from: string | { email: string; name?: string };
      subject: string;
      html?: string;
      text?: string;
    }) => Promise<{ messageId?: string }>;
  };
  FROM_EMAIL?: string;
  FROM_NAME?: string;
  APP_ORIGIN?: string;
};

type InvoicePayload = {
  kind: "invoice_paid";
  to: string;
  invoiceNumber: string;
  planName: string;
  amountLabel: string;
  currency: string;
  paymentId: string;
  billedToName?: string;
  addressSummary?: string;
  pdfAvailable?: boolean;
};

type AddressPayload = {
  kind: "billing_address_saved" | "billing_address_updated";
  to: string;
  fullName: string;
  summary: string;
};

export type EmailSendPayload = InvoicePayload | AddressPayload;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function appOrigin(env: BillingEmailEnv): string {
  const raw = (env.APP_ORIGIN || "https://www.clauxen.com").trim().replace(/\/$/, "");
  try {
    return new URL(raw).origin;
  } catch {
    return "https://www.clauxen.com";
  }
}

function wrapEmail(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#18181b;">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:16px;padding:28px 24px;border:1px solid #e4e4e7;">
    <div style="font-size:13px;font-weight:600;letter-spacing:0.04em;color:#71717a;text-transform:uppercase;margin-bottom:12px;">Clauxen</div>
    <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;">${escapeHtml(title)}</h1>
    ${bodyHtml}
    <p style="margin:24px 0 0;font-size:12px;color:#a1a1aa;">This is an automated billing notice from Shirova / Clauxen. If you did not make this change, contact support immediately.</p>
  </div>
</body></html>`;
}

export async function sendBillingEmail(
  env: BillingEmailEnv,
  payload: EmailSendPayload,
): Promise<{ ok: boolean; error?: string }> {
  if (!env.EMAIL?.send) {
    return { ok: false, error: "email_binding_missing" };
  }
  const fromEmail = env.FROM_EMAIL?.trim() || "billing@clauxen.com";
  const fromName = env.FROM_NAME?.trim() || "Clauxen Billing";
  const origin = appOrigin(env);

  let subject = "";
  let html = "";
  let text = "";

  if (payload.kind === "invoice_paid") {
    subject = `Payment successful — invoice ${payload.invoiceNumber}`;
    const settingsUrl = `${origin}/settings?section=billing`;
    html = wrapEmail(
      "Payment successful",
      `<p style="margin:0 0 12px;font-size:15px;line-height:1.5;color:#3f3f46;">
        Thanks${payload.billedToName ? `, ${escapeHtml(payload.billedToName)}` : ""}. Your payment of
        <strong>${escapeHtml(payload.amountLabel)}</strong> for
        <strong>${escapeHtml(payload.planName)}</strong> was successful.
      </p>
      <p style="margin:0 0 8px;font-size:14px;color:#52525b;">Invoice: <strong>${escapeHtml(payload.invoiceNumber)}</strong></p>
      ${
        payload.addressSummary
          ? `<p style="margin:0 0 8px;font-size:14px;color:#52525b;">Billed to: ${escapeHtml(payload.addressSummary)}</p>`
          : ""
      }
      <p style="margin:16px 0 0;">
        <a href="${escapeHtml(settingsUrl)}" style="display:inline-block;background:#18181b;color:#fff;text-decoration:none;padding:10px 16px;border-radius:999px;font-size:14px;font-weight:600;">
          View billing history
        </a>
      </p>`,
    );
    text = `Payment successful. Invoice ${payload.invoiceNumber}. Amount ${payload.amountLabel} for ${payload.planName}. View billing: ${settingsUrl}`;
  } else {
    const updated = payload.kind === "billing_address_updated";
    subject = updated
      ? "Your billing address was updated"
      : "Your billing address was saved";
    html = wrapEmail(
      updated ? "Billing address updated" : "Billing address saved",
      `<p style="margin:0 0 12px;font-size:15px;line-height:1.5;color:#3f3f46;">
        Hi ${escapeHtml(payload.fullName)}, your billing information on Clauxen has been
        ${updated ? "updated" : "saved"}.
      </p>
      <p style="margin:0;font-size:14px;color:#52525b;padding:12px 14px;background:#fafafa;border-radius:12px;">
        ${escapeHtml(payload.summary)}
      </p>
      <p style="margin:16px 0 0;font-size:14px;color:#71717a;">
        If you did not make this change, open Settings → Billing and review your account.
      </p>`,
    );
    text = `${subject}. ${payload.fullName}: ${payload.summary}`;
  }

  try {
    await env.EMAIL.send({
      to: payload.to,
      from: { email: fromEmail, name: fromName },
      subject,
      html,
      text,
    });
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "send_failed",
    };
  }
}
