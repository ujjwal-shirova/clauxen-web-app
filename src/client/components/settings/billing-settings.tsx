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
import { SettingsBillingSkeleton } from "@/components/settings/settings-page-skeleton";
import { writeCachedBillingPlan } from "@/lib/billing-plan-cache";
import {
  SettingsFieldBlock,
  SettingsPanelTitle,
  SettingsPillButton,
  SettingsSectionHeading,
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

function resolvePlanCard(planId: string | null | undefined): PlanCard {
  if (!planId) return PERSONAL_PLANS.find((p) => p.id === "free")!;
  const normalized = planId.replace(/_/g, "").toLowerCase();
  const match =
    PERSONAL_PLANS.find((p) => p.id === planId) ||
    PERSONAL_PLANS.find((p) => p.id === normalized) ||
    PERSONAL_PLANS.find((p) => planId.startsWith(p.id));
  return match || PERSONAL_PLANS.find((p) => p.id === "free")!;
}

function formatPlanTitle(plan: PlanCard, planId: string | null | undefined) {
  if (!planId || plan.id === "free") return "Clauxen Free";
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
}: BillingSettingsProps) {
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

  const planCard = useMemo(() => resolvePlanCard(planId), [planId]);
  const planTitle = formatPlanTitle(planCard, planId);
  const planSubtitle = planCard.subtitle || "See what AI can do";
  const planFeatures = useMemo(() => resolvePlanFeatures(planCard), [planCard]);

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

  const showUpgrade = cancelAtEnd || !planId || planCard.id === "free";

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
    return <SettingsBillingSkeleton />;
  }

  return (
    <div className="flex animate-in fade-in flex-col gap-8 duration-300 text-[var(--settings-fg)]">
      <SettingsPanelTitle>Billing</SettingsPanelTitle>

      <section className="border-b border-[var(--settings-hairline)] pb-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[var(--settings-icon-bg)]">
              <Sparkles
                className="h-4 w-4 text-[var(--settings-fg-muted)]"
                aria-hidden
              />
            </div>
            <div className="min-w-0">
              <h3 className="text-[18px] font-medium leading-7">{planTitle}</h3>
              <p className="mt-1 text-[14px] leading-5 text-[var(--settings-fg-muted)]">
                {cancelAtEnd && periodEnd
                  ? `Your plan will be canceled on ${formatDate(periodEnd)}`
                  : planSubtitle}
              </p>
            </div>
          </div>
          <SettingsPillButton
            onClick={() => {
              if (showUpgrade) {
                onUpgradeClick?.();
                return;
              }
              setManagePlanOpen(true);
            }}
            variant="primary"
            className="min-w-[140px]"
          >
            {showUpgrade ? "Upgrade plan" : "Manage plan"}
          </SettingsPillButton>
        </div>

        <ul className="mt-5 space-y-2.5 border-t border-[var(--settings-hairline)] pt-5">
          {planFeatures.map((feature) => (
            <li
              key={feature}
              className="flex items-start gap-2.5 text-[14px] leading-5 text-[var(--settings-fg-muted)]"
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
      </section>

      <section className="border-b border-[var(--settings-hairline)] pb-7">
        <SettingsSectionHeading>Billing history</SettingsSectionHeading>
        {invoices.length === 0 ? (
          <p className="py-4 text-[14px] text-[var(--settings-fg-subtle)]">
            We have not sent you an invoice yet.
          </p>
        ) : (
          <ul className="mt-2">
            {invoices.map((inv) => (
              <li
                key={inv.id}
                className="grid grid-cols-1 gap-x-4 gap-y-2 border-b border-[var(--settings-hairline)] py-3 text-[14px] last:border-b-0 sm:grid-cols-[minmax(7rem,1fr)_5rem_5rem_auto] sm:items-center sm:py-2"
              >
                <span>{formatDate(inv.created_at) ?? inv.created_at}</span>
                <div className="flex items-center justify-between gap-3 sm:contents">
                  <span className="font-variant-numeric tabular-nums text-[var(--settings-fg-subtle)] sm:text-center">
                    ₹{(inv.amount_paise / 100).toFixed(2)}
                  </span>
                  <span className="sm:flex sm:justify-center">
                    <SettingsStatusBadge tone={invoiceStatusTone(inv.status)}>
                      {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                    </SettingsStatusBadge>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => void viewInvoice(inv.id)}
                  className="label-hover-bold justify-self-start text-[14px] font-medium text-[var(--settings-fg-muted)] hover:text-[var(--settings-fg)] sm:justify-self-end"
                >
                  View
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="border-b border-[var(--settings-hairline)] pb-7">
        <SettingsSectionHeading>Gifts you purchased</SettingsSectionHeading>
        {purchasedGifts.length === 0 ? (
          <p className="py-4 text-[14px] text-[var(--settings-fg-subtle)]">
            You have not purchased any gifts yet.
          </p>
        ) : (
          <ul className="mt-2">
            {purchasedGifts.map((gift) => {
              const monthsLabel =
                gift.months === 12
                  ? "1 year"
                  : gift.months === 1
                    ? "1 month"
                    : `${gift.months} months`;
              const statusLabel =
                gift.status === "purchased"
                  ? "Ready to claim"
                  : gift.status === "redeemed"
                    ? "Claimed"
                    : gift.status.charAt(0).toUpperCase() +
                      gift.status.slice(1);
              return (
                <li
                  key={gift.id}
                  className="border-b border-[var(--settings-hairline)] py-3 last:border-b-0"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[14px] font-medium text-[var(--settings-fg)]">
                        {monthsLabel} of Clauxen {gift.plan_name}
                      </p>
                      <p className="mt-0.5 text-[13px] text-[var(--settings-fg-muted)]">
                        {formatDate(gift.purchased_at) ?? "Purchased"}
                        {" · "}
                        {gift.delivery_method === "email"
                          ? gift.recipient_email
                            ? `Emailed to ${gift.recipient_email}`
                            : "Sent by email"
                          : "Shareable link"}
                        {" · "}₹{(gift.amount_paise / 100).toFixed(2)}
                      </p>
                      <p className="mt-0.5 text-[12px] text-[var(--settings-fg-subtle)]">
                        Code {gift.code_prefix}…{gift.code_last4}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <SettingsStatusBadge
                        tone={
                          gift.status === "purchased"
                            ? "info"
                            : gift.status === "redeemed"
                              ? "success"
                              : "info"
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
        )}
      </section>

      <section className="border-b border-[var(--settings-hairline)] pb-7">
        <SettingsSectionHeading
          action={
            <SettingsPillButton onClick={openAddressEditor}>
              Edit
            </SettingsPillButton>
          }
        >
          Billing information
        </SettingsSectionHeading>
        <div className="mt-2">
          <SettingsFieldBlock label="Name" value={billingName} />
          <SettingsFieldBlock
            label="Address"
            value={
              address?.summary ||
              "Add a billing address to use on invoices and checkout."
            }
          />
        </div>
      </section>

      <section>
        <SettingsSectionHeading
          action={
            <SettingsPillButton onClick={() => setAddMethodOpen(true)}>
              Add payment method
            </SettingsPillButton>
          }
        >
          Payment methods
        </SettingsSectionHeading>

        {paymentMethods.length === 0 ? (
          <p className="mt-2 py-3 text-[14px] text-[var(--settings-fg-muted)]">
            No payment methods yet. Add a card or UPI to check out faster next
            time.
          </p>
        ) : (
          <ul className="mt-2">
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
                  className="flex items-center justify-between gap-4 border-b border-[var(--settings-hairline)] py-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <CheckoutPaymentIcon
                      src={iconSrc}
                      alt={iconAlt}
                      className="h-7 w-10 rounded-[5px] border border-[var(--settings-input-border)] bg-[var(--settings-elevated-bg)] p-0.5"
                    />
                    <div className="min-w-0">
                      <p className="text-[14px] text-[var(--settings-fg)]">
                        {method.brand || iconAlt}
                      </p>
                      <p className="truncate text-[14px] text-[var(--settings-fg-subtle)]">
                        {method.maskedNumber}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
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
                          className="rounded p-1 text-[var(--settings-fg-subtle)] transition-colors hover:bg-[var(--settings-nav-hover-bg)] hover:text-[var(--settings-fg)]"
                        >
                          <MoreHorizontal className="h-5 w-5" />
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
                          Remove payment method
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {!auth.isAuthenticated && (
          <p className="mt-3 text-[12px] text-[var(--settings-fg-subtle)]">
            Sign in to manage billing and payment methods.
          </p>
        )}
      </section>

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
                <p className="mt-3 text-[13px] text-red-600">{addressError}</p>
              )}
              <div className="mt-5 flex justify-end gap-2">
                <SettingsPillButton onClick={() => setEditingAddress(false)}>
                  Cancel
                </SettingsPillButton>
                <SettingsPillButton
                  variant="primary"
                  disabled={savingAddress}
                  onClick={() => void saveAddress()}
                >
                  {savingAddress ? "Saving…" : "Save"}
                </SettingsPillButton>
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
    </div>
  );
}
