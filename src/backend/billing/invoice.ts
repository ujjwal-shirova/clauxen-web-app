import type { BillingInvoicePayload } from "@/backend/billing/billing-worker";

type OrderRow = {
  id: string;
  razorpay_order_id: string;
  user_id: string;
  user_email: string | null;
  plan_id: string;
  plan_name: string;
  billing_cycle: string;
  max_tier: string | null;
  subtotal_paise: number;
  tax_paise: number;
  amount_paise: number;
  currency: string;
  paid_at: string | null;
  fulfilled_at: string | null;
  metadata: Record<string, unknown> | null;
};

type PaymentRow = {
  id: string;
  method: string | null;
  status: string;
  captured_at: string | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function invoiceNumberFrom(paymentId: string, orderId: string): string {
  const raw = (paymentId || orderId).replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return `INV-${raw.slice(-12)}`;
}

function nextBillingIso(billingCycle: string, fromIso: string): string {
  const d = new Date(fromIso);
  if (Number.isNaN(d.getTime())) {
    return new Date().toISOString();
  }
  if (billingCycle === "yearly") {
    d.setFullYear(d.getFullYear() + 1);
  } else {
    d.setMonth(d.getMonth() + 1);
  }
  return d.toISOString();
}

/**
 * Build a server-authoritative invoice payload from fulfilled order + payment.
 * Never trusts client-provided totals.
 */
export function buildInvoicePayloadFromOrder(input: {
  order: OrderRow;
  payment: PaymentRow;
}): BillingInvoicePayload {
  const { order, payment } = input;
  const meta = asRecord(order.metadata);
  const billing = asRecord(meta.billingDetails);
  const taxMeta = asRecord(meta.tax);
  const seatBreakdown = asRecord(meta.seatBreakdown);
  const orgSeats =
    typeof meta.organizationSeatCount === "number"
      ? meta.organizationSeatCount
      : null;

  const currency =
    (order.currency || "INR").toUpperCase() === "USD" ? "USD" : "INR";
  const issuedAt =
    payment.captured_at ||
    order.paid_at ||
    order.fulfilled_at ||
    new Date().toISOString();

  const taxLabel =
    typeof taxMeta.label === "string" && taxMeta.label
      ? taxMeta.label
      : order.tax_paise > 0
        ? currency === "INR"
          ? "IGST (18%)"
          : "Tax"
        : null;

  const cycleLabel =
    order.billing_cycle === "yearly" ? "billed yearly" : "billed monthly";
  const tierLabel = order.max_tier
    ? `Max ${order.max_tier}`
    : order.plan_name;

  const items: BillingInvoicePayload["items"] = [
    {
      label: order.plan_name || order.plan_id,
      sublabel: `${tierLabel} · ${cycleLabel} · auto-renew`,
      quantity: "1",
      unitAmountPaise: order.subtotal_paise,
      taxPaise: order.tax_paise > 0 ? order.tax_paise : undefined,
      amountPaise: order.amount_paise,
    },
  ];

  const seats: BillingInvoicePayload["seats"] = [];
  for (const [planKey, count] of Object.entries(seatBreakdown)) {
    if (typeof count === "number" && count > 0) {
      seats.push({
        planName: planKey,
        seats: count,
        unitPaise: 0,
        amountPaise: 0,
      });
    }
  }
  if (orgSeats && orgSeats > 0) {
    seats.push({
      planName: order.plan_name || "Workspace",
      seats: orgSeats,
      unitPaise: 0,
      amountPaise: 0,
    });
  }

  const fullName =
    (typeof billing.fullName === "string" && billing.fullName) ||
    (typeof billing.billToName === "string" && billing.billToName) ||
    order.user_email ||
    "Customer";

  return {
    invoiceNumber: invoiceNumberFrom(payment.id, order.razorpay_order_id),
    paymentId: payment.id,
    orderId: order.razorpay_order_id,
    userId: order.user_id,
    issuedAt,
    nextBillingAt: nextBillingIso(order.billing_cycle, issuedAt),
    currency,
    status: payment.status === "captured" ? "paid" : "open",
    billedTo: {
      name: fullName,
      email: order.user_email ?? undefined,
      address:
        typeof billing.addressLine === "string"
          ? billing.addressLine
          : undefined,
      gstin:
        typeof billing.gstin === "string" ? billing.gstin : undefined,
    },
    planName: order.plan_name,
    billingCycle: order.billing_cycle,
    items,
    ...(seats.length ? { seats } : {}),
    subtotalPaise: order.subtotal_paise,
    tax:
      taxLabel && order.tax_paise > 0
        ? { label: taxLabel, amountPaise: order.tax_paise }
        : taxLabel && order.tax_paise === 0
          ? { label: taxLabel, amountPaise: 0 }
          : null,
    totalPaise: order.amount_paise,
    amountPaidPaise: order.amount_paise,
    paymentMethod: payment.method ?? undefined,
    razorpayPaymentId: payment.id,
    autoRenew: true,
  };
}

/** UI-friendly snapshot for InvoiceView (amounts in major units). */
export function invoicePayloadToViewData(payload: BillingInvoicePayload) {
  return {
    invoiceNumber: payload.invoiceNumber,
    issuedAt: new Date(payload.issuedAt).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
    dueAt: payload.nextBillingAt
      ? new Date(payload.nextBillingAt).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : undefined,
    status: payload.status,
    currency: payload.currency,
    billedTo: payload.billedTo,
    items: [
      ...payload.items.map((item) => ({
        label: item.label,
        sublabel: item.sublabel,
        quantity: item.quantity,
        amount: item.amountPaise / 100,
      })),
      ...(payload.seats ?? []).map((seat) => ({
        label: `${seat.planName} · ${seat.seats} seat${seat.seats === 1 ? "" : "s"}`,
        sublabel: "Team / Enterprise seats",
        quantity: String(seat.seats),
        amount: seat.amountPaise / 100,
      })),
    ],
    subtotal: payload.subtotalPaise / 100,
    tax: payload.tax
      ? { label: payload.tax.label, amount: payload.tax.amountPaise / 100 }
      : undefined,
    total: payload.totalPaise / 100,
    paymentMethod: payload.paymentMethod,
    razorpayPaymentId: payload.razorpayPaymentId,
    planName: payload.planName,
    pdfAvailable: true,
    paymentId: payload.paymentId,
  };
}
