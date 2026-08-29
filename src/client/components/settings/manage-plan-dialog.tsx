"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import {
  cancelBillingSubscription,
  resumeBillingSubscription,
} from "@/lib/api/billing";
import { FullscreenPortal } from "@/components/fullscreen-portal";
import { SettingsPillButton } from "@/components/settings/settings-ui";
import { Switch } from "@/components/ui/switch";

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
      <div className="settings-theme fixed inset-0 z-[220] flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="manage-plan-title"
          className="w-full max-w-[520px] overflow-hidden rounded-[18px] border border-[var(--settings-modal-border)] bg-[var(--settings-elevated-bg)] text-[var(--settings-fg)] shadow-[var(--settings-modal-shadow)]"
        >
          <div className="flex items-start justify-between border-b border-[var(--settings-hairline)] px-5 py-4">
            <div>
              <h2
                id="manage-plan-title"
                className="text-[17px] font-semibold text-[var(--settings-fg)]"
              >
                Manage plan
              </h2>
              <p className="mt-0.5 text-[13px] text-[var(--settings-fg-muted)]">
                {planName}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-[var(--settings-fg-muted)] hover:bg-[var(--settings-nav-hover-bg)] hover:text-[var(--settings-fg)]"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex flex-col gap-5 px-5 py-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-[14px] font-medium text-[var(--settings-fg)]">
                  Auto-renew
                </div>
                <p className="mt-0.5 text-[12px] leading-4 text-[var(--settings-fg-muted)]">
                  {autoPay
                    ? renewLabel
                      ? `Renews on ${renewLabel}`
                      : "Your plan renews automatically."
                    : renewLabel
                      ? `Ends on ${renewLabel}`
                      : "Auto-renew is off."}
                </p>
              </div>
              <Switch
                checked={autoPay}
                onCheckedChange={(checked) => void setAutoRenew(checked)}
                disabled={busy}
                className="settings-switch"
              />
            </div>

            {confirmCancel ? (
              <div className="rounded-xl border border-[var(--settings-input-border)] bg-[var(--settings-sidebar-bg)] px-4 py-3">
                <p className="text-[13px] leading-5 text-[var(--settings-fg-muted)]">
                  Cancel at the end of the billing period
                  {renewLabel ? ` (${renewLabel})` : ""}. You keep access until
                  then.
                </p>
                <div className="mt-3 flex justify-end gap-2">
                  <SettingsPillButton onClick={() => setConfirmCancel(false)}>
                    Keep plan
                  </SettingsPillButton>
                  <SettingsPillButton
                    variant="danger"
                    disabled={busy}
                    onClick={() => void cancelSubscription()}
                  >
                    {busy ? "Canceling…" : "Confirm cancel"}
                  </SettingsPillButton>
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
                <SettingsPillButton
                  variant="danger"
                  disabled={busy || cancelAtPeriodEnd}
                  onClick={() => setConfirmCancel(true)}
                >
                  {cancelAtPeriodEnd ? "Cancellation scheduled" : "Cancel plan"}
                </SettingsPillButton>
              </div>
            )}

            {error ? <p className="text-[13px] text-red-600">{error}</p> : null}
          </div>
        </div>
      </div>
    </FullscreenPortal>
  );
}
