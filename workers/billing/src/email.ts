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

type GiftPayload = {
  kind: "gift_received" | "gift_share_link";
  to: string;
  planName: string;
  monthsLabel: string;
  senderName: string;
  message?: string | null;
  claimUrl: string;
};

export type EmailSendPayload = InvoicePayload | AddressPayload | GiftPayload;

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

function wrapEmail(title: string, bodyHtml: string, footer?: string): string {
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#18181b;">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:16px;padding:28px 24px;border:1px solid #e4e4e7;">
    <div style="font-size:13px;font-weight:600;letter-spacing:0.04em;color:#71717a;text-transform:uppercase;margin-bottom:12px;">Clauxen</div>
    <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;">${escapeHtml(title)}</h1>
    ${bodyHtml}
    <p style="margin:24px 0 0;font-size:12px;color:#a1a1aa;">${footer ?? "This is an automated notice from Shirova / Clauxen."}</p>
  </div>
</body></html>`;
}

function claimButton(claimUrl: string): string {
  return `<p style="margin:20px 0 0;">
    <a href="${escapeHtml(claimUrl)}" style="display:inline-block;background:#18181b;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-size:14px;font-weight:600;">
      Claim the gift
    </a>
  </p>`;
}

export async function sendBillingEmail(
  env: BillingEmailEnv,
  payload: EmailSendPayload,
): Promise<{ ok: boolean; error?: string }> {
  if (!env.EMAIL?.send) {
    return { ok: false, error: "email_binding_missing" };
  }
  const fromEmail =
    env.FROM_EMAIL?.trim() || "noreply@clauxen.com";
  const fromName = env.FROM_NAME?.trim() || "Clauxen";
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
  } else if (
    payload.kind === "gift_received" ||
    payload.kind === "gift_share_link"
  ) {
    const isShare = payload.kind === "gift_share_link";
    subject = isShare
      ? `Your Clauxen gift link — ${payload.planName}`
      : `You are gifted ${payload.planName} of Clauxen`;
    const title = isShare
      ? `Share your ${payload.planName} gift`
      : `You are gifted ${payload.planName} of Clauxen`;
    const note = payload.message?.trim()
      ? `<p style="margin:12px 0;font-size:14px;color:#52525b;padding:12px 14px;background:#fafafa;border-radius:12px;">${escapeHtml(payload.message.trim())}</p>`
      : "";
    html = wrapEmail(
      title,
      `<p style="margin:0 0 12px;font-size:15px;line-height:1.5;color:#3f3f46;">
        ${
          isShare
            ? `Your payment succeeded. Share this link so someone can claim <strong>${escapeHtml(payload.monthsLabel)}</strong> of <strong>${escapeHtml(payload.planName)}</strong>. Gifts do not auto-renew and unredeemed gifts expire one year after purchase.`
            : `${escapeHtml(payload.senderName)} gifted you <strong>${escapeHtml(payload.monthsLabel)}</strong> of <strong>${escapeHtml(payload.planName)}</strong> on Clauxen. Claim it to activate your plan. Gifts do not auto-renew.`
        }
      </p>
      ${note}
      ${claimButton(payload.claimUrl)}`,
      "This gift email was sent by Clauxen. If you were not expecting it, you can ignore this message.",
    );
    text = isShare
      ? `Share your Clauxen gift (${payload.planName}, ${payload.monthsLabel}): ${payload.claimUrl}`
      : `You are gifted ${payload.planName} of Clauxen (${payload.monthsLabel}) from ${payload.senderName}. Claim: ${payload.claimUrl}`;
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
