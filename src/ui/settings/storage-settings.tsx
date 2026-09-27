"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { openRazorpayCheckout } from "@/lib/razorpay-checkout";
import {
  STORAGE_PLAN_LADDER,
  STORAGE_USD_PER_GB,
  storageAddonAmountPaise,
  storageAddonUsdMicros,
} from "@/lib/storage-quota";
import * as settingsApi from "@/lib/api/settings-extended";
import type { StorageSummary } from "@/lib/api/settings-extended";
import {
  SettingsButton,
  SettingsInlineNote,
  SettingsPage,
  SettingsPanelTitle,
  SettingsProgressBar,
  SettingsSection,
  SettingsStatusBadge,
} from "@/components/settings/settings-ui";
import { AppContentLoader } from "@/components/app-content-loader";
import { cn } from "@/lib/utils";

const PRESETS = [10, 25, 50, 100] as const;

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const gb = bytes / 1024 ** 3;
  if (gb >= 1) return gb % 1 === 0 ? `${gb} GB` : `${gb.toFixed(1)} GB`;
  const mb = bytes / 1024 ** 2;
  if (mb >= 1) return `${Math.round(mb)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function formatUsdFromMicros(micros: number) {
  const usd = micros / 1_000_000;
  if (usd < 1) return `$${usd.toFixed(3)}`;
  return `$${usd.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatInrFromPaise(paise: number) {
  return `₹${(paise / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatWhen(iso: string | null) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

export function StorageSettings({
  userEmail,
  userName,
}: {
  userEmail?: string | null;
  userName?: string | null;
}) {
  const auth = useAuth();
  const [loading, setLoading] = useState(true);
  const [storage, setStorage] = useState<StorageSummary | null>(null);
  const [gigabytes, setGigabytes] = useState(10);
  const [buying, setBuying] = useState(false);
  const [note, setNote] = useState<{ tone: "muted" | "danger"; text: string } | null>(
    null,
  );

  const load = useCallback(async () => {
    if (!auth.isAuthenticated) {
      setLoading(false);
      return;
    }
    try {
      const { storage: summary } = await settingsApi.getStorageSummary();
      setStorage(summary);
    } catch {
      setStorage(null);
    } finally {
      setLoading(false);
    }
  }, [auth.isAuthenticated]);

  useEffect(() => {
    void load();
  }, [load]);

  const rate = storage?.usdInrRate ?? 95.58;
  const quote = useMemo(() => {
    const gb = Number.isInteger(gigabytes) ? gigabytes : 0;
    if (gb < 1) return null;
    return {
      gb,
      usd: formatUsdFromMicros(storageAddonUsdMicros(gb)),
      inr: formatInrFromPaise(storageAddonAmountPaise(gb, rate)),
    };
  }, [gigabytes, rate]);

  const buy = async () => {
    if (!quote) return;
    setBuying(true);
    setNote(null);
    try {
      const { purchase } = await settingsApi.startStoragePurchase(quote.gb);
      await openRazorpayCheckout({
        keyId: purchase.keyId,
        orderId: purchase.orderId,
        amount: purchase.amountPaise,
        currency: purchase.currency,
        name: "Clauxen",
        description: `${purchase.gigabytes} GB storage · ${STORAGE_USD_PER_GB.toFixed(3)}/GB`,
        prefill: {
          email: userEmail ?? auth.user?.email ?? undefined,
          name: userName ?? auth.user?.displayName ?? undefined,
        },
        onSuccess: async (payment) => {
          await settingsApi.verifyStoragePurchase({
            purchaseId: purchase.id,
            razorpayOrderId: payment.razorpay_order_id,
            razorpayPaymentId: payment.razorpay_payment_id,
            razorpaySignature: payment.razorpay_signature,
          });
          setNote({
            tone: "muted",
            text: `${purchase.gigabytes} GB was added to this account.`,
          });
          await load();
        },
        onDismiss: () => {
          setNote({ tone: "muted", text: "Checkout was cancelled." });
        },
      });
    } catch (error) {
      setNote({
        tone: "danger",
        text:
          error instanceof Error
            ? error.message
            : "Could not start the storage purchase.",
      });
    } finally {
      setBuying(false);
    }
  };

  if (loading) return <AppContentLoader label="Loading storage" />;

  const used = storage?.usedBytes ?? 0;
  const quota = storage?.quotaBytes ?? 1024 ** 3;
  const includedGb = storage?.includedGb ?? 1;
  const extraGb = storage?.extraGb ?? 0;
  const tier = storage?.tier ?? "free";

  return (
    <SettingsPage>
      <SettingsPanelTitle>Storage</SettingsPanelTitle>

      <SettingsSection
        title="Allowance"
        description="Free 1 GB, Go 10 GB, Pro 25 GB, Max 50 GB. Extra space is $0.026 per GB."
      >
        <div className="px-3.5 py-4 sm:px-4">
          <SettingsProgressBar
            value={used}
            max={quota}
            label={`${formatBytes(used)} of ${formatBytes(quota)} used`}
          />
          <p className="mt-3 text-[12.5px] leading-5 text-[var(--settings-fg-muted)]">
            {includedGb} GB included
            {extraGb > 0 ? ` · ${extraGb} GB add-on` : ""}
          </p>
          <ol className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {STORAGE_PLAN_LADDER.map((step) => {
              const current = step.id === tier;
              return (
                <li
                  key={step.id}
                  className={cn(
                    "rounded-[10px] border px-3 py-2.5",
                    current
                      ? "border-[var(--settings-fg)] bg-[var(--settings-elevated-bg)]"
                      : "border-[var(--settings-hairline)]",
                  )}
                >
                  <p className="text-[12px] text-[var(--settings-fg-muted)]">
                    {step.label}
                  </p>
                  <p className="mt-0.5 text-[14px] font-semibold tabular-nums text-[var(--settings-fg)]">
                    {step.gb} GB
                  </p>
                  {current ? (
                    <p className="mt-1 text-[11px] font-medium text-[var(--settings-fg-muted)]">
                      Current
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </div>
        {storage && storage.categories.length > 0 ? (
          <ul className="border-t border-[var(--settings-hairline)] px-3.5 py-3 sm:px-4">
            {storage.categories.map((category) => (
              <li
                key={category.id}
                className="flex items-center justify-between gap-3 py-1.5 text-[13px]"
              >
                <span className="text-[var(--settings-fg-muted)]">
                  {category.title}
                  <span className="text-[var(--settings-fg-subtle)]">
                    {" "}
                    · {category.count}
                  </span>
                </span>
                <span className="tabular-nums text-[var(--settings-fg)]">
                  {formatBytes(category.bytes)}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </SettingsSection>

      <SettingsSection
        title="Add storage"
        description="Buy extra space for this account. It stays if you change plans."
        action={
          <SettingsButton
            variant="primary"
            size="sm"
            disabled={buying || !quote || !auth.isAuthenticated}
            onClick={() => void buy()}
          >
            {buying ? "Opening checkout…" : quote ? `Buy ${quote.gb} GB` : "Buy"}
          </SettingsButton>
        }
      >
        <div className="flex flex-col gap-3 px-3.5 py-4 sm:px-4">
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((preset) => (
              <SettingsButton
                key={preset}
                size="sm"
                variant={gigabytes === preset ? "primary" : "default"}
                onClick={() => setGigabytes(preset)}
              >
                {preset} GB
              </SettingsButton>
            ))}
          </div>
          <label className="flex items-center gap-3 text-[13px] text-[var(--settings-fg)]">
            <span className="shrink-0 text-[var(--settings-fg-muted)]">
              Gigabytes
            </span>
            <input
              type="number"
              min={1}
              max={10000}
              step={1}
              value={gigabytes}
              onChange={(event) => {
                const next = Number(event.target.value);
                if (Number.isFinite(next)) {
                  setGigabytes(Math.min(10000, Math.max(1, Math.floor(next))));
                }
              }}
              className="cx-field !h-8 !w-28 !px-2.5 tabular-nums"
              aria-label="Gigabytes to add"
            />
          </label>
          {quote ? (
            <p className="text-[13px] leading-5 text-[var(--settings-fg-muted)]">
              {quote.usd}
              <span className="text-[var(--settings-fg-subtle)]">
                {" "}
                at ${STORAGE_USD_PER_GB.toFixed(3)}/GB
              </span>
              <span> · charged {quote.inr}</span>
            </p>
          ) : null}
        </div>
        {note ? (
          <div className="border-t border-[var(--settings-hairline)]">
            <SettingsInlineNote tone={note.tone}>{note.text}</SettingsInlineNote>
          </div>
        ) : null}
      </SettingsSection>

      {storage && (storage.purchases?.length ?? 0) > 0 ? (
        <SettingsSection title="Purchases" description="Storage add-ons on this account.">
          <ul>
            {storage.purchases.map((purchase) => (
              <li
                key={purchase.id}
                className="flex items-center justify-between gap-3 border-b border-[var(--settings-hairline)] px-3.5 py-3 text-[13px] last:border-b-0 sm:px-4"
              >
                <span className="min-w-0">
                  <span className="font-medium text-[var(--settings-fg)]">
                    {purchase.gigabytes} GB
                  </span>
                  <span className="text-[var(--settings-fg-muted)]">
                    {" "}
                    · {formatWhen(purchase.paidAt || purchase.createdAt)}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="tabular-nums text-[var(--settings-fg-muted)]">
                    {formatInrFromPaise(purchase.amountPaise)}
                  </span>
                  <SettingsStatusBadge
                    tone={purchase.status === "paid" ? "success" : "info"}
                  >
                    {purchase.status === "paid" ? "Paid" : "Pending"}
                  </SettingsStatusBadge>
                </span>
              </li>
            ))}
          </ul>
        </SettingsSection>
      ) : null}
    </SettingsPage>
  );
}
