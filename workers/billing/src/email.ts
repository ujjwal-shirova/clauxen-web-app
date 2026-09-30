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
      attachments?: Array<{
        content: string | ArrayBuffer | ArrayBufferView;
        filename: string;
        type: string;
        disposition: "attachment" | "inline";
      }>;
    }) => Promise<{
      messageId?: string;
      delivered?: string[];
      queued?: string[];
      permanent_bounces?: string[];
      suppressed_recipients?: string[];
    }>;
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
  /** App download URL for the invoice PDF (auth'd route). */
  pdfDownloadUrl?: string;
};

type AddressPayload = {
  kind: "billing_address_saved" | "billing_address_updated";
  to: string;
  fullName: string;
  summary: string;
};

type GiftPayload = {
  kind: "gift_received" | "gift_share_link" | "gift_sent";
  to: string;
  planName: string;
  monthsLabel: string;
  senderName: string;
  message?: string | null;
  claimUrl: string;
  /** Final 20-char gift code (display-grouped) for link delivery + backup. */
  giftCode?: string | null;
  recipientName?: string | null;
  recipientEmail?: string | null;
  themeColor?: string | null;
};

type AutomationPayload = {
  kind: "automation_run";
  to: string;
  taskName: string;
  status: "success" | "failed" | "skipped";
  summary: string;
  chatUrl?: string | null;
};

export type EmailSendPayload =
  | InvoicePayload
  | AddressPayload
  | GiftPayload
  | AutomationPayload;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Preserve line breaks from the gift note textarea in HTML email. */
function escapeHtmlMultiline(value: string): string {
  return escapeHtml(value).replace(/\r\n|\r|\n/g, "<br>");
}

function giftNoteHtml(
  senderName: string,
  message: string | null | undefined,
): string {
  const note = message?.trim();
  if (!note) return "";
  const label = senderName.trim()
    ? `Note from ${escapeHtml(senderName.trim())}`
    : "Gift note";
  return `<div style="margin:16px 0;padding:14px 16px;background:#fafafa;border:1px solid #e4e4e7;border-radius:12px;">
    <div style="margin:0 0 8px;font-size:12px;font-weight:600;letter-spacing:0.03em;text-transform:uppercase;color:#71717a;">${label}</div>
    <p style="margin:0;font-size:15px;line-height:1.55;color:#3f3f46;white-space:pre-wrap;">${escapeHtmlMultiline(note)}</p>
  </div>`;
}

