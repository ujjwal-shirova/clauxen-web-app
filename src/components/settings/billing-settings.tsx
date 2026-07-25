"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { useAuth } from "@/hooks/use-auth";
import { CARD_BRAND_ICONS, type CardBrandId } from "@/lib/checkout-payment-icons";
import { CheckoutPaymentIcon } from "@/components/checkout-payment-icon";
import { InvoiceView, type InvoiceData } from "@/components/invoice-view";
import { FullscreenPortal } from "@/components/fullscreen-portal";
import {
  CheckoutBillingAddress,
  isCheckoutAddressComplete,
  type CheckoutAddressState,
} from "@/components/checkout-billing-address";
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
import { MoreHorizontal } from "lucide-react";

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

function formatPlanName(
  planId: string | null | undefined,
  plans: { id: string; display_name: string }[],
) {
  if (!planId) return "Clauxen Free";
  const match = plans.find((p) => p.id === planId);
  if (match) return match.display_name;
  return planId.charAt(0).toUpperCase() + planId.slice(1).replace(/_/g, " ");
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

function networkIcon(network: string): CardBrandId {
  const n = network.toLowerCase();
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
  const [planName, setPlanName] = useState("Clauxen Free");
  const [cancelAtEnd, setCancelAtEnd] = useState(false);
  const [periodEnd, setPeriodEnd] = useState<string | null>(null);
  const [tokensRemaining, setTokensRemaining] = useState<number | null>(null);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [address, setAddress] = useState<BillingAddressDto | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodDto[]>([]);
  const [editingAddress, setEditingAddress] = useState(false);
  const [addressForm, setAddressForm] = useState<CheckoutAddressState>(
    emptyAddressForm(userDisplayName || ""),
  );
  const [savingAddress, setSavingAddress] = useState(false);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [invoiceView, setInvoiceView] = useState<InvoiceData | null>(null);

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
      const [overview, inv, addr, methods] = await Promise.all([
        getBillingSubscription(),
        listInvoices(),
        getBillingAddress(),
        listPaymentMethods(),
      ]);
      const sub = overview.subscription;
      const plans = overview.plans ?? [];
      setPlanName(
        sub?.plan_id ? formatPlanName(sub.plan_id, plans) : "Clauxen Free",
      );
      setCancelAtEnd(!!sub?.cancel_at_period_end);
      setPeriodEnd(sub?.current_period_end ?? null);
      if (overview.balance?.tokens_remaining != null) {
        setTokensRemaining(overview.balance.tokens_remaining);
      }
      setInvoices(
        (inv.invoices as InvoiceRow[])?.filter((row) => row?.id) ?? [],
      );
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

  const planSubtitle = useMemo(() => {
    if (cancelAtEnd && periodEnd) {
      return `Your plan will be canceled on ${formatDate(periodEnd)}`;
    }
    if (periodEnd) {
      return `Renews on ${formatDate(periodEnd)}`;
    }
    if (tokensRemaining != null) {
      return `${tokensRemaining.toLocaleString()} tokens remaining on your current plan`;
    }
    return "Upgrade for higher limits and priority access.";
  }, [cancelAtEnd, periodEnd, tokensRemaining]);

  const showRenew = cancelAtEnd || planName.toLowerCase().includes("free");

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

  return (
    <div className="flex animate-in fade-in flex-col gap-8 duration-300 text-zinc-900">
      <SettingsPanelTitle>Billing</SettingsPanelTitle>

      <section className="border-b border-zinc-200 pb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-[18px] font-medium leading-7">{planName}</h3>
            <p className="mt-1 text-[14px] leading-4 text-zinc-400">
              {loading ? "Loading subscription…" : planSubtitle}
            </p>
          </div>
          {showRenew ? (
            <SettingsPillButton
              onClick={onUpgradeClick}
              className="min-w-[140px]"
            >
              {planName.toLowerCase().includes("free")
                ? "Upgrade plan"
                : "Renew plan"}
            </SettingsPillButton>
          ) : (
            <SettingsPillButton onClick={onUpgradeClick}>
              Manage plan
            </SettingsPillButton>
          )}
        </div>
      </section>

      <section className="border-b border-zinc-200 pb-6">
        <SettingsSectionHeading>Billing history</SettingsSectionHeading>
        {invoices.length === 0 ? (
          <p className="py-4 text-[14px] text-zinc-400">
            We have not sent you an invoice yet.
          </p>
        ) : (
          <ul className="mt-2">
            {invoices.map((inv) => (
              <li
                key={inv.id}
                className="grid grid-cols-1 gap-x-4 gap-y-2 border-b border-zinc-100 py-3 text-[14px] last:border-b-0 sm:grid-cols-[minmax(7rem,1fr)_5rem_5rem_auto] sm:items-center sm:py-2"
              >
                <span>{formatDate(inv.created_at) ?? inv.created_at}</span>
                <div className="flex items-center justify-between gap-3 sm:contents">
                  <span className="font-variant-numeric tabular-nums text-zinc-400 sm:text-center">
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
                  className="justify-self-start text-[14px] underline underline-offset-2 hover:text-zinc-600 sm:justify-self-end"
                >
                  View
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="border-b border-zinc-200 pb-6">
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
              "Add your billing address — it will be used on invoices."
            }
          />
        </div>
      </section>

      <section>
        <SettingsSectionHeading>Payment methods</SettingsSectionHeading>
        {paymentMethods.length === 0 ? (
          <p className="mt-2 py-3 text-[14px] text-zinc-400">
            No cards on file yet. Cards are saved securely after a successful
            checkout (first four digits only — never the full card number).
          </p>
        ) : (
          <ul className="mt-2">
            {paymentMethods.map((method) => {
              const icon = CARD_BRAND_ICONS[networkIcon(method.network)];
              return (
                <li
                  key={method.id}
                  className="flex items-center justify-between gap-4 border-b border-zinc-100 py-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <CheckoutPaymentIcon
                      src={icon.src}
                      alt={icon.label}
                      className="h-7 w-10 rounded-[5px] border border-zinc-200 bg-white p-0.5"
                    />
                    <div className="min-w-0">
                      <p className="text-[14px] text-zinc-900">
                        {method.brand || icon.label}
                      </p>
                      <p className="truncate text-[14px] text-zinc-400">
                        {method.maskedNumber}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {method.isDefault && (
                      <SettingsStatusBadge tone="info">Default</SettingsStatusBadge>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          aria-label="Payment method options"
                          className="rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
                        >
                          <MoreHorizontal className="h-5 w-5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-[200px]">
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
          <p className="mt-3 text-[12px] text-zinc-400">
            Sign in to manage billing and payment methods.
          </p>
        )}
      </section>

      {editingAddress && (
        <FullscreenPortal>
          <div
            className="fixed inset-0 z-[210] flex items-end justify-center bg-black/35 p-4 sm:items-center"
            role="dialog"
            aria-modal="true"
            aria-label="Edit billing address"
            onClick={(e) => {
              if (e.target === e.currentTarget) setEditingAddress(false);
            }}
          >
            <div className="w-full max-w-md rounded-[22px] border border-zinc-200 bg-white p-5 shadow-xl">
              <h3 className="mb-4 text-[16px] font-semibold text-zinc-900">
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
                <button
                  type="button"
                  disabled={savingAddress}
                  onClick={() => void saveAddress()}
                  className="inline-flex h-9 items-center justify-center rounded-full bg-zinc-900 px-4 text-[14px] font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
                >
                  {savingAddress ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </div>
        </FullscreenPortal>
      )}

      {invoiceView && (
        <FullscreenPortal>
          <div className="fixed inset-0 z-[210] overflow-y-auto bg-[var(--app-shell-bg)]">
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
    </div>
  );
}
