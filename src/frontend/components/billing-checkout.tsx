"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@/frontend/lib/utils";
import { Info, Minus, Plus } from "lucide-react";
import {
  createBillingOrder,
  createCheckoutSession,
  createUpiBillingPayment,
  pollUpiBillingPayment,
  verifyBillingPayment,
} from "@/frontend/lib/api/billing";
import { CheckoutErrorBanner } from "@/frontend/components/checkout-error-banner";
import { CheckoutForm } from "@/frontend/components/checkout-form";
import type { CheckoutCardFieldState } from "@/frontend/components/checkout-payment-panel";
import { CheckoutUpiQrModal } from "@/frontend/components/checkout-upi-qr-modal";
import { canUseApplePay } from "@/frontend/lib/apple-pay";
import { openRazorpayCheckout } from "@/frontend/lib/razorpay-checkout";
import { useCheckoutCurrency } from "@/frontend/hooks/use-checkout-currency";
import { useAuth } from "@/frontend/hooks/use-auth";
import type {
  CheckoutPaymentTab,
  SavedPaymentMethod,
} from "@/lib/checkout-payment-tab";
import {
  BUSINESS_WORKSPACE_SEAT_MONTHLY_INR,
  MAX_TIER_OPTIONS,
  SEAT_ASSIGNABLE_PLANS,
  YEARLY_DISCOUNT_PERCENT,
  computeBundleSeatSubtotalInr,
  computeSeatMixLineInr,
  computeSeatMixSubtotalInr,
  createDefaultSeatCounts,
  getCheckoutPlanDetails,
  getOrganizationPlan,
  getOrganizationSeatDisplayPrice,
  getTotalSeatCount,
  resolveApiPlanId,
  type BillingCycle,
  type MaxTier,
  type SeatAssignablePlanId,
  type SeatCounts,
} from "@/lib/plans-catalog";
import { computeCheckoutTaxInr, type CheckoutBillingDetails } from "@/lib/checkout-tax";
import { isValidIndianGstin, normalizeGstin } from "@/lib/gstin";

export type { MaxTier };

interface BillingCheckoutProps {
  onBack: () => void;
  onPaymentSuccess?: (details?: { razorpayPaymentId?: string; razorpayOrderId?: string }) => void;
  planId: string | null;
  initialBillingCycle?: BillingCycle;
  initialMaxTier?: MaxTier;
  /** If provided, use this session id instead of immediately creating a new one. */
  initialCheckoutSessionId?: string | null;
}

const SEAT_ASSIGNABLE_IDS = Object.keys(
  SEAT_ASSIGNABLE_PLANS,
) as SeatAssignablePlanId[];

