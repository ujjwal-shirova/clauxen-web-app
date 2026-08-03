"use client";

import React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

export type InvoiceLineItem = {
  label: string;
  sublabel?: string;
  quantity?: number | string;
  amount: number;
};

export type InvoiceData = {
  invoiceNumber: string;
  issuedAt: string;
  dueAt?: string;
  status: "paid" | "open" | "draft";
  currency: "INR" | "USD";
  billedTo: {
    name: string;
    email?: string;
    address?: string;
    gstin?: string;
  };
  items: InvoiceLineItem[];
  subtotal: number;
  tax?: { label: string; amount: number };
  total: number;
  paymentMethod?: string;
  razorpayPaymentId?: string;
  planName?: string;
  /** When set, Download PDF hits the server PDF route. */
  paymentId?: string;
  pdfAvailable?: boolean;
};

function formatAmount(amount: number, currency: string) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
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
        <div className="mb-8 flex items-start justify-between border-b border-zinc-200 pb-6">
          <div className="flex items-center gap-3">
            <Image
              src="/assets/icons/shirova-icon.jpeg"
              alt="Shirova"
              width={44}
              height={44}
              className="h-11 w-11 rounded-lg object-cover"
              priority
            />
            <div>
              <div className="text-[19px] font-semibold tracking-[-0.3px] text-zinc-950">
                Shirova
              </div>
            </div>
          </div>

          <div className="text-right">
            <div className="text-[28px] font-semibold tracking-[-0.5px] text-zinc-950">
              INVOICE
            </div>
            <div className="mt-1 text-xs text-zinc-500">
              #{data.invoiceNumber}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-x-10 gap-y-8 sm:grid-cols-2">
          <div>
            <div className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.5px] text-zinc-500">
              Billed to
            </div>
            <div className="text-[15px] font-medium text-zinc-900">
              {data.billedTo.name}
            </div>
            {data.billedTo.email && (
              <div className="text-[13px] text-zinc-600">
                {data.billedTo.email}
              </div>
            )}
            {data.billedTo.address && (
              <div className="mt-0.5 text-[13px] leading-snug text-zinc-600">
                {data.billedTo.address}
              </div>
            )}
            {data.billedTo.gstin && (
              <div className="mt-0.5 text-[13px] text-zinc-600">
                GSTIN: {data.billedTo.gstin}
              </div>
            )}
          </div>

          <div className="text-right sm:justify-self-end sm:text-left">
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
                <span className="font-medium text-zinc-800">
                  {data.invoiceNumber}
                </span>
              </div>
              {data.razorpayPaymentId && (
                <div className="text-[11px] text-zinc-500">
                  Razorpay: {data.razorpayPaymentId}
                </div>
              )}
            </div>

            <div
              className={cn(
                "mt-3 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
              )}
              style={{
                background: isPaid ? "#dcfce7" : "#fef3c7",
                color: isPaid ? "#166534" : "#854d0e",
              }}
            >
              {isPaid ? "PAID" : data.status.toUpperCase()}
            </div>
          </div>
        </div>

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
                  <td className="px-4 py-3.5 text-right align-top font-medium">
                    {formatAmount(item.amount, data.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

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

        <div className="mt-6 grid gap-4 text-[12px] text-zinc-500 sm:grid-cols-2">
          <div>
            Payment processed securely via{" "}
            <span className="font-medium text-zinc-700">Razorpay</span>.
          </div>
          <div className="sm:text-right">
            {data.paymentMethod ? (
              <>
                Method:{" "}
                <span className="font-medium text-zinc-700">
                  {data.paymentMethod}
                </span>
              </>
            ) : null}
          </div>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-end gap-3 border-t pt-6">
          {onDownload && (
            <button
              type="button"
              onClick={onDownload}
              className="rounded-lg border border-black/10 px-5 py-2 text-sm font-medium hover:bg-zinc-50"
            >
              Download PDF
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-zinc-900 px-6 py-2 text-sm font-medium text-white hover:bg-black"
            >
              Done
            </button>
          )}
        </div>

        <p className="mt-8 text-center text-[10px] text-zinc-400">
          This is a computer-generated tax invoice for your records.
        </p>
      </div>
    </div>
  );
}
