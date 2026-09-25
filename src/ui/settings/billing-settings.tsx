"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Copy, MoreHorizontal, Sparkles } from "lucide-react";
import {
  billingInvoicePdfUrl,
  deletePaymentMethod,
  getBillingAddress,
  getBillingInvoice,
  getBillingSubscription,
  listInvoices,
  listPaymentMethods,
  setDefaultPaymentMethod,
  upsertBillingAddress,
  type BillingAddressDto,
  type PaymentMethodDto,
} from "@/lib/api/billing";
import { listPurchasedGifts, type PurchasedGiftRow } from "@/lib/api/gifts";
import { useAuth } from "@/hooks/use-auth";
import {
  CARD_BRAND_ICONS,
  CHECKOUT_UPI_ICON_URL,
  type CardBrandId,
} from "@/lib/checkout-payment-icons";
import { CheckoutPaymentIcon } from "@/components/checkout-payment-icon";
import { InvoiceView, type InvoiceData } from "@/components/invoice-view";
import { FullscreenPortal } from "@/components/fullscreen-portal";
import {
  CheckoutBillingAddress,
  isCheckoutAddressComplete,
  type CheckoutAddressState,
} from "@/components/checkout-billing-address";
import { AddPaymentMethodDialog } from "@/components/settings/add-payment-method-dialog";
import { ManagePlanDialog } from "@/components/settings/manage-plan-dialog";
import { AppContentLoader } from "@/components/app-content-loader";
import { writeCachedBillingPlan } from "@/lib/billing-plan-cache";
import {
  SettingsButton,
  SettingsFieldBlock,
  SettingsPage,
  SettingsPanelTitle,
  SettingsProgressBar,
  SettingsSection,
  SettingsStatusBadge,
} from "@/components/settings/settings-ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  PERSONAL_PLANS,
  resolvePlanFeatures,
  type PlanCard,
} from "@/lib/plans-catalog";
import * as settingsApi from "@/lib/api/settings-extended";

interface BillingSettingsProps {
  onUpgradeClick?: () => void;
  userDisplayName?: string | null;
  userEmail?: string | null;
}

type InvoiceRow = {
  id: string;
  amount_paise: number;
  status: string;
  created_at: string;
};

const FALLBACK_QUOTA = 512 * 1024 * 1024;

