"use client";

import React from "react";
import { cn } from "@/frontend/lib/utils";

// Beautiful enterprise-grade invoice component.
// Styled after premium SaaS invoices (clean table, clear hierarchy, logo + PAID status).
// This is generated client-side from the just-completed payment for instant gratification.
// For production PDF you can:
//   1. Print → Save as PDF (best cross platform)
//   2. Or add pdfkit / @react-pdf/renderer on the server for true PDF generation
//      (see comments at bottom of file).

export type InvoiceLineItem = {
  label: string;
  sublabel?: string;
  quantity?: number | string;
  amount: number; // in paise or rupees (we'll format as INR)
};

export type InvoiceData = {
  invoiceNumber: string; // e.g. order id or inv_ prefix
  issuedAt: string; // ISO or formatted
  dueAt?: string;
  status: "paid" | "open" | "draft";
  currency: "INR" | "USD";
  billedTo: {
    name: string;
    email?: string;
    address?: string;
  };
  items: InvoiceLineItem[];
  subtotal: number;
  tax?: { label: string; amount: number };
  total: number;
  paymentMethod?: string;
  razorpayPaymentId?: string;
  planName?: string;
};

function formatAmount(amount: number, currency: string) {
  const val = amount; // assuming already in rupees for display; caller controls
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(val);
}

