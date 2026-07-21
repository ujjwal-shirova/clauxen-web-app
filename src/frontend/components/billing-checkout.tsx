"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@/frontend/lib/utils";
import { Info, Minus, Plus } from "lucide-react";
import {
  createBillingOrder,
  createCheckoutSession,
  createUpiBillingPayment,
  pollUpiBillingPayment,
  refreshCheckoutSession,
  verifyBillingPayment,
} from "@/frontend/lib/api/billing";
import { CheckoutErrorBanner } from "@/frontend/components/checkout-error-banner";
import { CheckoutForm } from "@/frontend/components/checkout-form";
import type {
  CheckoutCardFieldState,
  CheckoutNetbankingFieldState,
} from "@/frontend/components/checkout-payment-panel";
import {
  checkoutAddressToBillingLine,
  getCheckoutAddressIncompleteReason,
  type CheckoutAddressState,
} from "@/frontend/components/checkout-billing-address";
import { CheckoutBootstrapping } from "@/frontend/components/checkout-bootstrapping";
import { CheckoutUpiQrModal } from "@/frontend/components/checkout-upi-qr-modal";
import { canUseApplePay } from "@/frontend/lib/apple-pay";
import { openRazorpayCheckout } from "@/frontend/lib/razorpay-checkout";
import {
  chargeCardWithRazorpayCustom,
  isRazorpayCustomScriptReady,
  loadRazorpayCustomScript,
  normalizeIndianMobileContact,
  startNetbankingWithRazorpayCustom,
  warmRazorpayCustomCheckout,
} from "@/frontend/lib/razorpay-custom-checkout";
import { useCheckoutCurrency } from "@/frontend/hooks/use-checkout-currency";
import { useAuth } from "@/frontend/hooks/use-auth";
import type {
  CheckoutPaymentTab,
  SavedPaymentMethod,
} from "@/lib/checkout-payment-tab";
import { isActivatedNetbankingBank } from "@/lib/razorpay-netbanking-banks";
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
  /** Preferred return path after pay / back (hosted checkout). */
  returnPath?: string | null;
  /** Expired signed session — remint for the same logged-in user (no 404). */
  needsSessionRemint?: boolean;
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
  returnPath = null,
  needsSessionRemint = false,
}: BillingCheckoutProps) {
  const auth = useAuth();
  const { currency, formatInr, isUsd, ready } = useCheckoutCurrency();
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
    needsSessionRemint ? null : (initialCheckoutSessionId ?? null),
  );
  const [upiModalOpen, setUpiModalOpen] = useState(false);
  const [upiQrImageUrl, setUpiQrImageUrl] = useState<string | null>(null);
  const [upiCloseBy, setUpiCloseBy] = useState<number | null>(null);
  const [upiPoll, setUpiPoll] = useState<{
    qrId: string;
    billingOrderId: string;
  } | null>(null);
  const [cardFields, setCardFields] = useState<CheckoutCardFieldState>({
    cardNumber: "",
    cardExpiry: "",
    cardCvc: "",
    isComplete: false,
  });
  const [netbankingFields, setNetbankingFields] =
    useState<CheckoutNetbankingFieldState>({
      bankCode: null,
      mobile: "",
      isComplete: false,
    });
  /** Prefetched Razorpay order so Pay can call createPayment in the same click turn. */
  const netbankingOrderRef = React.useRef<{
    fingerprint: string;
    keyId: string;
    orderId: string;
    amount: number;
    currency: string;
  } | null>(null);
  const [netbankingOrderReady, setNetbankingOrderReady] = useState(false);
  const [netbankingOrderError, setNetbankingOrderError] = useState<string | null>(
    null,
  );
  /** Bump to force a fresh prefetched order after a cancelled/failed attempt. */
  const [netbankingPrepKey, setNetbankingPrepKey] = useState(0);
  const [razorpayScriptReady, setRazorpayScriptReady] = useState(() =>
    typeof window !== "undefined" ? isRazorpayCustomScriptReady() : false,
  );
  const [billingAddress, setBillingAddress] = useState<CheckoutAddressState>({
    fullName: "",
    countryCode: "IN",
    addressLine1: "",
    addressLine2: "",
    city: "",
    pin: "",
    state: "",
    isComplete: false,
  });
  const [applePayAvailable, setApplePayAvailable] = useState(false);
  const [sessionReminted, setSessionReminted] = useState(!needsSessionRemint);

  // When a checkout session id is provided via prop (e.g. direct /checkout link),
  // skip the *first* auto-create so we reuse the incoming session — unless it
  // must be reminted after expiry.
  const skipInitialSessionCreate = React.useRef(
    Boolean(initialCheckoutSessionId) && !needsSessionRemint,
  );
  const lastSessionFingerprint = React.useRef<string | null>(null);
  const adoptRemintedSession = React.useRef(false);

  const syncCheckoutUrl = useCallback((checkoutPath: string) => {
    if (typeof window === "undefined") return;
    if (window.location.pathname + window.location.search === checkoutPath) {
      return;
    }
    window.history.replaceState(null, "", checkoutPath);
  }, []);

  useEffect(() => {
    setApplePayAvailable(canUseApplePay());
  }, []);

  useEffect(() => {
    if (initialCheckoutSessionId?.startsWith("cs_live_") && !needsSessionRemint) {
      syncCheckoutUrl(`/checkout/shirova/${initialCheckoutSessionId}`);
    }
  }, [initialCheckoutSessionId, needsSessionRemint, syncCheckoutUrl]);

  useEffect(() => {
    if (!hasSavedPaymentMethod && paymentTab === "saved") {
      setPaymentTab("card");
    }
  }, [hasSavedPaymentMethod, paymentTab]);

  useEffect(() => {
    if (auth.user?.displayName?.trim() && !billingAddress.fullName) {
      setBillingAddress((prev) => ({
        ...prev,
        fullName: auth.user!.displayName!.trim(),
        isComplete: prev.isComplete,
      }));
    }
  }, [auth.user?.displayName, billingAddress.fullName]);

  // Remint expired hosted sessions for the same logged-in user (no page-not-found).
  useEffect(() => {
    if (!needsSessionRemint || !initialCheckoutSessionId) {
      setSessionReminted(true);
      return;
    }
    if (auth.loading) return;

    let cancelled = false;
    void (async () => {
      if (!auth.user) {
        if (!cancelled) {
          setPayError("Sign in to continue this checkout.");
          setSessionReminted(true);
        }
        return;
      }

      try {
        const session = await refreshCheckoutSession({
          sessionId: initialCheckoutSessionId,
        });
        if (cancelled) return;
        adoptRemintedSession.current = true;
        setCheckoutSessionId(session.sessionId);
        syncCheckoutUrl(session.checkoutPath);
        setPayError(null);
      } catch {
        // Fall through to a fresh mint with current plan selections.
        if (!cancelled) {
          setPayError(null);
        }
      } finally {
        if (!cancelled) setSessionReminted(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    needsSessionRemint,
    initialCheckoutSessionId,
    auth.loading,
    auth.user,
    syncCheckoutUrl,
  ]);

  const handleCardFieldsChange = useCallback((state: CheckoutCardFieldState) => {
    setCardFields(state);
  }, []);

  const handleNetbankingFieldsChange = useCallback(
    (state: CheckoutNetbankingFieldState) => {
      setNetbankingFields(state);
    },
    [],
  );

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
        billingAddress.fullName.trim() ||
        auth.user?.displayName?.trim() ||
        auth.user?.email?.split("@")[0]?.trim() ||
        "Customer",
      countryCode: billingAddress.countryCode || "IN",
      addressLine: checkoutAddressToBillingLine(billingAddress),
      gstin:
        purchasingAsBusiness && gstin.trim()
          ? normalizeGstin(gstin)
          : undefined,
      billToName:
        purchasingAsBusiness && billToName.trim()
          ? billToName.trim()
          : undefined,
    }),
    [
      billingAddress,
      auth.user?.displayName,
      auth.user?.email,
      gstin,
      purchasingAsBusiness,
      billToName,
    ],
  );

  const minimalBillingDetails = useMemo(
    () => ({
      purchasingAsBusiness,
      fullName: billingDetails.fullName,
      countryCode: billingDetails.countryCode,
      addressLine: billingDetails.addressLine,
      ...(purchasingAsBusiness && gstin.trim()
        ? { gstin: normalizeGstin(gstin) }
        : {}),
      ...(purchasingAsBusiness && billToName.trim()
        ? { billToName: billToName.trim() }
        : {}),
    }),
    [purchasingAsBusiness, gstin, billToName, billingDetails],
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

  const sessionFingerprint = useMemo(
    () =>
      JSON.stringify({
        plan: resolveApiPlanId(activePlanId, maxTier),
        cycle: isMaxPlan ? "monthly" : effectiveBillingCycle,
        currency,
        maxTier: isMaxPlan ? maxTier : null,
        seats: isTeamPlan ? seatCounts : null,
        bundle: isBusinessWorkspace ? bundleSeatCount : null,
      }),
    [
      activePlanId,
      maxTier,
      isMaxPlan,
      effectiveBillingCycle,
      currency,
      isTeamPlan,
      seatCounts,
      isBusinessWorkspace,
      bundleSeatCount,
    ],
  );

  useEffect(() => {
    if (
      ready &&
      isUsd &&
      (paymentTab === "upi" || paymentTab === "netbanking")
    ) {
      setPaymentTab("card");
    }
  }, [ready, isUsd, paymentTab]);

  // Prefetch Custom Checkout script + warm Razorpay edge as soon as INR checkout is ready.
  useEffect(() => {
    if (!ready || isUsd) return;
    const publicKey =
      typeof process !== "undefined"
        ? process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID?.trim()
        : undefined;
    void loadRazorpayCustomScript().then((ok) => {
      if (ok) setRazorpayScriptReady(true);
    });
    if (publicKey) {
      void warmRazorpayCustomCheckout(publicKey).then((ok) => {
        if (ok) setRazorpayScriptReady(true);
      });
    }
  }, [ready, isUsd]);

  // Prefetch order on Net Banking tab so Pay → createPayment has no network wait.
  useEffect(() => {
    if (
      !ready ||
      isUsd ||
      paymentTab !== "netbanking" ||
      !checkoutSessionId ||
      isVariableCheckoutPlan ||
      !auth.user
    ) {
      return;
    }

    let cancelled = false;
    const fingerprint = `${sessionFingerprint}::${netbankingPrepKey}`;

    if (
      netbankingOrderRef.current?.fingerprint === fingerprint &&
      netbankingOrderRef.current.keyId
    ) {
      setNetbankingOrderReady(true);
      setNetbankingOrderError(null);
      void warmRazorpayCustomCheckout(netbankingOrderRef.current.keyId);
      return;
    }

    setNetbankingOrderReady(false);
    setNetbankingOrderError(null);
    netbankingOrderRef.current = null;

    void (async () => {
      try {
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
        if (cancelled) return;
        const keyId = checkout.razorpay.keyId;
        if (!keyId) {
          throw new Error("Razorpay is not configured for checkout.");
        }
        netbankingOrderRef.current = {
          fingerprint,
          keyId,
          orderId: checkout.razorpay.orderId,
          amount: checkout.razorpay.amount,
          currency: checkout.razorpay.currency,
        };
        setNetbankingOrderReady(true);
        setNetbankingOrderError(null);
        void warmRazorpayCustomCheckout(keyId).then((ok) => {
          if (ok) setRazorpayScriptReady(true);
        });
      } catch (error) {
        if (cancelled) return;
        netbankingOrderRef.current = null;
        setNetbankingOrderReady(false);
        setNetbankingOrderError(
          error instanceof Error
            ? error.message
            : "Could not prepare netbanking payment.",
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    ready,
    isUsd,
    paymentTab,
    checkoutSessionId,
    isVariableCheckoutPlan,
    auth.user,
    sessionFingerprint,
    netbankingPrepKey,
    activePlanId,
    maxTier,
    isMaxPlan,
    maxDetails.checkoutName,
    details.name,
    effectiveBillingCycle,
    minimalBillingDetails,
    currency,
    isTeamPlan,
    seatCounts,
    isBusinessWorkspace,
    bundleSeatCount,
  ]);

  // Keep Razorpay edge hot while the user fills mobile / picks a bank.
  useEffect(() => {
    if (paymentTab !== "netbanking" || isUsd || !ready) return;
    const keyId =
      netbankingOrderRef.current?.keyId ||
      process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID?.trim();
    if (!keyId) return;
    void warmRazorpayCustomCheckout(keyId);
  }, [paymentTab, netbankingFields.bankCode, netbankingFields.mobile, ready, isUsd]);

  useEffect(() => {
    if (isVariableCheckoutPlan) return;
    if (auth.loading || !sessionReminted) return;
    if (!auth.user) return;

    // Reuse a still-valid hosted session on first paint.
    if (skipInitialSessionCreate.current) {
      skipInitialSessionCreate.current = false;
      lastSessionFingerprint.current = sessionFingerprint;
      return;
    }

    // Remint just adopted a new session for this plan — don't mint again.
    if (adoptRemintedSession.current) {
      adoptRemintedSession.current = false;
      lastSessionFingerprint.current = sessionFingerprint;
      return;
    }

    // Already minted/reminted for this plan selection — don't loop.
    if (
      lastSessionFingerprint.current === sessionFingerprint &&
      checkoutSessionId
    ) {
      return;
    }

    // IMPORTANT: Checkout Session is a server-signed token (6h). Client never
    // dictates price — Razorpay Order amount is computed server-side at pay time.
    let cancelled = false;

    const mint = async (attempt: number): Promise<void> => {
      try {
        const session = await createCheckoutSession({
          planId: resolveApiPlanId(activePlanId, maxTier),
          planName: isMaxPlan ? maxDetails.checkoutName : details.name,
          billingCycle: isMaxPlan ? "monthly" : effectiveBillingCycle,
          currency,
          maxTier: isMaxPlan ? maxTier : undefined,
          returnPath:
            returnPath ||
            (typeof window !== "undefined"
              ? window.location.pathname.startsWith("/checkout/")
                ? "/new"
                : window.location.pathname
              : "/new"),
          ...(isTeamPlan ? { seatBreakdown: seatCounts } : {}),
          ...(isBusinessWorkspace
            ? { organizationSeatCount: bundleSeatCount }
            : {}),
        });
        if (cancelled) return;
        lastSessionFingerprint.current = sessionFingerprint;
        setCheckoutSessionId(session.sessionId);
        syncCheckoutUrl(session.checkoutPath);
        setPayError(null);
      } catch {
        if (cancelled) return;
        if (attempt < 4) {
          await new Promise((r) => window.setTimeout(r, 500 * attempt));
          if (!cancelled) await mint(attempt + 1);
          return;
        }
        setPayError(
          "We had trouble creating your secure checkout session. Please try again in a moment.",
        );
      }
    };

    void mint(1);

    return () => {
      cancelled = true;
    };
    // checkoutSessionId intentionally omitted — fingerprint + lastSessionFingerprint gate remints.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see above
  }, [
    sessionFingerprint,
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
    returnPath,
    syncCheckoutUrl,
    auth.loading,
    auth.user,
    sessionReminted,
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
            onPaymentSuccess?.({
              razorpayPaymentId: result.fulfillment?.payment_id,
              razorpayOrderId: result.fulfillment?.order_id,
            });
          }
        } catch {
          window.clearInterval(interval);
          setUpiModalOpen(false);
          setUpiPoll(null);
          setPaying(false);
          setPayError(PAYMENT_FAILED_MESSAGE);
        }
      })();
    }, 2000);

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
    (paymentTab === "upi" && billingAddress.isComplete) ||
    (paymentTab === "saved" && hasSavedPaymentMethod) ||
    (paymentTab === "netbanking" &&
      netbankingFields.isComplete &&
      netbankingOrderReady &&
      razorpayScriptReady) ||
    (paymentTab === "card" && cardFields.isComplete);

  const payDisabledReason = useMemo(() => {
    if (isVariableCheckoutPlan) {
      return "This plan needs pricing confirmation before checkout.";
    }
    if (!agreed) return "Accept the terms to continue.";
    if (auth.loading || !auth.user) {
      return "Sign in to continue checkout.";
    }
    if (!checkoutSessionId) return "Securing your checkout…";
    if (paymentTab === "upi") {
      return getCheckoutAddressIncompleteReason(billingAddress);
    }
    if (paymentTab === "netbanking") {
      if (!netbankingFields.bankCode) {
        return "Select your bank to continue.";
      }
      if (!normalizeIndianMobileContact(netbankingFields.mobile)) {
        return "Enter a valid 10-digit mobile number.";
      }
      if (netbankingOrderError) {
        return netbankingOrderError;
      }
      if (!netbankingOrderReady || !razorpayScriptReady) {
        return "Preparing secure bank payment…";
      }
      return null;
    }
    if (paymentTab === "card" && !cardFields.isComplete) {
      return "Enter a complete card number, expiry, and CVC.";
    }
    if (!seatsValid || !bundleSeatsValid) {
      return "Adjust seat count to continue.";
    }
    return null;
  }, [
    isVariableCheckoutPlan,
    agreed,
    auth.loading,
    auth.user,
    checkoutSessionId,
    paymentTab,
    billingAddress,
    netbankingFields.isComplete,
    netbankingFields.bankCode,
    netbankingFields.mobile,
    netbankingOrderReady,
    netbankingOrderError,
    razorpayScriptReady,
    cardFields.isComplete,
    seatsValid,
    bundleSeatsValid,
  ]);

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
      (tab === "upi" && billingAddress.isComplete) ||
      (tab === "saved" && hasSavedPaymentMethod) ||
      (tab === "netbanking" &&
        Boolean(netbankingFields.bankCode) &&
        isActivatedNetbankingBank(netbankingFields.bankCode!) &&
        Boolean(normalizeIndianMobileContact(netbankingFields.mobile)) &&
        Boolean(netbankingOrderRef.current) &&
        razorpayScriptReady) ||
      (tab === "card" && cardFields.isComplete);

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
        // Always use our custom QR modal — never Razorpay hosted Checkout.
        setUpiQrImageUrl(null);
        setUpiCloseBy(null);
        setUpiModalOpen(true);
        setUpiPoll(null);
        const checkout = await createUpiBillingPayment({
          checkoutSessionId,
          billingDetails: minimalBillingDetails,
          ...(isTeamPlan ? { seatBreakdown: seatCounts } : {}),
          ...(isBusinessWorkspace
            ? { organizationSeatCount: bundleSeatCount }
            : {}),
        });

        if (!checkout.upi.qrId) {
          throw new Error("UPI QR could not be generated.");
        }
        setUpiCloseBy(
          checkout.upi.closeBy ??
            Math.floor(Date.now() / 1000) + 20 * 60,
        );
        // Prefer inline clean PNG (upi://) — skip branded Razorpay image_url card.
        setUpiQrImageUrl(
          checkout.upi.imageDataUrl ||
            `/api/v1/billing/orders/upi/qr/${encodeURIComponent(checkout.upi.qrId)}/image`,
        );
        setUpiPoll({
          qrId: checkout.upi.qrId,
          billingOrderId: checkout.order.id,
        });
        return;
      }

      if (tab === "netbanking") {
        const bank = netbankingFields.bankCode;
        const prefetched = netbankingOrderRef.current;
        const contact = normalizeIndianMobileContact(netbankingFields.mobile);
        if (!bank || !isActivatedNetbankingBank(bank)) {
          throw new Error("Select a supported bank to continue.");
        }
        if (!contact) {
          throw new Error("Enter a valid 10-digit mobile number.");
        }
        if (
          !prefetched ||
          !prefetched.fingerprint.startsWith(`${sessionFingerprint}::`) ||
          !razorpayScriptReady ||
          !isRazorpayCustomScriptReady()
        ) {
          throw new Error(
            "Secure bank payment is still preparing. Please wait a moment and try again.",
          );
        }

        // Snapshot order for this click; clear after createPayment starts so
        // React state updates cannot race the bank popup open.
        const orderSnapshot = prefetched;
        netbankingOrderRef.current = null;

        // Stay on checkout — Custom Checkout popup + handlers (no full-page redirect).
        await startNetbankingWithRazorpayCustom({
          keyId: orderSnapshot.keyId,
          orderId: orderSnapshot.orderId,
          amount: orderSnapshot.amount,
          currency: orderSnapshot.currency,
          email: auth.user?.email ?? undefined,
          contact,
          description: details.name,
          bank,
          onSuccess: async (payment) => {
            await verifyBillingPayment({
              razorpayOrderId: payment.razorpay_order_id,
              razorpayPaymentId: payment.razorpay_payment_id,
              razorpaySignature: payment.razorpay_signature,
            });
            onPaymentSuccess?.({
              razorpayPaymentId: payment.razorpay_payment_id,
              razorpayOrderId: payment.razorpay_order_id,
            });
          },
          onFailure: (message) => {
            setPayError(message || PAYMENT_FAILED_MESSAGE);
            setNetbankingOrderReady(false);
            setNetbankingPrepKey((key) => key + 1);
          },
        });
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

      // Apple Pay express still uses Standard Checkout (wallet UI).
      if (options?.walletExpress) {
        await openRazorpayCheckout({
          keyId,
          orderId: checkout.razorpay.orderId,
          amount: checkout.razorpay.amount,
          currency: checkout.razorpay.currency,
          name: "Shirova",
          description: details.name,
          paymentMethod: "card",
          expressCheckout: "apple_pay",
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
            onPaymentSuccess?.({
              razorpayPaymentId: payment.razorpay_payment_id,
              razorpayOrderId: payment.razorpay_order_id,
            });
          },
          onDismiss: () => {
            setPayError(PAYMENT_FAILED_MESSAGE);
          },
        });
        return;
      }

      // Card tab: Custom Checkout — PAN/CVV never leave the browser except to Razorpay.
      await chargeCardWithRazorpayCustom({
        keyId,
        orderId: checkout.razorpay.orderId,
        amount: checkout.razorpay.amount,
        currency: checkout.razorpay.currency,
        email: auth.user?.email ?? undefined,
        description: details.name,
        card: {
          number: cardFields.cardNumber,
          name: billingDetails.billToName ?? billingDetails.fullName,
          expiry: cardFields.cardExpiry,
          cvc: cardFields.cardCvc,
        },
        onSuccess: async (payment) => {
          await verifyBillingPayment({
            razorpayOrderId: payment.razorpay_order_id,
            razorpayPaymentId: payment.razorpay_payment_id,
            razorpaySignature: payment.razorpay_signature,
          });
          onPaymentSuccess?.({
            razorpayPaymentId: payment.razorpay_payment_id,
            razorpayOrderId: payment.razorpay_order_id,
          });
        },
        onFailure: (message) => {
          setPayError(message || PAYMENT_FAILED_MESSAGE);
        },
      });
    } catch (error) {
      if (tab === "upi") {
        setUpiModalOpen(false);
        setUpiQrImageUrl(null);
        setUpiPoll(null);
        setPaying(false);
      }
      if (tab === "netbanking") {
        setPaying(false);
        // Allow a fresh prefetched order after a failed / cancelled attempt.
        netbankingOrderRef.current = null;
        setNetbankingOrderReady(false);
        setNetbankingPrepKey((key) => key + 1);
      }
      const message =
        error instanceof Error ? error.message : PAYMENT_FAILED_MESSAGE;
      setPayError(
        message === "Request failed."
          ? "UPI checkout could not start. Razorpay keys may be missing or QR Codes may not be enabled on your Razorpay account."
          : message,
      );
    } finally {
      // UPI keeps paying until modal closes; netbanking awaits popup handlers.
      if (tab !== "upi") {
        setPaying(false);
      }
    }
  };

  const handleUpiModalClose = useCallback(
    (reason: "cancel" | "timeout" = "cancel") => {
      setUpiModalOpen(false);
      setUpiPoll(null);
      setUpiQrImageUrl(null);
      setUpiCloseBy(null);
      setPaying(false);
      if (reason === "timeout") {
        setPayError("UPI QR expired. Please try again.");
      } else {
        setPayError(PAYMENT_FAILED_MESSAGE);
      }
    },
    [],
  );

  const billingCycleToggle = !isMaxPlan && !isVariableCheckoutPlan && (
    <div className="grid grid-cols-2 gap-2 sm:gap-4">
      <button
        type="button"
        onClick={() => setBillingCycle("monthly")}
        className={cn(
          "flex flex-col items-start rounded-2xl border px-4 py-4 text-left transition-all",
          effectiveBillingCycle === "monthly"
            ? "border-zinc-900 bg-zinc-900 text-white"
            : "border-zinc-200 bg-[var(--app-panel-bg)] hover:border-zinc-300",
        )}
      >
        <div className="mb-3 flex w-full items-center justify-between">
          <div
            className={cn(
              "flex h-[22px] w-[22px] items-center justify-center rounded-full border-2",
              effectiveBillingCycle === "monthly"
                ? "border-white/80"
                : "border-zinc-300",
            )}
          >
            {effectiveBillingCycle === "monthly" && (
              <div className="h-2.5 w-2.5 rounded-full bg-white" />
            )}
          </div>
        </div>
        <span className="max-w-[75%] text-left font-medium">Monthly</span>
        <span
          className={cn(
            "mt-1 text-left text-[14px] leading-5",
            effectiveBillingCycle === "monthly"
              ? "text-white/80"
              : "text-zinc-600",
          )}
        >
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
          "flex flex-col items-start rounded-2xl border px-4 py-4 text-left transition-all",
          effectiveBillingCycle === "yearly"
            ? "border-zinc-900 bg-zinc-900 text-white"
            : "border-zinc-200 bg-[var(--app-panel-bg)] hover:border-zinc-300",
          orgPlan && !orgPlan.yearlySupported && "cursor-not-allowed opacity-50",
        )}
      >
        <div className="mb-3 flex w-full items-center justify-between">
          <div
            className={cn(
              "flex h-[22px] w-[22px] items-center justify-center rounded-full border-2",
              effectiveBillingCycle === "yearly"
                ? "border-white/80"
                : "border-zinc-300",
            )}
          >
            {effectiveBillingCycle === "yearly" && (
              <div className="h-2.5 w-2.5 rounded-full bg-white" />
            )}
          </div>
          {(orgPlan?.yearlySupported ?? details.yearly > 0) && (
            <div
              className={cn(
                "rounded-lg px-2 py-1 text-[12px] font-medium leading-4",
                effectiveBillingCycle === "yearly"
                  ? "bg-white/15 text-white"
                  : "bg-zinc-100 text-zinc-700",
              )}
            >
              Save {YEARLY_DISCOUNT_PERCENT}%
            </div>
          )}
        </div>
        <span className="max-w-[75%] text-left font-medium">Yearly</span>
        <span
          className={cn(
            "mt-1 text-left text-[14px] leading-5",
            effectiveBillingCycle === "yearly"
              ? "text-white/80"
              : "text-zinc-600",
          )}
        >
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
            "flex flex-col items-start rounded-2xl border px-4 py-4 text-left transition-all",
            maxTier === tier
              ? "border-zinc-900 bg-zinc-900 text-white"
              : "border-zinc-200 bg-[var(--app-panel-bg)] hover:border-zinc-300",
          )}
        >
          <div className="mb-3 flex w-full items-center justify-between">
            <div
              className={cn(
                "flex h-[22px] w-[22px] items-center justify-center rounded-full border-2",
                maxTier === tier ? "border-white/80" : "border-zinc-300",
              )}
            >
              {maxTier === tier && (
                <div className="h-2.5 w-2.5 rounded-full bg-white" />
              )}
            </div>
            {tierDetails.badge && (
              <div
                className={cn(
                  "rounded-lg px-2 py-1 text-[12px] font-medium leading-4",
                  maxTier === tier
                    ? "bg-white/15 text-white"
                    : "bg-zinc-100 text-zinc-700",
                )}
              >
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
    <div className="rounded-2xl border border-zinc-200/90 bg-[var(--app-panel-bg)] px-4 py-4 text-[14px] leading-relaxed text-zinc-800">
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

  const checkoutReady =
    !auth.loading &&
    sessionReminted &&
    Boolean(checkoutSessionId) &&
    ready;

  if (!checkoutReady) {
    const bootMessage = auth.loading
      ? "Signing you in…"
      : !sessionReminted
        ? "Refreshing your checkout session…"
        : !checkoutSessionId
          ? "Securing your checkout…"
          : "Preparing secure checkout…";
    return <CheckoutBootstrapping message={bootMessage} />;
  }

  return (
    <div className="relative w-full bg-[var(--app-shell-bg)] font-sans text-zinc-800">
      <button
        type="button"
        onClick={onBack}
        className="absolute left-4 top-[max(1rem,env(safe-area-inset-top))] z-20 flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200/80 bg-[var(--app-panel-bg)] text-zinc-700 shadow-[0_1px_2px_rgba(24,24,27,0.04)] transition-colors hover:bg-white sm:left-6"
        aria-label="Back"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          fill="currentColor"
          viewBox="0 0 256 256"
        >
          <path d="M228,128a12,12,0,0,1-12,12H69l51.52,51.51a12,12,0,0,1-17,17l-72-72a12,12,0,0,1,0-17l72-72a12,12,0,0,1,17,17L69,116H216A12,12,0,0,1,228,128Z" />
        </svg>
      </button>

      <div className="w-full">
        <main className="mx-auto flex w-full max-w-[1080px] flex-col items-start gap-8 px-4 pb-28 pt-[max(4.5rem,calc(env(safe-area-inset-top)+3.25rem))] sm:gap-10 sm:px-6 lg:flex-row">
          {/* Left column — plan summary */}
          <aside className="w-full shrink-0 self-start lg:sticky lg:top-6 lg:w-[400px]">
            <h1 className="mb-6 text-[22px] font-semibold tracking-[-0.03em] text-zinc-900 sm:text-[24px]">
              {details.name}
            </h1>

            <div className="flex flex-col gap-4">
              {maxTierToggle}
              {billingCycleToggle}
              {teamSeatConfigurator}
              {businessSeatConfigurator}
              {variablePlanNotice}

              <div className="flex flex-col gap-3.5 rounded-2xl border border-zinc-200/90 bg-[var(--app-panel-bg)] p-5 text-[14px] shadow-[0_1px_2px_rgba(24,24,27,0.03)]">
                <div className="text-[13px] font-semibold uppercase tracking-[0.04em] text-zinc-400">
                  Order details
                </div>

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
                <div className="h-px w-full bg-zinc-100" />
                <div className="flex items-center justify-between font-semibold text-zinc-900">
                  <span>Total due today</span>
                  <span>
                    {isVariableCheckoutPlan
                      ? formatInr(0)
                      : formatInr(total)}
                  </span>
                </div>
              </div>

              <div className="flex gap-3 rounded-2xl border border-zinc-200/90 bg-[var(--app-panel-bg)] p-4">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
                <p className="text-[13px] leading-relaxed text-zinc-600">
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
          <div className="box-border min-w-0 w-full flex-1 rounded-2xl border border-zinc-200/90 bg-[var(--app-panel-bg)] px-6 py-7 shadow-[0_1px_2px_rgba(24,24,27,0.03)] sm:px-8 sm:py-8">
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
              payDisabledReason={payDisabledReason}
              payLabel={`Pay ${formatInr(total)}`}
              variablePlanNotice={
                isVariableCheckoutPlan
                  ? "Card charges are disabled for this plan until pricing is confirmed."
                  : null
              }
              onPay={() => void handleSubscribe()}
              onPayPrepare={() => {
                if (paymentTab !== "netbanking" || isUsd) return;
                const keyId =
                  netbankingOrderRef.current?.keyId ||
                  process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID?.trim();
                if (keyId) void warmRazorpayCustomCheckout(keyId);
              }}
              onCardFieldsChange={handleCardFieldsChange}
              onNetbankingChange={handleNetbankingFieldsChange}
              billingAddress={billingAddress}
              onBillingAddressChange={setBillingAddress}
              showExpressCheckout={false}
              hideUpi={!ready || isUsd}
              hideNetbanking={!ready || isUsd}
              onExpressCheckout={() => {
                // Apple Pay / hosted Checkout disabled — card uses Custom Checkout only.
              }}
            />
          </div>

          <CheckoutUpiQrModal
            open={upiModalOpen}
            imageUrl={upiQrImageUrl}
            amountLabel={formatInr(total)}
            closeBy={upiCloseBy}
            onClose={handleUpiModalClose}
          />
        </main>
      </div>
    </div>
  );
}