function formatStorage(bytes: number) {
  if (bytes <= 0) return "0 B";
  if (bytes >= 1024 ** 3) {
    const gb = bytes / 1024 ** 3;
    return gb % 1 === 0 ? `${gb} GB` : `${gb.toFixed(1)} GB`;
  }
  if (bytes >= 1024 ** 2) return `${Math.round(bytes / 1024 ** 2)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function resolvePlanCard(planId: string | null | undefined): PlanCard | null {
  if (!planId) return null;
  const normalized = planId.replace(/_/g, "").toLowerCase();
  if (normalized === "max5x" || normalized === "max20x") {
    return PERSONAL_PLANS.find((p) => p.id === "max") ?? null;
  }
  return (
    PERSONAL_PLANS.find((p) => p.id === planId) ||
    PERSONAL_PLANS.find((p) => p.id === normalized) ||
    null
  );
}

function formatPlanTitle(plan: PlanCard | null, planId: string | null | undefined) {
  if (!plan) return planId ? "Clauxen" : "No plan";
  if (plan.name.toLowerCase().includes("plan")) return `Clauxen ${plan.name}`;
  return `Clauxen ${plan.name}`;
}

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

function invoiceStatusTone(status: string): "success" | "info" {
  const s = status.toLowerCase();
  if (s === "paid" || s === "completed" || s === "captured") return "success";
  return "info";
}

function networkIcon(network: string): CardBrandId | "upi" {
  const n = network.toLowerCase();
  if (n === "upi") return "upi";
  if (n in CARD_BRAND_ICONS) return n as CardBrandId;
  return "visa";
}

function emptyAddressForm(name = ""): CheckoutAddressState {
  return {
    fullName: name,
    countryCode: "IN",
    addressLine1: "",
    addressLine2: "",
    city: "",
    pin: "",
    state: "",
    isComplete: false,
  };
}

export function BillingSettings({
  onUpgradeClick,
  userDisplayName,
  userEmail,
  focus = "full",
}: BillingSettingsProps & { focus?: "full" | "storage" | "analytics" }) {
  const auth = useAuth();
  const [loading, setLoading] = useState(true);
  const [planId, setPlanId] = useState<string | null>(null);
  const [cancelAtEnd, setCancelAtEnd] = useState(false);
  const [periodEnd, setPeriodEnd] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [purchasedGifts, setPurchasedGifts] = useState<PurchasedGiftRow[]>([]);
  const [copiedGiftId, setCopiedGiftId] = useState<string | null>(null);
  const [address, setAddress] = useState<BillingAddressDto | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodDto[]>([]);
  const [editingAddress, setEditingAddress] = useState(false);
  const [addressForm, setAddressForm] = useState<CheckoutAddressState>(
    emptyAddressForm(userDisplayName || ""),
  );
  const [savingAddress, setSavingAddress] = useState(false);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [invoiceView, setInvoiceView] = useState<InvoiceData | null>(null);
  const [addMethodOpen, setAddMethodOpen] = useState(false);
  const [managePlanOpen, setManagePlanOpen] = useState(false);
  const [usedBytes, setUsedBytes] = useState(0);
  const [quotaBytes, setQuotaBytes] = useState(FALLBACK_QUOTA);

  const planCard = useMemo(() => resolvePlanCard(planId), [planId]);
  const planTitle = formatPlanTitle(planCard, planId);
  const planSubtitle = planCard?.subtitle || "Pro or Max";
  const planFeatures = useMemo(
    () => (planCard ? resolvePlanFeatures(planCard) : []),
    [planCard],
  );

  const billingName =
    address?.fullName ||
    userDisplayName?.trim() ||
    userEmail?.split("@")[0] ||
    "—";

  const reload = useCallback(async () => {
    if (!auth.isAuthenticated) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [overview, inv, addr, methods, gifts] = await Promise.all([
        getBillingSubscription(),
        listInvoices(),
        getBillingAddress(),
        listPaymentMethods(),
        listPurchasedGifts().catch(() => ({ gifts: [] as PurchasedGiftRow[] })),
      ]);
      const sub = overview.subscription;
      const nextPlanId = sub?.plan_id ?? "free";
      const match = overview.plans?.find((p) => p.id === nextPlanId);
      writeCachedBillingPlan(nextPlanId, match?.display_name || nextPlanId);
      setPlanId(sub?.plan_id ?? null);
      setCancelAtEnd(!!sub?.cancel_at_period_end);
      setPeriodEnd(sub?.current_period_end ?? null);
      setInvoices(
        (inv.invoices as InvoiceRow[])?.filter((row) => row?.id) ?? [],
      );
      setPurchasedGifts(gifts.gifts ?? []);
      setAddress(addr.address);
      setPaymentMethods(methods.paymentMethods ?? []);
      void settingsApi
        .getStorageSummary()
        .then(({ storage }) => {
          setUsedBytes(storage.usedBytes);
          setQuotaBytes(storage.quotaBytes || FALLBACK_QUOTA);
        })
        .catch(() => undefined);
    } catch {
      // keep defaults
    } finally {
      setLoading(false);
    }
  }, [auth.isAuthenticated]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const onBillingUpdated = () => {
      void reload();
    };
    window.addEventListener("clauxen:billing-updated", onBillingUpdated);
    return () => {
      window.removeEventListener("clauxen:billing-updated", onBillingUpdated);
    };
  }, [reload]);

  const showUpgrade = cancelAtEnd || !planCard;

  const openAddressEditor = () => {
    if (address) {
      const next: CheckoutAddressState = {
        fullName: address.fullName,
        countryCode: address.countryCode || "IN",
        addressLine1: address.addressLine1,
        addressLine2: address.addressLine2 || "",
        city: address.city,
        pin: address.postalCode,
        state: address.state,
        isComplete: false,
      };
      next.isComplete = isCheckoutAddressComplete(next);
      setAddressForm(next);
    } else {
      setAddressForm(emptyAddressForm(userDisplayName || ""));
    }
    setAddressError(null);
    setEditingAddress(true);
  };

  const saveAddress = async () => {
    if (!isCheckoutAddressComplete(addressForm)) {
      setAddressError("Complete all required address fields.");
      return;
    }
    setSavingAddress(true);
    setAddressError(null);
    try {
      const res = await upsertBillingAddress({
        fullName: addressForm.fullName,
        countryCode: addressForm.countryCode || "IN",
        addressLine1: addressForm.addressLine1,
        addressLine2: addressForm.addressLine2,
        city: addressForm.city,
        state: addressForm.state,
        postalCode: addressForm.pin,
        notify: true,
      });
      setAddress(res.address);
      setEditingAddress(false);
    } catch (err) {
      setAddressError(
        err instanceof Error ? err.message : "Could not save billing address.",
      );
    } finally {
      setSavingAddress(false);
    }
  };

  const viewInvoice = async (paymentId: string) => {
    try {
      const res = await getBillingInvoice(paymentId);
      setInvoiceView({
        ...res.invoice,
        paymentId,
        pdfAvailable: Boolean(res.pdfKey),
      });
    } catch {
      window.open(billingInvoicePdfUrl(paymentId), "_blank", "noopener");
    }
  };

  if (loading) {
    return <AppContentLoader label="Loading billing" />;
  }

  if (focus === "storage") {
    return (
      <SettingsPage>
        <SettingsSection
          title="Storage"
          description="Files and images kept with your account."
        >
          <div className="px-5 py-5">
            <SettingsProgressBar
              value={usedBytes}
              max={quotaBytes}
              label={`${formatStorage(usedBytes)} of ${formatStorage(quotaBytes)} used`}
            />
          </div>
        </SettingsSection>
      </SettingsPage>
    );
  }

  if (focus === "analytics") {
    return (
      <SettingsPage>
        <SettingsSection
          title="Overview"
          description="A snapshot of how this account is using Clauxen."
        >
          <SettingsRow label="Plan" description={planTitle}>
            <span className="text-[14px] text-[var(--settings-fg-muted)]">
              {planSubtitle}
            </span>
          </SettingsRow>
          <SettingsRow
            label="Storage used"
            description={`${formatStorage(usedBytes)} of ${formatStorage(quotaBytes)}`}
          >
            <span className="text-[14px] text-[var(--settings-fg-muted)]">
              {quotaBytes > 0
                ? `${Math.min(100, Math.round((usedBytes / quotaBytes) * 100))}%`
                : "—"}
            </span>
          </SettingsRow>
          <SettingsRow label="Invoices" description="Receipts on this account." borderless>
            <span className="text-[14px] text-[var(--settings-fg-muted)]">
              {invoices.length}
            </span>
          </SettingsRow>
        </SettingsSection>
      </SettingsPage>
    );
  }

  return (
    <SettingsPage>
      <SettingsPanelTitle>Billing</SettingsPanelTitle>

      <SettingsSection
        title="Plan"
        action={
          <SettingsButton
            onClick={() => {
              if (showUpgrade) {
                onUpgradeClick?.();
                return;
              }
              setManagePlanOpen(true);
            }}
            variant="primary"
            size="sm"
          >
            {showUpgrade ? "Upgrade" : "Manage"}
          </SettingsButton>
        }
      >
        <div className="flex items-start gap-3 px-4 py-4 sm:px-5">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[var(--settings-icon-bg)]">
            <Sparkles
              className="h-4 w-4 text-[var(--settings-fg-muted)]"
              aria-hidden
            />
          </span>
          <div className="min-w-0">
            <h3 className="text-[16px] font-semibold leading-6">{planTitle}</h3>
            <p className="mt-0.5 text-[13px] leading-5 text-[var(--settings-fg-muted)]">
              {cancelAtEnd && periodEnd
                ? `Ends ${formatDate(periodEnd)}`
                : planSubtitle}
            </p>
          </div>
        </div>
        <ul className="space-y-2 border-t border-[var(--settings-hairline)] px-4 py-4 sm:px-5">
          {planFeatures.map((feature) => (
            <li
              key={feature}
              className="flex items-start gap-2.5 text-[13px] leading-5 text-[var(--settings-fg-muted)]"
            >
              <Check
                className="mt-0.5 h-4 w-4 shrink-0 text-[var(--settings-fg-subtle)]"
                strokeWidth={2}
                aria-hidden
              />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </SettingsSection>

      <SettingsSection title="Usage" description="Files and images stored.">
        <div className="px-4 py-4 sm:px-5">
          <SettingsProgressBar
            value={usedBytes}
            max={quotaBytes}
            label={`${formatStorage(usedBytes)} of ${formatStorage(quotaBytes)} used`}
          />
        </div>
      </SettingsSection>

      <SettingsSection title="Invoices" description="Receipts for charges.">
        {invoices.length === 0 ? (
          <p className="px-4 py-6 text-center text-[13px] text-[var(--settings-fg-subtle)] sm:px-5">
            No invoices yet.
          </p>
        ) : (
          <ul>
            {invoices.map((inv) => (
              <li
                key={inv.id}
                className="flex items-center justify-between gap-3 border-b border-[var(--settings-hairline)] px-4 py-3 text-[13px] last:border-b-0 sm:px-5"
              >
                <span className="min-w-0 truncate">
                  {formatDate(inv.created_at) ?? inv.created_at}
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="font-variant-numeric tabular-nums text-[var(--settings-fg-muted)]">
                    ₹{(inv.amount_paise / 100).toFixed(2)}
                  </span>
                  <SettingsStatusBadge tone={invoiceStatusTone(inv.status)}>
                    {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                  </SettingsStatusBadge>
                  <button
                    type="button"
                    onClick={() => void viewInvoice(inv.id)}
                    className="font-medium text-[var(--settings-fg-muted)] hover:text-[var(--settings-fg)]"
                  >
                    View
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </SettingsSection>

      <SettingsSection
        title="Payment methods"
        description="Cards and UPI for faster checkout."
        action={
          <SettingsButton size="sm" onClick={() => setAddMethodOpen(true)}>
            Add
          </SettingsButton>
        }
      >
        {paymentMethods.length === 0 ? (
          <p className="px-4 py-6 text-center text-[13px] text-[var(--settings-fg-muted)] sm:px-5">
            No payment methods yet.
          </p>
        ) : (
          <ul>
            {paymentMethods.map((method) => {
              const iconKey = networkIcon(method.network);
              const iconSrc =
                iconKey === "upi"
                  ? CHECKOUT_UPI_ICON_URL
                  : CARD_BRAND_ICONS[iconKey].src;
              const iconAlt =
                iconKey === "upi" ? "UPI" : CARD_BRAND_ICONS[iconKey].label;
              return (
                <li
                  key={method.id}
                  className="flex items-center justify-between gap-4 border-b border-[var(--settings-hairline)] px-4 py-3 last:border-b-0 sm:px-5"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <CheckoutPaymentIcon
                      src={iconSrc}
                      alt={iconAlt}
                      className="h-7 w-10 rounded-[5px] border border-[var(--settings-input-border)] bg-[var(--settings-elevated-bg)] p-0.5"
                    />
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-[var(--settings-fg)]">
                        {method.brand || iconAlt}
                      </p>
                      <p className="truncate text-[13px] text-[var(--settings-fg-subtle)]">
                        {method.maskedNumber}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {method.isDefault && (
                      <SettingsStatusBadge tone="info">
                        Default
                      </SettingsStatusBadge>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          aria-label="Payment method options"
                          className="rounded-lg p-1.5 text-[var(--settings-fg-subtle)] transition-colors hover:bg-[var(--settings-nav-hover-bg)] hover:text-[var(--settings-fg)]"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="settings-theme min-w-[200px] border-[var(--settings-modal-border)] bg-[var(--settings-elevated-bg)] text-[var(--settings-fg)]"
                      >
                        {!method.isDefault && (
                          <DropdownMenuItem
                            onClick={() =>
                              void setDefaultPaymentMethod(method.id).then(() =>
                                reload(),
                              )
                            }
                          >
                            Make default
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={openAddressEditor}>
                          Update billing address
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-600 focus:text-red-600"
                          onClick={() =>
                            void deletePaymentMethod(method.id).then(() =>
                              reload(),
                            )
                          }
                        >
                          Remove
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </SettingsSection>

      <SettingsSection
        title="Billing details"
        description="Name and address on invoices."
        action={
          <SettingsButton size="sm" onClick={openAddressEditor}>
            Edit
          </SettingsButton>
        }
      >
        <div className="px-4 py-2 sm:px-5">
          <SettingsFieldBlock label="Name" value={billingName} />
          <SettingsFieldBlock
            label="Address"
            value={address?.summary || "Not set."}
          />
        </div>
      </SettingsSection>

      {purchasedGifts.length > 0 ? (
        <SettingsSection title="Gifts" description="Purchased gift subscriptions.">
          <ul>
            {purchasedGifts.map((gift) => {
              const monthsLabel =
                gift.months === 12
                  ? "1 year"
                  : gift.months === 1
                    ? "1 month"
                    : `${gift.months} months`;
              const statusLabel =
                gift.status === "purchased"
                  ? "Ready"
                  : gift.status === "redeemed"
                    ? "Claimed"
                    : gift.status.charAt(0).toUpperCase() +
                      gift.status.slice(1);
              return (
                <li
                  key={gift.id}
                  className="border-b border-[var(--settings-hairline)] px-4 py-3 last:border-b-0 sm:px-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-[var(--settings-fg)]">
                        {monthsLabel} of Clauxen {gift.plan_name}
                      </p>
                      <p className="mt-0.5 text-[12px] text-[var(--settings-fg-muted)]">
                        {formatDate(gift.purchased_at) ?? "Purchased"}
                        {" · "}₹{(gift.amount_paise / 100).toFixed(2)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <SettingsStatusBadge
                        tone={
                          gift.status === "redeemed" ? "success" : "info"
                        }
                      >
                        {statusLabel}
                      </SettingsStatusBadge>
                      {gift.claim_url && gift.status === "purchased" ? (
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(
                                gift.claim_url!,
                              );
                              setCopiedGiftId(gift.id);
                              window.setTimeout(
                                () => setCopiedGiftId(null),
                                2000,
                              );
                            } catch {
                              /* ignore */
                            }
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--settings-input-border)] px-2.5 py-1.5 text-[12px] font-medium text-[var(--settings-fg-muted)] transition-colors hover:bg-[var(--settings-nav-hover-bg)]"
                        >
                          {copiedGiftId === gift.id ? (
                            <>
                              <Check className="h-3.5 w-3.5" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="h-3.5 w-3.5" />
                              Copy link
                            </>
                          )}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </SettingsSection>
      ) : null}

      <AddPaymentMethodDialog
        open={addMethodOpen}
        onClose={() => setAddMethodOpen(false)}
        onSaved={() => void reload()}
      />

      {editingAddress && (
        <FullscreenPortal>
          <div
            className="settings-theme fixed inset-0 z-[210] flex items-end justify-center bg-black/40 p-4 backdrop-blur-[2px] sm:items-center"
            role="dialog"
            aria-modal="true"
            aria-label="Edit billing address"
            onClick={(e) => {
              if (e.target === e.currentTarget) setEditingAddress(false);
            }}
          >
            <div className="w-full max-w-[520px] rounded-[18px] border border-[var(--settings-modal-border)] bg-[var(--settings-elevated-bg)] p-6 text-[var(--settings-fg)] shadow-[var(--settings-modal-shadow)]">
              <h3 className="mb-4 text-[16px] font-semibold text-[var(--settings-fg)]">
                Billing address
              </h3>
              <CheckoutBillingAddress
                value={addressForm}
                onChange={setAddressForm}
              />
              {addressError && (
                <p className="mt-3 text-[13px] text-[var(--settings-danger)]">
                  {addressError}
                </p>
              )}
              <div className="mt-5 flex justify-end gap-2">
                <SettingsButton onClick={() => setEditingAddress(false)}>
                  Cancel
                </SettingsButton>
                <SettingsButton
                  variant="primary"
                  disabled={savingAddress}
                  onClick={() => void saveAddress()}
                >
                  {savingAddress ? "Saving…" : "Save"}
                </SettingsButton>
              </div>
            </div>
          </div>
        </FullscreenPortal>
      )}

      {invoiceView && (
        <FullscreenPortal>
          <div
            className="fixed inset-0 z-[210] overflow-y-auto overscroll-contain bg-[var(--app-shell-bg)]"
            data-scroll-region=""
          >
            <InvoiceView
              data={invoiceView}
              onClose={() => setInvoiceView(null)}
              onDownload={() => {
                if (invoiceView.paymentId) {
                  window.open(
                    billingInvoicePdfUrl(invoiceView.paymentId),
                    "_blank",
                    "noopener",
                  );
                }
              }}
            />
          </div>
        </FullscreenPortal>
      )}

      <ManagePlanDialog
        open={managePlanOpen}
        planName={planTitle}
        periodEnd={periodEnd}
        cancelAtPeriodEnd={cancelAtEnd}
        onClose={() => setManagePlanOpen(false)}
        onUpdated={(next) => {
          setCancelAtEnd(next.cancelAtPeriodEnd);
          setPeriodEnd(next.periodEnd);
          window.dispatchEvent(new CustomEvent("clauxen:billing-updated"));
        }}
        onUpgradeClick={onUpgradeClick}
      />
    </SettingsPage>
  );
}