export function InvoiceView({
  data,
  onClose,
  onDownload,
}: {
  data: InvoiceData;
  onClose?: () => void;
  onDownload?: () => void;
}) {
  const isPaid = data.status === "paid";

  return (
    <div className="fixed inset-0 z-[120] overflow-auto bg-white">
      <div className="mx-auto max-w-[820px] px-6 py-10 sm:px-10">
        {/* Header with logo + INVOICE */}
        <div className="mb-8 flex items-start justify-between border-b pb-6">
          <div className="flex items-center gap-3">
            {/* App icon / logo - replace with real SVG or next/image of your mark */}
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-black text-white">
              <span className="text-[15px] font-semibold">C</span>
            </div>
            <div>
              <div className="text-[19px] font-semibold tracking-[-0.3px] text-zinc-950">
                Clauxen
              </div>
              <div className="text-[11px] text-zinc-500 -mt-0.5">
                Premium AI Workspace
              </div>
            </div>
          </div>

          <div className="text-right">
            <div className="text-[28px] font-semibold tracking-[-0.5px] text-zinc-950">INVOICE</div>
            <div className="mt-1 text-xs text-zinc-500">#{data.invoiceNumber}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-x-10 gap-y-8 sm:grid-cols-2">
          {/* Billed To */}
          <div>
            <div className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.5px] text-zinc-500">
              Billed to
            </div>
            <div className="text-[15px] font-medium text-zinc-900">{data.billedTo.name}</div>
            {data.billedTo.email && (
              <div className="text-[13px] text-zinc-600">{data.billedTo.email}</div>
            )}
            {data.billedTo.address && (
              <div className="mt-0.5 text-[13px] leading-snug text-zinc-600">
                {data.billedTo.address}
              </div>
            )}
          </div>

          {/* Invoice meta */}
          <div className="text-right sm:text-left sm:justify-self-end">
            <div className="space-y-1 text-[13px]">
              <div>
                <span className="text-zinc-500">Invoice issued:</span>{" "}
                <span className="font-medium text-zinc-800">{data.issuedAt}</span>
              </div>
              {data.dueAt && (
                <div>
                  <span className="text-zinc-500">Next billing:</span>{" "}
                  <span className="font-medium text-zinc-800">{data.dueAt}</span>
                </div>
              )}
              <div>
                <span className="text-zinc-500">Order #:</span>{" "}
                <span className="font-medium text-zinc-800">{data.invoiceNumber}</span>
              </div>
              {data.razorpayPaymentId && (
                <div className="text-[11px] text-zinc-500">
                  Razorpay: {data.razorpayPaymentId}
                </div>
              )}
            </div>

            <div className="mt-3 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
                 style={{
                   background: isPaid ? "#dcfce7" : "#fef3c7",
                   color: isPaid ? "#166534" : "#854d0e",
                 }}>
              {isPaid ? "PAID" : data.status.toUpperCase()}
            </div>
          </div>
        </div>

        {/* Line items table - clean enterprise style */}
        <div className="mt-8 overflow-hidden rounded-xl border border-zinc-200">
          <table className="w-full border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-b bg-zinc-50 text-xs font-medium uppercase tracking-wider text-zinc-500">
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3 text-right">Qty / Period</th>
                <th className="px-4 py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-zinc-800">
              {data.items.map((item, index) => (
                <tr key={index}>
                  <td className="px-4 py-3.5 align-top">
                    <div className="font-medium">{item.label}</div>
                    {item.sublabel && (
                      <div className="text-xs text-zinc-500">{item.sublabel}</div>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-right align-top text-zinc-600">
                    {item.quantity ?? "1"}
                  </td>
                  <td className="px-4 py-3.5 text-right font-medium align-top">
                    {formatAmount(item.amount, data.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="border-t bg-white px-4 py-4 text-[13px]">
            <div className="flex justify-between py-1 text-zinc-600">
              <span>Subtotal</span>
              <span className="font-medium text-zinc-800">
                {formatAmount(data.subtotal, data.currency)}
              </span>
            </div>

            {data.tax && (
              <div className="flex justify-between py-1 text-zinc-600">
                <span>{data.tax.label}</span>
                <span className="font-medium text-zinc-800">
                  {formatAmount(data.tax.amount, data.currency)}
                </span>
              </div>
            )}

            <div className="mt-2 flex justify-between border-t pt-2 text-base font-semibold text-zinc-950">
              <span>Total paid</span>
              <span>{formatAmount(data.total, data.currency)}</span>
            </div>
          </div>
        </div>

        {/* Payment & security footer */}
        <div className="mt-6 grid gap-4 text-[12px] text-zinc-500 sm:grid-cols-2">
          <div>
            Payment processed securely via{" "}
            <span className="font-medium text-zinc-700">Razorpay</span>.
            <br />
            All transactions are protected with strong cryptographic verification.
          </div>
          <div className="sm:text-right">
            {data.paymentMethod && (
              <>Method: <span className="font-medium text-zinc-700">{data.paymentMethod}</span><br /></>
            )}
            Thank you for supporting Clauxen.
          </div>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-end gap-3 border-t pt-6">
          {onDownload && (
            <button
              onClick={onDownload}
              className="rounded-lg border border-black/10 px-5 py-2 text-sm font-medium hover:bg-zinc-50"
            >
              Download PDF
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="rounded-lg bg-zinc-900 px-6 py-2 text-sm font-medium text-white hover:bg-black"
            >
              Done
            </button>
          )}
        </div>

        <p className="mt-8 text-center text-[10px] text-zinc-400">
          This is a computer-generated receipt for your records.
        </p>
      </div>
    </div>
  );
}

/*
 * ROBUST CUSTOM INVOICE GENERATOR NOTES
 *
 * For true server-generated PDF (recommended for emails + archival):
 *   - Install: npm i pdfkit
 *   - Create a server route /api/v1/billing/invoices/[id]/pdf that uses pdfkit
 *     to draw the exact same layout (logo, table, totals, PAID badge).
 *   - pdfkit is a very strong, widely-used low-level PDF library used by
 *     many fintechs and SaaS for custom invoices.
 *
 * Alternative declarative option:
 *   npm i @react-pdf/renderer
 *   Then render <Document><Page>...</Page></Document> server-side.
 *
 * Razorpay side:
 *   You can also create a Razorpay Invoice record after payment for their
 *   hosted receipt if desired (see https://razorpay.com/docs/api/invoices/ ).
 *   But for branded on-product experience we generate our own.
 *
 * Security:
 *   Invoice data should be fetched server-side using the authenticated user's
 *   completed billing_order / billing_payments. Never trust client-provided
 *   totals for the final document.
 */
