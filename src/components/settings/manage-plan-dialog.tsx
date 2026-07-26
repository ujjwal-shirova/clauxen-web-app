"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import {
  cancelBillingSubscription,
  resumeBillingSubscription,
} from "@/lib/api/billing";
import { FullscreenPortal } from "@/components/fullscreen-portal";
import { SettingsPillButton } from "@/components/settings/settings-ui";

type ManagePlanDialogProps = {
  open: boolean;
  planName: string;
  periodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  onClose: () => void;
  onUpdated: (next: {
    cancelAtPeriodEnd: boolean;
    periodEnd: string | null;
  }) => void;
  onUpgradeClick?: () => void;
};

function formatDate(iso: string | null | undefined) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return null;
  }
}

export function ManagePlanDialog({
  open,
  planName,
  periodEnd,
  cancelAtPeriodEnd,
  onClose,
  onUpdated,
  onUpgradeClick,
}: ManagePlanDialogProps) {
  const [autoPay, setAutoPay] = useState(!cancelAtPeriodEnd);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAutoPay(!cancelAtPeriodEnd);
    setError(null);
    setConfirmCancel(false);
  }, [open, cancelAtPeriodEnd]);

  if (!open) return null;

  const renewLabel = formatDate(periodEnd);

  const setAutoRenew = async (enabled: boolean) => {
    setBusy(true);
    setError(null);
    try {
      if (enabled) {
        const res = await resumeBillingSubscription();
        setAutoPay(true);
        onUpdated({
          cancelAtPeriodEnd: !!res.subscription.cancel_at_period_end,
          periodEnd: res.subscription.current_period_end,
        });
      } else {
        const res = await cancelBillingSubscription();
        setAutoPay(false);
        onUpdated({
          cancelAtPeriodEnd: !!res.subscription.cancel_at_period_end,
          periodEnd: res.subscription.current_period_end,
        });
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not update auto-renew.",
      );
      setAutoPay(!enabled);
    } finally {
      setBusy(false);
    }
  };

  const cancelSubscription = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await cancelBillingSubscription();
      setAutoPay(false);
      setConfirmCancel(false);
      onUpdated({
        cancelAtPeriodEnd: !!res.subscription.cancel_at_period_end,
        periodEnd: res.subscription.current_period_end,
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not cancel subscription.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <FullscreenPortal>
      <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/40 p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="manage-plan-title"
          className="w-full max-w-md rounded-2xl bg-white shadow-xl"
        >
          <div className="flex items-start justify-between border-b border-zinc-100 px-5 py-4">
            <div>
              <h2
                id="manage-plan-title"
                className="text-[17px] font-semibold text-zinc-900"
              >
                Manage plan
              </h2>
              <p className="mt-0.5 text-[13px] text-zinc-500">{planName}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex flex-col gap-5 px-5 py-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-[14px] font-medium text-zinc-900">
                  Auto-renew
                </div>
                <p className="mt-0.5 text-[12px] leading-4 text-zinc-500">
                  {autoPay
                    ? renewLabel
                      ? `Renews on ${renewLabel}`
                      : "Your plan renews automatically."
                    : renewLabel
                      ? `Ends on ${renewLabel}`
                      : "Auto-renew is off."}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={autoPay}
                disabled={busy}
                onClick={() => void setAutoRenew(!autoPay)}
                className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-60 ${
                  autoPay ? "bg-zinc-900" : "bg-zinc-200"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                    autoPay ? "left-[22px]" : "left-0.5"
                  }`}
                />
              </button>
            </div>

            {confirmCancel ? (
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                <p className="text-[13px] leading-5 text-zinc-700">
                  Cancel at the end of the billing period
                  {renewLabel ? ` (${renewLabel})` : ""}. You keep access until
                  then.
                </p>
                <div className="mt-3 flex justify-end gap-2">
                  <SettingsPillButton onClick={() => setConfirmCancel(false)}>
                    Keep plan
                  </SettingsPillButton>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void cancelSubscription()}
                    className="inline-flex h-9 items-center justify-center rounded-full bg-zinc-900 px-4 text-[14px] font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
                  >
                    {busy ? "Canceling…" : "Confirm cancel"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
                <SettingsPillButton
                  onClick={() => {
                    onClose();
                    onUpgradeClick?.();
                  }}
                >
                  Change plan
                </SettingsPillButton>
                <button
                  type="button"
                  disabled={busy || cancelAtPeriodEnd}
                  onClick={() => setConfirmCancel(true)}
                  className="inline-flex h-9 items-center justify-center rounded-full border border-zinc-200 px-4 text-[14px] font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-default disabled:opacity-50"
                >
                  {cancelAtPeriodEnd ? "Cancellation scheduled" : "Cancel plan"}
                </button>
              </div>
            )}

            {error ? (
              <p className="text-[13px] text-red-600">{error}</p>
            ) : null}
          </div>
        </div>
      </div>
    </FullscreenPortal>
  );
}
