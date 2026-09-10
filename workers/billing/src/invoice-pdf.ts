import { PDFDocument, StandardFonts, rgb, type PDFImage } from "pdf-lib";
import type { InvoiceGenerateRequest } from "./types";
import { SHIROVA_LOGO_JPEG_BASE64 } from "./logo-bytes";

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function formatMoney(paise: number, currency: string): string {
  const major = paise / 100;
  try {
    return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(major);
  } catch {
    return `${currency} ${major.toFixed(2)}`;
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Hostinger-inspired minimal invoice PDF.
 * Generated entirely server-side on Cloudflare Workers (pdf-lib).
 *
 * Brand: Clauxen (product) issued by the legal entity in `issuer`.
 * Export invoices (zero-rated, USD) carry the LUT declaration line.
 */
export async function buildInvoicePdf(
  data: InvoiceGenerateRequest,
  issuer: {
    name: string;
    brand?: string;
    legal: string;
    address: string;
    gstin?: string;
    lutNumber?: string;
  },
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // A4
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  let logo: PDFImage | null = null;
  try {
    logo = await doc.embedJpg(base64ToBytes(SHIROVA_LOGO_JPEG_BASE64));
  } catch {
    logo = null;
  }

  const black = rgb(0.07, 0.07, 0.07);
  const muted = rgb(0.45, 0.45, 0.48);
  const line = rgb(0.88, 0.88, 0.9);
  const paidGreen = rgb(0.09, 0.55, 0.29);

  const margin = 48;
  let y = page.getHeight() - margin;

  // Header: logo + issuer (left) | INVOICE meta (right)
  if (logo) {
    const logoH = 36;
    const logoW = (logo.width / logo.height) * logoH;
    page.drawImage(logo, {
      x: margin,
      y: y - logoH,
      width: Math.min(logoW, 44),
      height: logoH,
    });
  }

  page.drawText(issuer.brand || issuer.name, {
    x: margin + 52,
    y: y - 14,
    size: 16,
    font: fontBold,
    color: black,
  });
  page.drawText(issuer.legal, {
    x: margin + 52,
    y: y - 30,
    size: 8,
    font,
    color: muted,
  });
  page.drawText(issuer.address, {
    x: margin + 52,
    y: y - 42,
    size: 8,
    font,
    color: muted,
  });
  if (issuer.gstin && data.invoiceKind !== "export_lut") {
    page.drawText(`GSTIN: ${issuer.gstin}`, {
      x: margin + 52,
      y: y - 54,
      size: 8,
      font,
      color: muted,
    });
  }

  const isExport = data.invoiceKind === "export_lut";
  const rightX = 340;
  page.drawText(isExport ? "EXPORT INVOICE" : "INVOICE", {
    x: rightX,
    y: y - 14,
    size: isExport ? 16 : 22,
    font: fontBold,
    color: black,
  });
  const lutNumber = (data.lutNumber || issuer.lutNumber || "").trim();
  if (isExport) {
    page.drawText(
      lutNumber
        ? `Supply for export under LUT ${lutNumber} without IGST`
        : "Zero-rated supply — no GST charged",
      {
        x: rightX,
        y: y - 28,
        size: 7,
        font,
        color: muted,
      },
    );
  }

  const meta: Array<[string, string]> = [
    ["Invoice #", data.invoiceNumber],
    ["Invoice Issued", formatDate(data.issuedAt)],
    ["Invoice Amount", formatMoney(data.totalPaise, data.currency)],
  ];
  if (data.nextBillingAt) {
    meta.push(["Next Billing Date", formatDate(data.nextBillingAt)]);
  }
  meta.push(["Order Number", data.orderId.slice(0, 28)]);

  let metaY = y - (isExport ? 54 : 40);
  for (const [label, value] of meta) {
    page.drawText(`${label}:`, {
      x: rightX,
      y: metaY,
      size: 8,
      font,
      color: muted,
    });
    page.drawText(value, {
      x: rightX + 100,
      y: metaY,
      size: 8,
      font: fontBold,
      color: black,
    });
    metaY -= 14;
  }

  if (data.status === "paid") {
    page.drawText("PAID", {
      x: rightX,
      y: metaY - 4,
      size: 12,
      font: fontBold,
      color: paidGreen,
    });
  }

  y = Math.min(y - 110, metaY - 28);

  page.drawLine({
    start: { x: margin, y },
    end: { x: page.getWidth() - margin, y },
    thickness: 0.6,
    color: line,
  });
  y -= 28;

  // Billed to
  page.drawText("BILLED TO", {
    x: margin,
    y,
    size: 8,
    font: fontBold,
    color: muted,
  });
  y -= 16;
  page.drawText(data.billedTo.name || "Customer", {
    x: margin,
    y,
    size: 11,
    font: fontBold,
    color: black,
  });
  y -= 14;
  if (data.billedTo.email) {
    page.drawText(data.billedTo.email, {
      x: margin,
      y,
      size: 9,
      font,
      color: muted,
    });
    y -= 12;
  }
  if (data.billedTo.address) {
    const addrLines = wrapText(data.billedTo.address, 70);
    for (const al of addrLines) {
      page.drawText(al, {
        x: margin,
        y,
        size: 9,
        font,
        color: muted,
      });
      y -= 12;
    }
  }
  if (data.billedTo.gstin) {
    page.drawText(`GSTIN: ${data.billedTo.gstin}`, {
      x: margin,
      y,
      size: 9,
      font,
      color: muted,
    });
    y -= 12;
  }

  y -= 18;

  // Table header
  const cols = {
    desc: margin,
    price: 300,
    tax: 400,
    amount: 480,
  };

  page.drawText("DESCRIPTION", {
    x: cols.desc,
    y,
    size: 7,
    font: fontBold,
    color: muted,
  });
  page.drawText("PRICE", {
    x: cols.price,
    y,
    size: 7,
    font: fontBold,
    color: muted,
  });
  page.drawText("TAX", {
    x: cols.tax,
    y,
    size: 7,
    font: fontBold,
    color: muted,
  });
  page.drawText("AMOUNT", {
    x: cols.amount,
    y,
    size: 7,
    font: fontBold,
    color: muted,
  });
  y -= 8;
  page.drawLine({
    start: { x: margin, y },
    end: { x: page.getWidth() - margin, y },
    thickness: 0.6,
    color: line,
  });
  y -= 18;

  const drawItem = (
    label: string,
    sublabel: string | undefined,
    price: string,
    tax: string,
    amount: string,
  ) => {
    page.drawText(label.slice(0, 48), {
      x: cols.desc,
      y,
      size: 9,
      font: fontBold,
      color: black,
    });
    if (sublabel) {
      page.drawText(sublabel.slice(0, 60), {
        x: cols.desc,
        y: y - 11,
        size: 7,
        font,
        color: muted,
      });
    }
    page.drawText(price, {
      x: cols.price,
      y,
      size: 8,
      font,
      color: black,
    });
    page.drawText(tax, {
      x: cols.tax,
      y,
      size: 8,
      font,
      color: black,
    });
    page.drawText(amount, {
      x: cols.amount,
      y,
      size: 8,
      font: fontBold,
      color: black,
    });
    y -= sublabel ? 28 : 18;
  };

  for (const item of data.items) {
    drawItem(
      item.label,
      item.sublabel,
      formatMoney(item.unitAmountPaise, data.currency) +
        (item.quantity ? ` x ${item.quantity}` : ""),
      item.taxPaise != null
        ? formatMoney(item.taxPaise, data.currency)
        : "—",
      formatMoney(item.amountPaise, data.currency),
    );
  }

  if (data.seats?.length) {
    for (const seat of data.seats) {
      drawItem(
        `${seat.planName} seats`,
        `${seat.seats} seat${seat.seats === 1 ? "" : "s"}`,
        formatMoney(seat.unitPaise, data.currency) + ` x ${seat.seats}`,
        "—",
        formatMoney(seat.amountPaise, data.currency),
      );
    }
  }

  y -= 10;
  page.drawLine({
    start: { x: margin, y },
    end: { x: page.getWidth() - margin, y },
    thickness: 0.6,
    color: line,
  });
  y -= 22;

  // Totals (right-aligned block)
  const totalsX = 360;
  const drawTotalRow = (
    label: string,
    value: string,
    bold = false,
  ) => {
    page.drawText(label, {
      x: totalsX,
      y,
      size: 9,
      font: bold ? fontBold : font,
      color: bold ? black : muted,
    });
    page.drawText(value, {
      x: totalsX + 120,
      y,
      size: 9,
      font: bold ? fontBold : font,
      color: black,
    });
    y -= 16;
  };

  drawTotalRow(
    "Total excl. tax",
    formatMoney(data.subtotalPaise, data.currency),
  );
  if (data.tax && data.tax.amountPaise > 0) {
    drawTotalRow(
      data.tax.label,
      formatMoney(data.tax.amountPaise, data.currency),
    );
  }
  y -= 4;
  page.drawLine({
    start: { x: totalsX, y: y + 10 },
    end: { x: page.getWidth() - margin, y: y + 10 },
    thickness: 0.8,
    color: line,
  });
  drawTotalRow("Total", formatMoney(data.totalPaise, data.currency), true);
  drawTotalRow(
    "Payments",
    `(${formatMoney(data.amountPaidPaise, data.currency)})`,
  );
  y -= 4;
  page.drawLine({
    start: { x: totalsX, y: y + 10 },
    end: { x: page.getWidth() - margin, y: y + 10 },
    thickness: 1,
    color: black,
  });
  drawTotalRow(
    `Amount Due (${data.currency})`,
    formatMoney(
      Math.max(0, data.totalPaise - data.amountPaidPaise),
      data.currency,
    ),
    true,
  );

  y -= 24;
  if (data.autoRenew && data.nextBillingAt) {
    page.drawText(
      `Auto-renews on ${formatDate(data.nextBillingAt)}. Cancel anytime from Billing settings.`,
      {
        x: margin,
        y,
        size: 8,
        font,
        color: muted,
      },
    );
    y -= 14;
  }

  page.drawText(
    "This is a computer-generated tax invoice. Payment processed securely via Razorpay.",
    {
      x: margin,
      y: 40,
      size: 7,
      font,
      color: muted,
    },
  );

  return doc.save();
}

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length > maxChars) {
      if (cur) lines.push(cur);
      cur = w;
    } else {
      cur = next;
    }
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 4);
}