function getRenewalDate(billingCycle: BillingCycle) {
  const today = new Date();
  const renewalDate = new Date(today);

  if (billingCycle === "monthly") {
    renewalDate.setMonth(renewalDate.getMonth() + 1);
  } else {
    renewalDate.setFullYear(renewalDate.getFullYear() + 1);
  }

  return renewalDate.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

const PAYMENT_FAILED_MESSAGE =
  "Payment was not completed. Please try again.";

function SeatStepper({
  count,
  canDecrement,
  canIncrement,
  onDecrement,
  onIncrement,
}: {
  count: number;
  canDecrement: boolean;
  canIncrement: boolean;
  onDecrement: () => void;
  onIncrement: () => void;
}) {
  return (
    <div className="flex h-8 items-center rounded-lg border border-black/10 bg-white">
      <button
        type="button"
        disabled={!canDecrement}
        onClick={onDecrement}
        aria-label="Decrease seats"
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-l-lg transition-colors",
          canDecrement
            ? "text-zinc-700 hover:bg-zinc-50"
            : "cursor-not-allowed text-zinc-300",
        )}
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <span
        className={cn(
          "min-w-[52px] px-1 text-center text-[12px] font-medium",
          count === 0 ? "text-zinc-400" : "text-zinc-900",
        )}
      >
        {count === 0 ? "None" : count}
      </span>
      <button
        type="button"
        disabled={!canIncrement}
        onClick={onIncrement}
        aria-label="Increase seats"
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-r-lg transition-colors",
          canIncrement
            ? "text-zinc-700 hover:bg-zinc-50"
            : "cursor-not-allowed text-zinc-300",
        )}
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function BillingCheckout({
  onBack,
  onPaymentSuccess,
  planId,
  initialBillingCycle = "monthly",
  initialMaxTier = "5x",
  initialCheckoutSessionId,
}: BillingCheckoutProps) {
  const auth = useAuth();
  const { currency, formatInr, isUsd } = useCheckoutCurrency();
  const [billingCycle, setBillingCycle] =
    useState<BillingCycle>(initialBillingCycle);
  const [maxTier, setMaxTier] = useState<MaxTier>(initialMaxTier);
  const [purchasingAsBusiness, setPurchasingAsBusiness] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [gstin, setGstin] = useState("");
  const [billToName, setBillToName] = useState("");
  const [gstinError, setGstinError] = useState<string | null>(null);
  const savedMethod: SavedPaymentMethod | null = null;
  const hasSavedPaymentMethod = savedMethod != null;
  const [paymentTab, setPaymentTab] = useState<CheckoutPaymentTab>("card");
  const [checkoutSessionId, setCheckoutSessionId] = useState<string | null>(
    initialCheckoutSessionId ?? null,
  );
  const [upiModalOpen, setUpiModalOpen] = useState(false);
  const [upiQrImageUrl, setUpiQrImageUrl] = useState<string | null>(null);
  const [upiPoll, setUpiPoll] = useState<{
    qrId: string;
    billingOrderId: string;
  } | null>(null);
  const [cardFieldsComplete, setCardFieldsComplete] = useState(false);
  const [applePayAvailable, setApplePayAvailable] = useState(false);

  // When a checkout session id is provided via prop (e.g. direct /checkout link),
  // skip the *first* auto-create so we reuse the incoming session.
  const skipInitialSessionCreate = React.useRef(!!initialCheckoutSessionId);

  useEffect(() => {
    setApplePayAvailable(canUseApplePay());
  }, []);

  useEffect(() => {
    if (!hasSavedPaymentMethod && paymentTab === "saved") {
      setPaymentTab("card");
    }
  }, [hasSavedPaymentMethod, paymentTab]);

  const handleCardFieldsChange = useCallback((state: CheckoutCardFieldState) => {
    setCardFieldsComplete(state.isComplete);
  }, []);

  const activePlanId = planId || "plus";
  const orgPlan = getOrganizationPlan(activePlanId);
  const details = getCheckoutPlanDetails(activePlanId, maxTier);
  const isMaxPlan = activePlanId === "max";
  const isTeamPlan = activePlanId === "team";
  const isBusinessWorkspace = activePlanId === "business-workspace";
  const isUsageCodePlan = activePlanId === "business-code";
  const isEnterprisePlan = activePlanId === "enterprise";
  const isVariableCheckoutPlan = isUsageCodePlan || isEnterprisePlan;
  const maxDetails = MAX_TIER_OPTIONS[maxTier];

  const [seatCounts, setSeatCounts] = useState<SeatCounts>(() =>
    createDefaultSeatCounts(orgPlan?.minSeats ?? 4),
  );
  const [bundleSeatCount, setBundleSeatCount] = useState(
    orgPlan?.minSeats ?? 4,
  );

  useEffect(() => {
    setBillingCycle(initialBillingCycle);
  }, [initialBillingCycle, activePlanId]);

  useEffect(() => {
    if (activePlanId === "max") {
      setMaxTier(initialMaxTier);
    }
  }, [activePlanId, initialMaxTier]);

  useEffect(() => {
    const plan = getOrganizationPlan(activePlanId);
    if (plan?.pricingModel === "per-seat") {
      setSeatCounts(createDefaultSeatCounts(plan.minSeats));
    }
    if (plan?.pricingModel === "bundle-seat") {
      setBundleSeatCount(plan.minSeats);
    }
  }, [activePlanId]);

  const billingDetails: CheckoutBillingDetails = useMemo(
    () => ({
      fullName:
        auth.user?.displayName?.trim() ||
        auth.user?.email?.split("@")[0]?.trim() ||
        "Customer",
      countryCode: "IN",
      addressLine: "India",
      gstin:
        purchasingAsBusiness && gstin.trim()
          ? normalizeGstin(gstin)
          : undefined,
      billToName:
        purchasingAsBusiness && billToName.trim()
          ? billToName.trim()
          : undefined,
    }),
    [auth.user?.displayName, auth.user?.email, gstin, purchasingAsBusiness, billToName],
  );

  const minimalBillingDetails = useMemo(
    () => ({
      purchasingAsBusiness,
      ...(purchasingAsBusiness && gstin.trim()
        ? { gstin: normalizeGstin(gstin) }
        : {}),
      ...(purchasingAsBusiness && billToName.trim()
        ? { billToName: billToName.trim() }
        : {}),
    }),
    [purchasingAsBusiness, gstin, billToName],
  );

  const totalSeats = getTotalSeatCount(seatCounts);
  const minSeats = orgPlan?.minSeats ?? 4;
  const maxSeats = orgPlan?.maxSeats ?? 150;
  const seatsValid =
    !isTeamPlan || (totalSeats >= minSeats && totalSeats <= maxSeats);
  const bundleSeatsValid =
    !isBusinessWorkspace ||
    (bundleSeatCount >= minSeats &&
      bundleSeatCount <= (orgPlan?.maxSeats ?? 500));

  const effectiveBillingCycle: BillingCycle =
    isMaxPlan || isVariableCheckoutPlan ? "monthly" : billingCycle;

  useEffect(() => {
    if (isUsd && paymentTab === "upi") {
      setPaymentTab("card");
    }
  }, [isUsd, paymentTab]);

  useEffect(() => {
    if (isVariableCheckoutPlan) return;

    if (skipInitialSessionCreate.current) {
      skipInitialSessionCreate.current = false;
      return;
    }

    // IMPORTANT SECURITY NOTE (Razorpay docs):
    // https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/
    // "Always verify the payment signature server-side" — we create the Checkout Session
    // (which mints a short-lived signed token) on the server, then the server later creates
    // the Razorpay Order with the *exact* computed amount. Client never dictates price.
    let cancelled = false;
    void (async () => {
      try {
        const session = await createCheckoutSession({
          planId: resolveApiPlanId(activePlanId, maxTier),
          planName: isMaxPlan ? maxDetails.checkoutName : details.name,
          billingCycle: isMaxPlan ? "monthly" : effectiveBillingCycle,
          currency,
          maxTier: isMaxPlan ? maxTier : undefined,
          ...(isTeamPlan ? { seatBreakdown: seatCounts } : {}),
          ...(isBusinessWorkspace
            ? { organizationSeatCount: bundleSeatCount }
            : {}),
        });
        if (cancelled) return;
        setCheckoutSessionId(session.sessionId);
        if (typeof window !== "undefined") {
          window.history.replaceState(null, "", session.checkoutPath);
        }
      } catch {
        if (!cancelled) {
          // Soft message — the preparing screen in UpgradeView already handles the main path.
          // For direct /checkout links or edge cases we give a gentle retryable state.
          setPayError("We had trouble creating your secure checkout session. Please try again in a moment.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    activePlanId,
    maxTier,
    effectiveBillingCycle,
    isMaxPlan,
    isTeamPlan,
    isBusinessWorkspace,
    isVariableCheckoutPlan,
    seatCounts,
    bundleSeatCount,
    details.name,
    maxDetails.checkoutName,
    currency,
  ]);

  useEffect(() => {
    if (!upiPoll || !upiModalOpen) return;

    const interval = window.setInterval(() => {
      void (async () => {
        try {
          const result = await pollUpiBillingPayment(upiPoll);
          if (result.status === "paid") {
            window.clearInterval(interval);
            setUpiModalOpen(false);
            setUpiPoll(null);
            setPaying(false);
            onPaymentSuccess?.();
          }
        } catch {
          window.clearInterval(interval);
          setUpiModalOpen(false);
          setUpiPoll(null);
          setPaying(false);
          setPayError(PAYMENT_FAILED_MESSAGE);
        }
      })();
    }, 3000);

    return () => window.clearInterval(interval);
  }, [upiPoll, upiModalOpen, onPaymentSuccess]);

  const subtotal = useMemo(() => {
    if (isMaxPlan) return maxDetails.monthlyPriceInr;
    if (isVariableCheckoutPlan) return 0;
    if (isTeamPlan && orgPlan) {
      return computeSeatMixSubtotalInr(
        seatCounts,
        effectiveBillingCycle,
        orgPlan.yearlySupported,
      );
    }
    if (isBusinessWorkspace && orgPlan?.bundleSeatMonthlyInr != null) {
      return computeBundleSeatSubtotalInr(
        bundleSeatCount,
        orgPlan.bundleSeatMonthlyInr,
        effectiveBillingCycle,
        orgPlan.yearlySupported,
      );
    }
    return effectiveBillingCycle === "monthly"
      ? details.monthly
      : details.yearly;
  }, [
    isMaxPlan,
    isVariableCheckoutPlan,
    isTeamPlan,
    isBusinessWorkspace,
    orgPlan,
    seatCounts,
    bundleSeatCount,
    effectiveBillingCycle,
    maxDetails.monthlyPriceInr,
    details.monthly,
    details.yearly,
  ]);

  const taxResult = useMemo(() => {
    if (isVariableCheckoutPlan || isUsd) {
      return {
        taxInr: 0,
        taxPaise: 0,
        taxLabel: null as string | null,
        showTaxRow: false,
        isGstExempt: false,
        taxNote: null as string | null,
      };
    }
    return computeCheckoutTaxInr(subtotal, billingDetails);
  }, [isVariableCheckoutPlan, isUsd, subtotal, billingDetails]);

  const tax = taxResult.taxInr;
  const total = subtotal + tax;
  const renewalDate = getRenewalDate(isMaxPlan ? "monthly" : effectiveBillingCycle);

  const billingFormValid =
    (!purchasingAsBusiness ||
      !gstin.trim() ||
      isValidIndianGstin(normalizeGstin(gstin))) &&
    Boolean(checkoutSessionId);

  const paymentFieldsValid =
    paymentTab === "upi" ||
    (paymentTab === "saved" && hasSavedPaymentMethod) ||
    (paymentTab === "card" && cardFieldsComplete);

  const cycleLabel = isMaxPlan
    ? "/month"
    : effectiveBillingCycle === "monthly"
      ? "/month"
      : "/year";

  const handleSeatChange = (
    seatId: SeatAssignablePlanId,
    delta: 1 | -1,
  ) => {
    setSeatCounts((prev) => {
      const next = { ...prev, [seatId]: Math.max(0, prev[seatId] + delta) };
      return next;
    });
  };

  const handleSubscribe = async (
    paymentTabOverride?: CheckoutPaymentTab,
    options?: { walletExpress?: boolean },
  ) => {
    const tab = paymentTabOverride ?? paymentTab;
    const fieldsValid =
      options?.walletExpress ||
      tab === "upi" ||
      (tab === "saved" && hasSavedPaymentMethod) ||
      (tab === "card" && cardFieldsComplete);

    if (
      !agreed ||
      isVariableCheckoutPlan ||
      paying ||
      !seatsValid ||
      !bundleSeatsValid ||
      !billingFormValid ||
      !fieldsValid ||
      !checkoutSessionId
    ) {
      return;
    }
    setPayError(null);
    setPaying(true);

    try {
      if (tab === "upi") {
        const checkout = await createUpiBillingPayment({
          checkoutSessionId,
          billingDetails: minimalBillingDetails,
          ...(isTeamPlan ? { seatBreakdown: seatCounts } : {}),
          ...(isBusinessWorkspace
            ? { organizationSeatCount: bundleSeatCount }
            : {}),
        });
        setUpiQrImageUrl(checkout.upi.imageUrl);
        setUpiPoll({
          qrId: checkout.upi.qrId,
          billingOrderId: checkout.order.id,
        });
        setUpiModalOpen(true);
        return;
      }

      const checkout = await createBillingOrder({
        planId: resolveApiPlanId(activePlanId, maxTier),
        planName: isMaxPlan ? maxDetails.checkoutName : details.name,
        billingCycle: isMaxPlan ? "monthly" : effectiveBillingCycle,
        billingDetails: minimalBillingDetails,
        checkoutSessionId,
        currency,
        maxTier: isMaxPlan ? maxTier : undefined,
        ...(isTeamPlan ? { seatBreakdown: seatCounts } : {}),
        ...(isBusinessWorkspace
          ? { organizationSeatCount: bundleSeatCount }
          : {}),
      });
      const keyId = checkout.razorpay.keyId;
      if (!keyId) throw new Error("Razorpay is not configured for checkout.");

      await openRazorpayCheckout({
        keyId,
        orderId: checkout.razorpay.orderId,
        amount: checkout.razorpay.amount,
        currency: checkout.razorpay.currency,
        name: "Clauxen",
        description: details.name,
        paymentMethod: "card",
        ...(options?.walletExpress ? { expressCheckout: "apple_pay" as const } : {}),
        prefill: {
          name: billingDetails.billToName ?? billingDetails.fullName,
          email: auth.user?.email ?? undefined,
        },
        onSuccess: async (payment) => {
          await verifyBillingPayment({
            razorpayOrderId: payment.razorpay_order_id,
            razorpayPaymentId: payment.razorpay_payment_id,
            razorpaySignature: payment.razorpay_signature,
          });
          // Pass rich context so parent can render a beautiful auto-generated invoice immediately.
          onPaymentSuccess?.({
            razorpayPaymentId: payment.razorpay_payment_id,
            razorpayOrderId: payment.razorpay_order_id,
          });
        },
        onDismiss: () => {
          setPayError(PAYMENT_FAILED_MESSAGE);
        },
      });
    } catch (error) {
      setPayError(
        error instanceof Error ? error.message : PAYMENT_FAILED_MESSAGE,
      );
    } finally {
      if (tab !== "upi") {
        setPaying(false);
      }
    }
  };

  const handleUpiModalClose = () => {
    setUpiModalOpen(false);
    setUpiPoll(null);
    setPaying(false);
    setPayError(PAYMENT_FAILED_MESSAGE);
  };

  const billingCycleToggle = !isMaxPlan && !isVariableCheckoutPlan && (
    <div className="grid grid-cols-2 gap-2 sm:gap-4">
      <button
        type="button"
        onClick={() => setBillingCycle("monthly")}
        className={cn(
          "flex flex-col items-start rounded-[8px] border px-4 py-4 text-left transition-all",
          effectiveBillingCycle === "monthly"
            ? "border-[#2C84DB] bg-[#D3E5F8]"
            : "border-zinc-200 bg-white hover:border-black/30",
        )}
      >
        <div className="mb-3 flex w-full items-center justify-between">
          <div
            className={cn(
              "flex h-[22px] w-[22px] items-center justify-center rounded-full border-2",
              effectiveBillingCycle === "monthly"
                ? "border-[#2C84DB]"
                : "border-black/15",
            )}
          >
            {effectiveBillingCycle === "monthly" && (
              <div className="h-2.5 w-2.5 rounded-full bg-[#2C84DB]" />
            )}
          </div>
        </div>
        <span className="max-w-[75%] text-left font-medium">Monthly</span>
        <span className="mt-1 text-left text-[14px] leading-5 text-zinc-800">
          {isTeamPlan || isBusinessWorkspace
            ? "Billed monthly per seat"
            : `${formatInr(details.monthly)}/month`}
        </span>
      </button>

      <button
        type="button"
        onClick={() => setBillingCycle("yearly")}
        disabled={orgPlan ? !orgPlan.yearlySupported : false}
        className={cn(
          "flex flex-col items-start rounded-[8px] border px-4 py-4 text-left transition-all",
          effectiveBillingCycle === "yearly"
            ? "border-[#2C84DB] bg-[#D3E5F8]"
            : "border-zinc-200 bg-white hover:border-black/30",
          orgPlan && !orgPlan.yearlySupported && "cursor-not-allowed opacity-50",
        )}
      >
        <div className="mb-3 flex w-full items-center justify-between">
          <div
            className={cn(
              "flex h-[22px] w-[22px] items-center justify-center rounded-full border-2",
              effectiveBillingCycle === "yearly"
                ? "border-[#2C84DB]"
                : "border-black/15",
            )}
          >
            {effectiveBillingCycle === "yearly" && (
              <div className="h-2.5 w-2.5 rounded-full bg-[#2C84DB]" />
            )}
          </div>
          {(orgPlan?.yearlySupported ?? details.yearly > 0) && (
            <div className="rounded-lg bg-[#1B67B2]/10 px-2 py-1 text-[12px] font-medium leading-4 text-[#1B67B2]">
              Save {YEARLY_DISCOUNT_PERCENT}%
            </div>
          )}
        </div>
        <span className="max-w-[75%] text-left font-medium">Yearly</span>
        <span className="mt-1 text-left text-[14px] leading-5 text-zinc-800">
          {isTeamPlan || isBusinessWorkspace
            ? `Save ${YEARLY_DISCOUNT_PERCENT}% billed annually`
            : `${formatInr(details.yearly)}/year`}
        </span>
      </button>
    </div>
  );

  const maxTierToggle = isMaxPlan && (
    <div className="grid grid-cols-2 gap-2 sm:gap-4">
      {(
        Object.entries(MAX_TIER_OPTIONS) as Array<
          [MaxTier, (typeof MAX_TIER_OPTIONS)[MaxTier]]
        >
      ).map(([tier, tierDetails]) => (
        <button
          key={tier}
          type="button"
          onClick={() => setMaxTier(tier)}
          className={cn(
            "flex flex-col items-start rounded-[8px] border px-4 py-4 text-left transition-all",
            maxTier === tier
              ? "border-[#2C84DB] bg-[#D3E5F8]"
              : "border-zinc-200 bg-white hover:border-black/30",
          )}
        >
          <div className="mb-3 flex w-full items-center justify-between">
            <div
              className={cn(
                "flex h-[22px] w-[22px] items-center justify-center rounded-full border-2",
                maxTier === tier ? "border-[#2C84DB]" : "border-black/15",
              )}
            >
              {maxTier === tier && (
                <div className="h-2.5 w-2.5 rounded-full bg-[#2C84DB]" />
              )}
            </div>
            {tierDetails.badge && (
              <div className="rounded-lg bg-[#1B67B2]/10 px-2 py-1 text-[12px] font-medium leading-4 text-[#1B67B2]">
                {tierDetails.badge}
              </div>
            )}
          </div>
          <span className="max-w-[75%] text-left font-medium">
            {tierDetails.usageLabel}
          </span>
          <span className="mt-1 text-left text-[14px] leading-5 text-zinc-800">
            {formatInr(tierDetails.monthlyPriceInr)}/month
          </span>
        </button>
      ))}
    </div>
  );

  const teamSeatConfigurator = isTeamPlan && orgPlan && (
    <div className="rounded-lg bg-black/[0.04] p-3">
      <p className="mb-1 text-[11px] font-medium leading-4 text-zinc-500">
        {orgPlan.userRangeLabel}
      </p>
      <p className="mb-3 text-[11px] font-medium leading-4 text-zinc-600">
        Min {minSeats} seats · configure each seat separately
      </p>
      <div className="flex flex-col">
        {SEAT_ASSIGNABLE_IDS.map((seatId, index) => {
          const seat = SEAT_ASSIGNABLE_PLANS[seatId];
          const count = seatCounts[seatId];
          const display = getOrganizationSeatDisplayPrice(
            seat.monthlyPriceInr,
            effectiveBillingCycle,
            orgPlan.yearlySupported,
          );
          const canDecrement = count > 0 && totalSeats > minSeats;
          const canIncrement = totalSeats < maxSeats;

          return (
            <div key={seatId}>
              {index > 0 && <div className="my-2.5 border-t border-black/10" />}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <span className="text-[12px] font-medium leading-4 text-zinc-900">
                    {seat.label}
                  </span>
                  <div className="mt-1 flex flex-wrap items-baseline gap-1">
                    {display.strikethrough != null && (
                      <span className="text-[11px] text-zinc-500 line-through">
                        ₹{display.strikethrough.toLocaleString("en-IN")}
                      </span>
                    )}
                    <span className="text-[13px] font-semibold leading-4 text-zinc-900">
                      ₹{display.amount.toLocaleString("en-IN")}
                      <span className="text-[11px] font-medium text-zinc-500">
                        /mo
                      </span>
                    </span>
                  </div>
                  <p className="mt-0.5 max-w-[200px] text-[10px] leading-[14px] text-zinc-500">
                    {seat.usageNote}
                  </p>
                </div>
                <SeatStepper
                  count={count}
                  canDecrement={canDecrement}
                  canIncrement={canIncrement}
                  onDecrement={() => handleSeatChange(seatId, -1)}
                  onIncrement={() => handleSeatChange(seatId, 1)}
                />
              </div>
            </div>
          );
        })}
      </div>
      {!seatsValid && (
        <p className="mt-3 text-[11px] text-red-600">
          Select at least {minSeats} seats across tiers (max {maxSeats}).
        </p>
      )}
    </div>
  );

  const businessSeatConfigurator = isBusinessWorkspace && orgPlan && (
    <div className="rounded-lg bg-black/[0.04] p-3">
      <p className="mb-1 text-[11px] font-medium leading-4 text-zinc-500">
        {orgPlan.userRangeLabel}
      </p>
      <p className="mb-3 text-[11px] font-medium leading-4 text-zinc-600">
        Min {minSeats} seats · per seat
      </p>
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="text-[12px] font-medium leading-4 text-zinc-900">
            Business seat
          </span>
          <div className="mt-1 flex flex-wrap items-baseline gap-1">
            {orgPlan.bundleSeatMonthlyStrikethroughInr != null && (
              <span className="text-[11px] text-zinc-500 line-through">
                ₹
                {orgPlan.bundleSeatMonthlyStrikethroughInr.toLocaleString(
                  "en-IN",
                )}
              </span>
            )}
            {(() => {
              const display = getOrganizationSeatDisplayPrice(
                orgPlan.bundleSeatMonthlyInr ?? BUSINESS_WORKSPACE_SEAT_MONTHLY_INR,
                effectiveBillingCycle,
                orgPlan.yearlySupported,
              );
              return (
                <span className="text-[13px] font-semibold leading-4 text-zinc-900">
                  ₹{display.amount.toLocaleString("en-IN")}
                  <span className="text-[11px] font-medium text-zinc-500">
                    /mo
                  </span>
                </span>
              );
            })()}
          </div>
          <p className="mt-0.5 max-w-[200px] text-[10px] leading-[14px] text-zinc-500">
            Clauxen & Collabry bundle for every seat
          </p>
        </div>
        <SeatStepper
          count={bundleSeatCount}
          canDecrement={bundleSeatCount > minSeats}
          canIncrement={bundleSeatCount < (orgPlan.maxSeats ?? 500)}
          onDecrement={() => setBundleSeatCount((n) => Math.max(minSeats, n - 1))}
          onIncrement={() =>
            setBundleSeatCount((n) =>
              Math.min(orgPlan.maxSeats ?? 500, n + 1),
            )
          }
        />
      </div>
    </div>
  );

  const variablePlanNotice = isVariableCheckoutPlan && (
    <div className="rounded-[8px] border border-zinc-200 bg-white px-4 py-4 text-[14px] leading-relaxed text-zinc-800">
      {isUsageCodePlan ? (
        <p>
          <strong>Usage pricing:</strong> Clauxen Code usage is metered and
          invoiced on actual use. There is no fixed seat charge at checkout; our
          team confirms rates when your workspace is activated.
        </p>
      ) : (
        <p>
          <strong>Enterprise:</strong> Pricing and contract terms are prepared
          for your organization. Submit your details below—no card charge until
          a quote is accepted.
        </p>
      )}
    </div>
  );

  const cycleDetailLabel = isMaxPlan
    ? maxDetails.label
    : isVariableCheckoutPlan
      ? "Details confirmed at activation"
      : isTeamPlan
        ? `${totalSeats} seats · ${effectiveBillingCycle === "monthly" ? "Monthly" : "Annually"}`
        : isBusinessWorkspace
          ? `${bundleSeatCount} seats · ${effectiveBillingCycle === "monthly" ? "Monthly" : "Annually"}`
          : effectiveBillingCycle === "monthly"
            ? "Monthly"
            : "Annually";

  const orderLineItems = useMemo(() => {
    if (isTeamPlan && orgPlan) {
      return SEAT_ASSIGNABLE_IDS.filter((id) => seatCounts[id] > 0).map(
        (id) => ({
          key: id,
          label: `${SEAT_ASSIGNABLE_PLANS[id].label} × ${seatCounts[id]}`,
          sublabel:
            effectiveBillingCycle === "yearly" && orgPlan.yearlySupported
              ? "Annually"
              : "Monthly",
          amount: computeSeatMixLineInr(
            id,
            seatCounts[id],
            effectiveBillingCycle,
            orgPlan.yearlySupported,
          ),
        }),
      );
    }
    if (isBusinessWorkspace && orgPlan?.bundleSeatMonthlyInr != null) {
      return [
        {
          key: "business-seat",
          label: `Business seat × ${bundleSeatCount}`,
          sublabel:
            effectiveBillingCycle === "yearly" && orgPlan.yearlySupported
              ? "Annually"
              : "Monthly",
          amount: computeBundleSeatSubtotalInr(
            bundleSeatCount,
            orgPlan.bundleSeatMonthlyInr,
            effectiveBillingCycle,
            orgPlan.yearlySupported,
          ),
        },
      ];
    }
    return [
      {
        key: "plan",
        label: details.name,
        sublabel: cycleDetailLabel,
        amount: subtotal,
      },
    ];
  }, [
    isTeamPlan,
    isBusinessWorkspace,
    orgPlan,
    seatCounts,
    bundleSeatCount,
    effectiveBillingCycle,
    details.name,
    cycleDetailLabel,
    subtotal,
  ]);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-zinc-50 font-sans text-zinc-800 animate-in fade-in duration-500">
      <header className="relative flex w-full shrink-0 items-center justify-center px-4 py-4 pt-[max(1rem,env(safe-area-inset-top))] sm:py-6">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 sm:left-6">
          <button
            type="button"
            onClick={onBack}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-800 transition-all hover:bg-zinc-100"
            aria-label="Back"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              fill="currentColor"
              viewBox="0 0 256 256"
            >
              <path d="M228,128a12,12,0,0,1-12,12H69l51.52,51.51a12,12,0,0,1-17,17l-72-72a12,12,0,0,1,0-17l72-72a12,12,0,0,1,17,17L69,116H216A12,12,0,0,1,228,128Z" />
            </svg>
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <main className="mx-auto flex w-full max-w-[1080px] flex-col items-start gap-6 px-4 pb-24 pt-1 sm:px-6 sm:pt-2 lg:flex-row lg:gap-8">
          {/* Left column — sticky plan summary */}
          <aside className="w-full shrink-0 self-start lg:sticky lg:top-6 lg:w-[420px]">
            <h1 className="mb-4 text-[21px] font-medium sm:mb-6 sm:text-[24px]">
              {details.name}
            </h1>

            <div className="flex flex-col gap-4">
              {maxTierToggle}
              {billingCycleToggle}
              {teamSeatConfigurator}
              {businessSeatConfigurator}
              {variablePlanNotice}

              <div className="flex flex-col gap-4 rounded-xl border border-black/10 bg-white p-5 text-[14px]">
                <div className="font-semibold">Order details</div>

                {orderLineItems.map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between"
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">{item.label}</span>
                      <span className="text-zinc-500">{item.sublabel}</span>
                    </div>
                    <span className="font-semibold">
                      {isVariableCheckoutPlan
                        ? isUsageCodePlan
                          ? "Usage pricing"
                          : "Custom quote"
                        : formatInr(item.amount)}
                    </span>
                  </div>
                ))}

                <div className="h-px w-full bg-black/10" />

                <div className="flex items-center justify-between font-medium">
                  <span>Subtotal</span>
                  <span>
                    {isVariableCheckoutPlan
                      ? isUsageCodePlan
                        ? "Usage pricing"
                        : "Custom quote"
                      : formatInr(subtotal)}
                  </span>
                </div>
                {taxResult.showTaxRow && (
                  <div className="flex items-center justify-between font-medium">
                    <span>{taxResult.taxLabel ?? "Tax"}</span>
                    <span>
                      {taxResult.isGstExempt ? formatInr(0) : formatInr(tax)}
                    </span>
                  </div>
                )}
                {taxResult.taxNote && (
                  <p className="text-[12px] leading-relaxed text-zinc-500">
                    {taxResult.taxNote}
                  </p>
                )}
                <div className="h-px w-full bg-black/10" />
                <div className="flex items-center justify-between font-bold">
                  <span>Total due today</span>
                  <span>
                    {isVariableCheckoutPlan
                      ? formatInr(0)
                      : formatInr(total)}
                  </span>
                </div>
              </div>

              <div className="flex gap-4 rounded-xl border border-black/10 bg-white p-5">
                <Info className="icon-md mt-0.5 shrink-0 icon-muted" />
                <p className="text-[14px] leading-relaxed">
                  {isVariableCheckoutPlan ? (
                    <>
                      No automatic renewal charge applies until a fixed price or
                      usage schedule is agreed. Use the form on the right so we
                      can follow up on next steps.
                    </>
                  ) : (
                    <>
                      Your subscription will auto renew on {renewalDate}. You
                      will be charged{" "}
                      <span className="font-semibold">
                        {formatInr(total)} today
                        {taxResult.showTaxRow && !taxResult.isGstExempt
                          ? " including applicable tax"
                          : ""}{" "}
                        and {formatInr(subtotal)}
                        {cycleLabel} on renewal
                        {taxResult.showTaxRow && !taxResult.isGstExempt
                          ? " plus tax where applicable"
                          : ""}
                      </span>
                      .
                    </>
                  )}
                </p>
              </div>
            </div>
          </aside>

          {/* Right column — checkout form */}
          <div className="min-w-0 flex-1 pb-8">
            {payError && <CheckoutErrorBanner message={payError} />}
            <CheckoutForm
              paymentTab={paymentTab}
              onPaymentTabChange={setPaymentTab}
              savedMethod={savedMethod}
              purchasingAsBusiness={purchasingAsBusiness}
              onPurchasingAsBusinessChange={setPurchasingAsBusiness}
              gstin={gstin}
              onGstinChange={(value) => {
                setGstin(value);
                setGstinError(null);
              }}
              gstinError={gstinError}
              onGstinBlur={() => {
                const normalized = normalizeGstin(gstin);
                if (normalized && !isValidIndianGstin(normalized)) {
                  setGstinError("Enter a valid 15-character GSTIN.");
                } else {
                  setGstinError(null);
                }
              }}
              billToName={billToName}
              onBillToNameChange={setBillToName}
              agreed={agreed}
              onAgreedChange={setAgreed}
              paying={paying}
              payDisabled={
                !agreed ||
                isVariableCheckoutPlan ||
                paying ||
                !seatsValid ||
                !bundleSeatsValid ||
                !billingFormValid ||
                !paymentFieldsValid
              }
              payLabel={`Pay ${formatInr(total)}`}
              variablePlanNotice={
                isVariableCheckoutPlan
                  ? "Card charges are disabled for this plan until pricing is confirmed."
                  : null
              }
              onPay={() => void handleSubscribe()}
              onCardFieldsChange={handleCardFieldsChange}
              showExpressCheckout={applePayAvailable}
              hideUpi={isUsd}
              onExpressCheckout={() => {
                void handleSubscribe("card", { walletExpress: true });
              }}
            />
          </div>

          <CheckoutUpiQrModal
            open={upiModalOpen}
            imageUrl={upiQrImageUrl}
            amountLabel={formatInr(total)}
            onClose={handleUpiModalClose}
          />
        </main>
      </div>
    </div>
  );
}
