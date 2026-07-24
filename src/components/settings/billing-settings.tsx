"use client";

import { useEffect, useMemo, useState } from "react";
import { CreditCard } from "lucide-react";
import {
  getBillingSubscription,
  listInvoices,
} from "@/lib/api/billing";
import { useAuth } from "@/hooks/use-auth";
import {
  SettingsFieldBlock,
  SettingsIconMenuButton,
  SettingsPanelTitle,
  SettingsPillButton,
  SettingsSectionHeading,
  SettingsStatusBadge,
} from "@/components/settings/settings-ui";

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
  if (s === "paid" || s === "completed") return "success";
  return "info";
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

  const billingName =
    userDisplayName?.trim() || userEmail?.split("@")[0] || "—";
  const billingAddress = "Add your billing address in account settings.";

  useEffect(() => {
    if (!auth.isAuthenticated) {
      setLoading(false);
      return;
    }

    void (async () => {
      setLoading(true);
      try {
        const overview = await getBillingSubscription();
        const sub = overview.subscription;
        const plans = overview.plans ?? [];

        if (sub?.plan_id) {
          setPlanName(formatPlanName(sub.plan_id, plans));
        } else {
          setPlanName("Clauxen Free");
        }

        setCancelAtEnd(!!sub?.cancel_at_period_end);
        setPeriodEnd(sub?.current_period_end ?? null);

        const balance = overview.balance;
        if (balance?.tokens_remaining != null) {
          setTokensRemaining(balance.tokens_remaining);
        }

        const inv = await listInvoices();
        setInvoices(
          (inv.invoices as InvoiceRow[])?.filter((row) => row?.id) ?? [],
        );
      } catch {
        // keep defaults
      } finally {
        setLoading(false);
      }
    })();
  }, [auth.isAuthenticated]);

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
          action={<SettingsPillButton>Edit</SettingsPillButton>}
        >
          Billing information
        </SettingsSectionHeading>
        <div className="mt-2">
          <SettingsFieldBlock label="Name" value={billingName} />
          <SettingsFieldBlock label="Address" value={billingAddress} />
        </div>
      </section>

      <section>
        <SettingsSectionHeading
          action={<SettingsPillButton>Add new</SettingsPillButton>}
        >
          Payment methods
        </SettingsSectionHeading>
        <ul className="mt-2">
          <li className="flex items-center justify-between gap-4 border-b border-zinc-100 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-5 w-6 items-center justify-center">
                <CreditCard className="h-5 w-5 text-zinc-900" aria-hidden />
              </div>
              <div>
                <p className="text-[14px] text-zinc-900">Card on file</p>
                <p className="text-[14px] text-zinc-400">•••• ••••</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <SettingsStatusBadge tone="info">Default</SettingsStatusBadge>
              <SettingsIconMenuButton aria-label="Payment method options" />
            </div>
          </li>
        </ul>
        {!auth.isAuthenticated && (
          <p className="mt-3 text-[12px] text-zinc-400">
            Sign in to manage billing and payment methods.
          </p>
        )}
      </section>
    </div>
  );
}