function giftNoteText(
  senderName: string,
  message: string | null | undefined,
): string {
  const note = message?.trim();
  if (!note) return "";
  const label = senderName.trim()
    ? `Note from ${senderName.trim()}`
    : "Gift note";
  return `\n\n${label}:\n${note}\n`;
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

export type InvoiceMailInput = Omit<InvoicePayload, "kind" | "to"> & {
  to: string;
};

export function buildInvoicePaidEmail(
  config: { fromEmail?: string; fromName?: string; appOrigin?: string },
  payload: InvoiceMailInput,
): {
  from: { email: string; name: string };
  subject: string;
  html: string;
  text: string;
} {
  const fromEmail = config.fromEmail?.trim() || "no-reply@clauxen.com";
  const fromName = config.fromName?.trim() || "Clauxen";
  const rawOrigin = (config.appOrigin || "https://www.clauxen.com")
    .trim()
    .replace(/\/$/, "");
  let origin = "https://www.clauxen.com";
  try {
    origin = new URL(rawOrigin).origin;
  } catch {
    // keep default
  }
  const subject = `Payment successful — invoice ${payload.invoiceNumber}`;
  const settingsUrl = `${origin}/settings?section=billing`;
  const downloadButton = payload.pdfDownloadUrl
    ? `<p style="margin:16px 0 0;">
        <a href="${escapeHtml(payload.pdfDownloadUrl)}" style="display:inline-block;background:#18181b;color:#fff;text-decoration:none;padding:10px 16px;border-radius:999px;font-size:14px;font-weight:600;">
          Download invoice (PDF)
        </a>
      </p>`
    : "";
  const html = wrapEmail(
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
    <p style="margin:12px 0 0;font-size:14px;color:#52525b;">Your invoice PDF is attached to this email.</p>
    ${downloadButton}
    <p style="margin:16px 0 0;">
      <a href="${escapeHtml(settingsUrl)}" style="display:inline-block;color:#18181b;text-decoration:underline;font-size:14px;font-weight:600;">
        View billing history
      </a>
    </p>`,
  );
  const text = [
    `Payment successful. Invoice ${payload.invoiceNumber}.`,
    `Amount ${payload.amountLabel} for ${payload.planName}.`,
    `Your invoice PDF is attached to this email.`,
    payload.pdfDownloadUrl ? `Download: ${payload.pdfDownloadUrl}` : "",
    `View billing: ${settingsUrl}`,
  ]
    .filter(Boolean)
    .join("\n");
  return { from: { email: fromEmail, name: fromName }, subject, html, text };
}

export async function sendBillingEmail(
  env: BillingEmailEnv,
  payload: EmailSendPayload,
): Promise<{ ok: boolean; error?: string }> {
  if (!env.EMAIL?.send) {
    return { ok: false, error: "email_binding_missing" };
  }
  const fromEmail = env.FROM_EMAIL?.trim() || "no-reply@clauxen.com";
  const fromName = env.FROM_NAME?.trim() || "Clauxen";

  let subject = "";
  let html = "";
  let text = "";

  if (payload.kind === "invoice_paid") {
    const mail = buildInvoicePaidEmail(
      {
        fromEmail: env.FROM_EMAIL,
        fromName: env.FROM_NAME,
        appOrigin: env.APP_ORIGIN,
      },
      payload,
    );
    subject = mail.subject;
    html = mail.html;
    text = mail.text;
  } else if (payload.kind === "automation_run") {
    const succeeded = payload.status === "success";
    subject = `${payload.taskName} ${succeeded ? "completed" : payload.status}`;
    const resultLink = payload.chatUrl
      ? `<p style="margin:20px 0 0;"><a href="${escapeHtml(payload.chatUrl)}" style="display:inline-block;background:#18181b;color:#fff;text-decoration:none;padding:10px 16px;border-radius:999px;font-size:14px;font-weight:600;">Open result</a></p>`
      : "";
    html = wrapEmail(
      subject,
      `<p style="margin:0;font-size:15px;line-height:1.55;color:#3f3f46;">${escapeHtml(payload.summary)}</p>${resultLink}`,
      "You received this because notifications are enabled for this automation.",
    );
    text = `${subject}\n\n${payload.summary}${payload.chatUrl ? `\n\nOpen result: ${payload.chatUrl}` : ""}`;
  } else if (
    payload.kind === "gift_received" ||
    payload.kind === "gift_share_link" ||
    payload.kind === "gift_sent"
  ) {
    const theme = /^#[0-9a-fA-F]{6}$/.test(payload.themeColor ?? "")
      ? (payload.themeColor as string)
      : "#18181b";
    const noteHtml = giftNoteHtml(payload.senderName, payload.message);
    const noteText = giftNoteText(payload.senderName, payload.message);
    const code = payload.giftCode?.trim() || "";
    const codeHtml = code
      ? `<div style="margin:16px 0 0;padding:14px 16px;background:#fafafa;border:1px dashed #d4d4d8;border-radius:12px;text-align:center;">
          <div style="margin:0 0 6px;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Gift code</div>
          <div style="margin:0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:16px;font-weight:700;letter-spacing:0.06em;color:#18181b;">${escapeHtml(code)}</div>
        </div>`
      : "";
    const giftHero = (eyebrow: string) =>
      `<div style="margin:0 0 16px;border-radius:14px;padding:20px;background:linear-gradient(135deg, ${theme} 0%, #18181b 130%);color:#fff;text-align:center;">
        <div style="font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;opacity:0.85;">${escapeHtml(eyebrow)}</div>
        <div style="margin:6px 0 0;font-size:24px;font-weight:700;letter-spacing:-0.01em;">${escapeHtml(payload.planName)}</div>
        <div style="margin:4px 0 0;font-size:14px;opacity:0.9;">${escapeHtml(payload.monthsLabel)} &middot; does not auto-renew</div>
      </div>`;

    if (payload.kind === "gift_share_link") {
      subject = `Your Clauxen gift link — ${payload.planName}`;
      html = wrapEmail(
        `Share your ${payload.planName} gift`,
        `${giftHero("Your gift is ready")}
        <p style="margin:0 0 12px;font-size:15px;line-height:1.55;color:#3f3f46;">
          Your payment succeeded. Here is your gift code and gift link for the
          <strong>${escapeHtml(payload.planName)}</strong> plan
          (<strong>${escapeHtml(payload.monthsLabel)}</strong>). Share the link
          so someone can claim it. Unclaimed gifts expire one year after purchase.
        </p>
        ${noteHtml}
        ${claimButton(payload.claimUrl)}
        ${codeHtml}
        <p style="margin:16px 0 0;font-size:13px;line-height:1.5;color:#71717a;word-break:break-all;">
          Gift link:<br><a href="${escapeHtml(payload.claimUrl)}" style="color:#18181b;">${escapeHtml(payload.claimUrl)}</a>
        </p>`,
        "This gift email was sent by Clauxen. If you were not expecting it, you can ignore this message.",
      );
      text = [
        `Your Clauxen gift link — ${payload.planName} (${payload.monthsLabel}).`,
        `Here is your gift code and gift link for the ${payload.planName} plan.`,
        code ? `Gift code: ${code}` : "",
        `Gift link: ${payload.claimUrl}`,
        noteText.trim(),
        "Unclaimed gifts expire one year after purchase.",
      ]
        .filter(Boolean)
        .join("\n");
    } else if (payload.kind === "gift_sent") {
      const recipientLabel =
        payload.recipientName?.trim() ||
        payload.recipientEmail?.trim() ||
        "your recipient";
      subject = `Gift sent to ${recipientLabel} — ${payload.planName}`;
      html = wrapEmail(
        `Gift sent successfully`,
        `${giftHero("Gift delivered")}
        <p style="margin:0 0 12px;font-size:15px;line-height:1.55;color:#3f3f46;">
          Your gift of <strong>${escapeHtml(payload.monthsLabel)}</strong> of
          <strong>${escapeHtml(payload.planName)}</strong> was emailed to
          <strong>${escapeHtml(recipientLabel)}</strong> successfully.
          ${payload.recipientEmail?.trim() ? `(${escapeHtml(payload.recipientEmail.trim())})` : ""}
          They can claim it from the email. Unclaimed gifts expire one year after purchase.
        </p>
        ${noteHtml}
        <p style="margin:16px 0 0;font-size:13px;line-height:1.5;color:#71717a;word-break:break-all;">
          Backup claim link (in case their email bounces):<br>
          <a href="${escapeHtml(payload.claimUrl)}" style="color:#18181b;">${escapeHtml(payload.claimUrl)}</a>
        </p>`,
        "This is a confirmation from Clauxen. Your payment receipt was emailed separately.",
      );
      text = [
        `Your gift of ${payload.monthsLabel} of ${payload.planName} was emailed to ${recipientLabel} successfully.`,
        payload.recipientEmail?.trim() ? `Recipient: ${payload.recipientEmail.trim()}` : "",
        `Backup claim link: ${payload.claimUrl}`,
        noteText.trim(),
      ]
        .filter(Boolean)
        .join("\n");
    } else {
      subject = `You got ${payload.planName} — a Clauxen gift from ${payload.senderName}`;
      html = wrapEmail(
        `You got ${payload.planName}`,
        `${giftHero("You've received a gift")}
        <p style="margin:0 0 12px;font-size:15px;line-height:1.55;color:#3f3f46;">
          <strong>${escapeHtml(payload.senderName)}</strong> gifted you
          <strong>${escapeHtml(payload.monthsLabel)}</strong> of
          <strong>${escapeHtml(payload.planName)}</strong> on Clauxen. Claim it
          to activate your plan — gifts do not auto-renew and unclaimed gifts
          expire one year after purchase.
        </p>
        ${noteHtml}
        ${claimButton(payload.claimUrl)}
        ${codeHtml}
        <p style="margin:16px 0 0;font-size:13px;line-height:1.5;color:#71717a;">
          Having trouble with the button? Paste this link in your browser:<br>
          <a href="${escapeHtml(payload.claimUrl)}" style="color:#18181b;word-break:break-all;">${escapeHtml(payload.claimUrl)}</a>
        </p>`,
        "This gift email was sent by Clauxen. If you were not expecting it, you can ignore this message.",
      );
      text = [
        `You got ${payload.planName} of Clauxen (${payload.monthsLabel}) from ${payload.senderName}.`,
        noteText.trim(),
        `Claim: ${payload.claimUrl}`,
        code ? `Backup gift code: ${code}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    }
  } else if (
    payload.kind === "billing_address_saved" ||
    payload.kind === "billing_address_updated"
  ) {
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
  } else {
    return { ok: false, error: "unsupported_email_kind" };
  }

  try {
    const result = await env.EMAIL.send({
      to: payload.to,
      from: { email: fromEmail, name: fromName },
      subject,
      html,
      text,
    });
    const delivered = Array.isArray(result?.delivered) ? result.delivered : [];
    const queued = Array.isArray(result?.queued) ? result.queued : [];
    const bounced = Array.isArray(result?.permanent_bounces)
      ? result.permanent_bounces
      : [];
    const suppressed = Array.isArray(result?.suppressed_recipients)
      ? result.suppressed_recipients
      : [];
    const target = payload.to.trim().toLowerCase();
    const accepted = [...delivered, ...queued].some(
      (address) => address.trim().toLowerCase() === target,
    );
    const rejected = [...bounced, ...suppressed].some(
      (address) => address.trim().toLowerCase() === target,
    );
    if (rejected || ((delivered.length || queued.length || bounced.length || suppressed.length) && !accepted)) {
      return {
        ok: false,
        error: rejected
          ? "recipient_rejected"
          : "recipient_not_accepted",
      };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "send_failed",
    };
  }
}
