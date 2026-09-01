"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Info, Minus, Plus, ShieldCheck } from "lucide-react";
import {
  createBillingOrder,
  createCheckoutSession,
  createUpiBillingPayment,
  getBillingAddress,
  listPaymentMethods,
  pollUpiBillingPayment,
  refreshCheckoutSession,
  upsertBillingAddress,
  verifyBillingPayment,
} from "@/lib/api/billing";
import { CheckoutErrorBanner } from "@/components/checkout-error-banner";
import { CheckoutForm } from "@/components/checkout-form";
import type {
  CheckoutCardFieldState,
  CheckoutNetbankingFieldState,
} from "@/components/checkout-payment-panel";
import {
  checkoutAddressToBillingLine,
  getCheckoutAddressIncompleteReason,
  isCheckoutAddressComplete,
  type CheckoutAddressState,
} from "@/components/checkout-billing-address";
import { CheckoutBootstrapping } from "@/components/checkout-bootstrapping";
import { CheckoutUpiQrModal } from "@/components/checkout-upi-qr-modal";
import { canUseApplePay } from "@/lib/apple-pay";
import { openRazorpayCheckout } from "@/lib/razorpay-checkout";
import {
  isRazorpayCustomScriptReady,
  loadRazorpayCustomScript,
  normalizeIndianMobileContact,
  startCardWithRazorpayCustom,
  startNetbankingWithRazorpayCustom,
  warmRazorpayCustomCheckout,
} from "@/lib/razorpay-custom-checkout";
import { ApiError } from "@/lib/api/client";
import { useCheckoutCurrency } from "@/hooks/use-checkout-currency";
import { useAuth } from "@/hooks/use-auth";
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
import {
  computeCheckoutTaxInr,
  type CheckoutBillingDetails,
} from "@/lib/checkout-tax";
import { isValidIndianGstin, normalizeGstin } from "@/lib/gstin";

export type { MaxTier };

interface BillingCheckoutProps {
  onBack: () => void;
  onPaymentSuccess?: (details?: {
    razorpayPaymentId?: string;
    razorpayOrderId?: string;
  }) => void;
  planId: string | null;
  initialBillingCycle?: BillingCycle;
  initialMaxTier?: MaxTier;
  /** If provided, use this session id instead of immediately creating a new one. */
  initialCheckoutSessionId?: string | null;
  /** Preferred return path after pay / back (hosted checkout). */
  returnPath?: string | null;
  /** Expired signed session — remint for the same logged-in user (no 404). */
  needsSessionRemint?: boolean;
  /** Gift checkout — multi-month prepaid, no auto-renew. */
  giftMonths?: number | null;
  isGiftCheckout?: boolean;
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

const PAYMENT_FAILED_MESSAGE = "Payment was not completed. Please try again.";

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
    <div className="flex h-7 items-center rounded-[var(--radius-sm)] bg-[var(--settings-card-bg)] shadow-[inset_0_0_0_1px_var(--settings-btn-border)]">
      <button
        type="button"
        disabled={!canDecrement}
        onClick={onDecrement}
        aria-label="Decrease seats"
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-l-[var(--radius-sm)] transition-colors",
          canDecrement
            ? "text-[var(--settings-fg)] hover:bg-[var(--ui-hover-wash)]"
            : "cursor-not-allowed text-[var(--settings-fg-muted)] opacity-40",
        )}
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <span
        className={cn(
          "min-w-[48px] px-1 text-center text-[12px] font-medium leading-[18px]",
          count === 0 ? "text-[var(--settings-fg-muted)]" : "text-[var(--settings-fg)]",
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
          "flex h-7 w-7 items-center justify-center rounded-r-[var(--radius-sm)] transition-colors",
          canIncrement
            ? "text-[var(--settings-fg)] hover:bg-[var(--ui-hover-wash)]"
            : "cursor-not-allowed text-[var(--settings-fg-muted)] opacity-40",
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
  giftMonths = null,
  isGiftCheckout = false,
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
  const [savedMethod, setSavedMethod] = useState<SavedPaymentMethod | null>(
    null,
  );
  const hasSavedPaymentMethod = savedMethod != null;
  const [paymentTab, setPaymentTab] = useState<CheckoutPaymentTab>("card");
  const [billingAddressCollapsed, setBillingAddressCollapsed] = useState(false);
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
  /** Shared Razorpay `contact` for card / netbanking / UPI (+91…). */
  const [paymentMobile, setPaymentMobile] = useState("");
  const [netbankingFields, setNetbankingFields] =
    useState<CheckoutNetbankingFieldState>({
      bankCode: null,
      mobile: "",
      isComplete: false,
    });
  const paymentContact = useMemo(
    () => normalizeIndianMobileContact(paymentMobile),
    [paymentMobile],
  );
  /**
   * Prefetched Razorpay order for card + netbanking so Pay can call
   * createPayment in the same click turn (required for 3DS / bank OTP).
   */
  const prefetchedOrderRef = React.useRef<{
    fingerprint: string;
    keyId: string;
    orderId: string;
    amount: number;
    currency: string;
  } | null>(null);
  const [prefetchedOrderReady, setPrefetchedOrderReady] = useState(false);
  const [prefetchedOrderError, setPrefetchedOrderError] = useState<
    string | null
  >(null);
  /** Bump to force a fresh prefetched order after a cancelled/failed attempt. */
  const [orderPrepKey, setOrderPrepKey] = useState(0);
  const [razorpayScriptReady, setRazorpayScriptReady] = useState(false);
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

  // Load saved billing address + default card-on-file for returning customers.
  useEffect(() => {
    if (!auth.isAuthenticated) return;
    let cancelled = false;
    void (async () => {
      try {
        const [addrRes, methodsRes] = await Promise.all([
          getBillingAddress(),
          listPaymentMethods(),
        ]);
        if (cancelled) return;

        const addr = addrRes.address;
        if (addr) {
          const next: CheckoutAddressState = {
            fullName: addr.fullName,
            countryCode: addr.countryCode || "IN",
            addressLine1: addr.addressLine1,
            addressLine2: addr.addressLine2 || "",
            city: addr.city,
            pin: addr.postalCode,
            state: addr.state,
            isComplete: false,
          };
          next.isComplete = isCheckoutAddressComplete(next);
          setBillingAddress(next);
          if (next.isComplete) setBillingAddressCollapsed(true);
        }

        const defaultMethod =
          methodsRes.paymentMethods.find((m) => m.isDefault) ||
          methodsRes.paymentMethods[0];
        if (defaultMethod) {
          const network = (
            [
              "visa",
              "mastercard",
              "amex",
              "rupay",
              "jcb",
              "discover",
              "upi",
            ].includes(defaultMethod.network)
              ? defaultMethod.network
              : defaultMethod.methodType === "upi"
                ? "upi"
                : "unknown"
          ) as SavedPaymentMethod["network"];
          setSavedMethod({
            id: defaultMethod.id,
            methodType: defaultMethod.methodType,
            brand: defaultMethod.brand || defaultMethod.network,
            first4: defaultMethod.cardFirst4 ?? undefined,
            last4: defaultMethod.cardLast4 ?? undefined,
            upiVpa: defaultMethod.upiVpa,
            maskedNumber: defaultMethod.maskedNumber,
            network,
          });
          setPaymentTab("saved");
        }
      } catch {
        // keep empty defaults
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [auth.isAuthenticated]);

  // Autosave complete billing address so the next checkout skips the form.
  useEffect(() => {
    if (!auth.isAuthenticated || !billingAddress.isComplete) return;
    const handle = window.setTimeout(() => {
      void upsertBillingAddress({
        fullName: billingAddress.fullName,
        countryCode: billingAddress.countryCode || "IN",
        addressLine1: billingAddress.addressLine1,
        addressLine2: billingAddress.addressLine2,
        city: billingAddress.city,
        state: billingAddress.state,
        postalCode: billingAddress.pin,
        notify: false,
      }).catch(() => undefined);
    }, 800);
    return () => window.clearTimeout(handle);
  }, [
    auth.isAuthenticated,
    billingAddress.isComplete,
    billingAddress.fullName,
    billingAddress.countryCode,
    billingAddress.addressLine1,
    billingAddress.addressLine2,
    billingAddress.city,
    billingAddress.state,
    billingAddress.pin,
  ]);

  useEffect(() => {
    if (
      initialCheckoutSessionId?.startsWith("cs_live_") &&
      !needsSessionRemint
    ) {
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

  const handleCardFieldsChange = useCallback(
    (state: CheckoutCardFieldState) => {
      setCardFields(state);
    },
    [],
  );

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
        cycle: isMaxPlan || isGiftCheckout ? "monthly" : effectiveBillingCycle,
        currency,
        maxTier: isMaxPlan ? maxTier : null,
        seats: isTeamPlan ? seatCounts : null,
        bundle: isBusinessWorkspace ? bundleSeatCount : null,
        gift: isGiftCheckout ? { months: giftMonths } : null,
      }),
    [
      activePlanId,
      maxTier,
      isMaxPlan,
      isGiftCheckout,
      giftMonths,
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

  // Prefetch Custom Checkout (`razorpay.js`) for INR netbanking same-tab redirect.
  useEffect(() => {
    if (!ready || isUsd) return;
    void loadRazorpayCustomScript().then((ok) => {
      if (ok) setRazorpayScriptReady(true);
    });
  }, [ready, isUsd]);

  // After bank redirect callback lands back on checkout with ?checkout=
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const status = params.get("checkout");
    if (!status) return;

    params.delete("checkout");
    const next =
      window.location.pathname +
      (params.toString() ? `?${params.toString()}` : "");
    window.history.replaceState(null, "", next);

    if (status === "success") {
      onPaymentSuccess?.();
      return;
    }
    if (status === "failed") {
      setPayError(PAYMENT_FAILED_MESSAGE);
      setPrefetchedOrderReady(false);
      setOrderPrepKey((key) => key + 1);
      setPaying(false);
      return;
    }
    if (status === "error") {
      setPayError("Bank payment could not be confirmed. Please try again.");
      setPrefetchedOrderReady(false);
      setOrderPrepKey((key) => key + 1);
      setPaying(false);
    }
  }, [onPaymentSuccess]);

  // Prefetch order on Card / Net Banking so Pay has no order-create wait.
  // createPayment must run in the same click turn as the user gesture (3DS/OTP).
  useEffect(() => {
    if (
      !ready ||
      isUsd ||
      (paymentTab !== "netbanking" && paymentTab !== "card") ||
      !checkoutSessionId ||
      isVariableCheckoutPlan ||
      !auth.user
    ) {
      return;
    }

    let cancelled = false;
    const fingerprint = `${sessionFingerprint}::${paymentTab}::${orderPrepKey}`;
    const publicKey = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID?.trim();

    if (
      prefetchedOrderRef.current?.fingerprint === fingerprint &&
      prefetchedOrderRef.current.keyId
    ) {
      setPrefetchedOrderReady(true);
      setPrefetchedOrderError(null);
      void warmRazorpayCustomCheckout(prefetchedOrderRef.current.keyId).then(
        (ok) => {
          if (ok || isRazorpayCustomScriptReady()) setRazorpayScriptReady(true);
        },
      );
      return;
    }

    setPrefetchedOrderReady(false);
    setPrefetchedOrderError(null);
    prefetchedOrderRef.current = null;

    void (async () => {
      try {
        if (publicKey) {
          void warmRazorpayCustomCheckout(publicKey).then((ok) => {
            if (ok || isRazorpayCustomScriptReady())
              setRazorpayScriptReady(true);
          });
        } else {
          void loadRazorpayCustomScript().then((ok) => {
            if (ok) setRazorpayScriptReady(true);
          });
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
        if (cancelled) return;
        const keyId = checkout.razorpay.keyId;
        if (!keyId) {
          throw new Error("Razorpay is not configured for checkout.");
        }
        void warmRazorpayCustomCheckout(keyId).then((ok) => {
          if (ok || isRazorpayCustomScriptReady()) setRazorpayScriptReady(true);
        });
        prefetchedOrderRef.current = {
          fingerprint,
          keyId,
          orderId: checkout.razorpay.orderId,
          amount: checkout.razorpay.amount,
          currency: checkout.razorpay.currency,
        };
        setPrefetchedOrderReady(true);
        setPrefetchedOrderError(null);
      } catch (error) {
        if (cancelled) return;
        prefetchedOrderRef.current = null;
        setPrefetchedOrderReady(false);
        setPrefetchedOrderError(
          error instanceof Error
            ? error.message
            : "Could not prepare secure payment.",
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
    orderPrepKey,
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

    let cancelled = false;
    let inFlight = false;
    let consecutiveErrors = 0;

    const tick = async () => {
      if (cancelled || inFlight) return;
      inFlight = true;
      try {
        const result = await pollUpiBillingPayment(upiPoll);
        consecutiveErrors = 0;
        if (result.status === "paid") {
          cancelled = true;
          setUpiModalOpen(false);
          setUpiPoll(null);
          setPaying(false);
          onPaymentSuccess?.({
            razorpayPaymentId: result.fulfillment?.payment_id,
            razorpayOrderId: result.fulfillment?.order_id,
          });
        }
      } catch (error) {
        consecutiveErrors += 1;
        // Transient network/5xx: keep polling. Hard failures after retries stop.
        const status = error instanceof ApiError ? error.status : 0;
        const hardFail =
          status === 400 || status === 404 || consecutiveErrors >= 8;
        if (hardFail) {
          cancelled = true;
          setUpiModalOpen(false);
          setUpiPoll(null);
          setPaying(false);
          setPayError(
            error instanceof Error ? error.message : PAYMENT_FAILED_MESSAGE,
          );
        }
      } finally {
        inFlight = false;
      }
    };

    void tick();
    const interval = window.setInterval(() => {
      void tick();
    }, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [upiPoll, upiModalOpen, onPaymentSuccess]);

  const subtotal = useMemo(() => {
    if (isGiftCheckout && giftMonths && giftMonths > 0) {
      const monthly = isMaxPlan ? maxDetails.monthlyPriceInr : details.monthly;
      return monthly * giftMonths;
    }
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
    isGiftCheckout,
    giftMonths,
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
  const renewalDate = getRenewalDate(
    isMaxPlan ? "monthly" : effectiveBillingCycle,
  );

  const billingFormValid =
    (!purchasingAsBusiness ||
      !gstin.trim() ||
      isValidIndianGstin(normalizeGstin(gstin))) &&
    Boolean(checkoutSessionId);

  const paymentFieldsValid =
    billingAddress.isComplete &&
    Boolean(paymentContact) &&
    ((paymentTab === "upi" && billingAddress.isComplete) ||
      (paymentTab === "saved" && hasSavedPaymentMethod) ||
      (paymentTab === "netbanking" &&
        netbankingFields.isComplete &&
        prefetchedOrderReady &&
        razorpayScriptReady &&
        isRazorpayCustomScriptReady()) ||
      (paymentTab === "card" &&
        cardFields.isComplete &&
        prefetchedOrderReady &&
        razorpayScriptReady &&
        isRazorpayCustomScriptReady()));

  const payDisabledReason = useMemo(() => {
    if (isVariableCheckoutPlan) {
      return "This plan needs pricing confirmation before checkout.";
    }
    if (!agreed) return "Accept the terms to continue.";
    if (auth.loading || !auth.user) {
      return "Sign in to continue checkout.";
    }
    if (!checkoutSessionId) return "Securing your checkout…";
    const addressReason = getCheckoutAddressIncompleteReason(billingAddress);
    if (addressReason) return addressReason;
    if (!paymentContact) {
      return "Enter a valid 10-digit mobile number.";
    }
    if (paymentTab === "netbanking") {
      if (!netbankingFields.bankCode) {
        return "Select your bank to continue.";
      }
      if (prefetchedOrderError) {
        return prefetchedOrderError;
      }
      if (
        !prefetchedOrderReady ||
        !razorpayScriptReady ||
        !isRazorpayCustomScriptReady()
      ) {
        return "Preparing secure bank payment…";
      }
      return null;
    }
    if (paymentTab === "card") {
      if (!cardFields.isComplete) {
        return "Enter a complete card number, expiry, and CVC.";
      }
      if (prefetchedOrderError) {
        return prefetchedOrderError;
      }
      if (
        !prefetchedOrderReady ||
        !razorpayScriptReady ||
        !isRazorpayCustomScriptReady()
      ) {
        return "Preparing secure card payment…";
      }
      return null;
    }
    if (paymentTab === "upi") {
      return null;
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
    paymentContact,
    netbankingFields.isComplete,
    netbankingFields.bankCode,
    prefetchedOrderReady,
    prefetchedOrderError,
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

  const handleSeatChange = (seatId: SeatAssignablePlanId, delta: 1 | -1) => {
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
      billingAddress.isComplete &&
      Boolean(paymentContact) &&
      (options?.walletExpress ||
        tab === "upi" ||
        (tab === "saved" && hasSavedPaymentMethod) ||
        (tab === "netbanking" &&
          Boolean(netbankingFields.bankCode) &&
          isActivatedNetbankingBank(netbankingFields.bankCode!) &&
          Boolean(prefetchedOrderRef.current) &&
          razorpayScriptReady &&
          isRazorpayCustomScriptReady()) ||
        (tab === "card" &&
          cardFields.isComplete &&
          Boolean(prefetchedOrderRef.current) &&
          razorpayScriptReady &&
          isRazorpayCustomScriptReady()));

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
    /** Keep Pay spinner up through 3DS / bank OTP when createPayment is sync. */
    let releasePayingInFinally = true;

    const verifyAndActivate = async (
      payment: {
        razorpay_order_id: string;
        razorpay_payment_id: string;
        razorpay_signature: string;
      },
      cardFirst4?: string,
    ) => {
      let lastError: unknown;
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          await verifyBillingPayment({
            razorpayOrderId: payment.razorpay_order_id,
            razorpayPaymentId: payment.razorpay_payment_id,
            razorpaySignature: payment.razorpay_signature,
            ...(cardFirst4 ? { cardFirst4 } : {}),
          });
          onPaymentSuccess?.({
            razorpayPaymentId: payment.razorpay_payment_id,
            razorpayOrderId: payment.razorpay_order_id,
          });
          return;
        } catch (error) {
          lastError = error;
          const status = error instanceof ApiError ? error.status : 0;
          const message = error instanceof Error ? error.message : "";
          const retryable =
            status === 400 ||
            status >= 500 ||
            /not captured|try again|network|timeout|502|503/i.test(message);
          if (!retryable || attempt === 4) break;
          await new Promise((r) => window.setTimeout(r, 450 * (attempt + 1)));
        }
      }
      throw lastError instanceof Error
        ? lastError
        : new Error(PAYMENT_FAILED_MESSAGE);
    };

    try {
      if (tab === "upi") {
        if (!paymentContact) {
          throw new Error("Enter a valid 10-digit mobile number.");
        }
        // Always use our custom QR modal — never Razorpay hosted Checkout.
        setUpiQrImageUrl(null);
        setUpiCloseBy(null);
        setUpiModalOpen(true);
        setUpiPoll(null);
        const checkout = await createUpiBillingPayment({
          checkoutSessionId,
          billingDetails: minimalBillingDetails,
          customerContact: paymentContact,
          ...(isTeamPlan ? { seatBreakdown: seatCounts } : {}),
          ...(isBusinessWorkspace
            ? { organizationSeatCount: bundleSeatCount }
            : {}),
        });

        if (!checkout.upi.qrId) {
          throw new Error("UPI QR could not be generated.");
        }
        setUpiCloseBy(
          checkout.upi.closeBy ?? Math.floor(Date.now() / 1000) + 20 * 60,
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
        const prefetched = prefetchedOrderRef.current;
        const contact = paymentContact;
        const email = auth.user?.email?.trim();
        if (!bank || !isActivatedNetbankingBank(bank)) {
          throw new Error("Select a supported bank to continue.");
        }
        if (!contact) {
          throw new Error("Enter a valid 10-digit mobile number.");
        }
        if (!email) {
          throw new Error("Email is required to complete netbanking payment.");
        }
        if (
          !prefetched ||
          !prefetched.fingerprint.startsWith(`${sessionFingerprint}::`) ||
          !isRazorpayCustomScriptReady()
        ) {
          throw new Error(
            "Secure bank payment is still preparing. Please wait a moment and try again.",
          );
        }

        const orderSnapshot = prefetched;
        prefetchedOrderRef.current = null;

        // Return to this checkout page after bank auth (success → onPaymentSuccess).
        const checkoutReturn = (() => {
          const url = new URL(window.location.href);
          url.searchParams.delete("checkout");
          return `${url.pathname}${url.search}`;
        })();
        const callbackUrl = `${window.location.origin}/api/v1/billing/orders/razorpay-callback?return=${encodeURIComponent(checkoutReturn)}`;

        // Sync createPayment + redirect:true — same-tab bank page (no popup hang).
        releasePayingInFinally = false;
        startNetbankingWithRazorpayCustom({
          keyId: orderSnapshot.keyId,
          orderId: orderSnapshot.orderId,
          amount: orderSnapshot.amount,
          currency: orderSnapshot.currency,
          bank,
          email,
          contact,
          callbackUrl,
          description: details.name,
          onSuccess: () => undefined,
        });
        return;
      }

      if (tab === "saved") {
        throw new Error(
          "Saved payment methods will charge on the next update. Use Card or UPI to pay now.",
        );
      }

      // Apple Pay express still uses Standard Checkout (wallet UI).
      if (options?.walletExpress) {
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
          name: "Shirova",
          description: details.name,
          paymentMethod: "card",
          expressCheckout: "apple_pay",
          prefill: {
            name: billingDetails.billToName ?? billingDetails.fullName,
            email: auth.user?.email ?? undefined,
          },
          onSuccess: async (payment) => {
            await verifyAndActivate(
              payment,
              cardFields.cardNumber.replace(/\D/g, "").slice(0, 4),
            );
          },
          onDismiss: () => {
            setPayError(PAYMENT_FAILED_MESSAGE);
          },
        });
        return;
      }

      // Card tab: sync createPayment in this click turn (order was prefetched).
      const prefetched = prefetchedOrderRef.current;
      const email = auth.user?.email?.trim();
      if (
        !prefetched ||
        !prefetched.fingerprint.startsWith(`${sessionFingerprint}::card::`) ||
        !isRazorpayCustomScriptReady()
      ) {
        throw new Error(
          "Secure card payment is still preparing. Please wait a moment and try again.",
        );
      }
      if (!email) {
        throw new Error("Email is required to complete card payment.");
      }
      if (!paymentContact) {
        throw new Error("Enter a valid 10-digit mobile number.");
      }

      const orderSnapshot = prefetched;
      prefetchedOrderRef.current = null;
      const cardFirst4 = cardFields.cardNumber.replace(/\D/g, "").slice(0, 4);
      releasePayingInFinally = false;

      startCardWithRazorpayCustom({
        keyId: orderSnapshot.keyId,
        orderId: orderSnapshot.orderId,
        amount: orderSnapshot.amount,
        currency: orderSnapshot.currency,
        email,
        contact: paymentContact,
        description: details.name,
        card: {
          number: cardFields.cardNumber,
          name: billingDetails.billToName ?? billingDetails.fullName,
          expiry: cardFields.cardExpiry,
          cvc: cardFields.cardCvc,
        },
        onSuccess: async (payment) => {
          try {
            await verifyAndActivate(payment, cardFirst4);
          } catch (error) {
            const message =
              error instanceof Error ? error.message : PAYMENT_FAILED_MESSAGE;
            setPayError(message);
            prefetchedOrderRef.current = null;
            setPrefetchedOrderReady(false);
            setOrderPrepKey((key) => key + 1);
          } finally {
            setPaying(false);
          }
        },
        onFailure: (message) => {
          setPayError(message || PAYMENT_FAILED_MESSAGE);
          prefetchedOrderRef.current = null;
          setPrefetchedOrderReady(false);
          setOrderPrepKey((key) => key + 1);
          setPaying(false);
        },
      });
    } catch (error) {
      if (tab === "upi") {
        setUpiModalOpen(false);
        setUpiQrImageUrl(null);
        setUpiPoll(null);
        setPaying(false);
      }
      if (tab === "netbanking" || tab === "card") {
        setPaying(false);
        // Allow a fresh prefetched order after a failed / cancelled attempt.
        prefetchedOrderRef.current = null;
        setPrefetchedOrderReady(false);
        setOrderPrepKey((key) => key + 1);
      }
      const message =
        error instanceof Error ? error.message : PAYMENT_FAILED_MESSAGE;
      setPayError(
        message === "Request failed."
          ? "UPI checkout could not start. Razorpay keys may be missing or QR Codes may not be enabled on your Razorpay account."
          : message,
      );
    } finally {
      // UPI keeps paying until modal closes; card/netbanking until OTP handlers finish.
      if (tab !== "upi" && releasePayingInFinally) {
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

  const billingCycleToggle =
    !isMaxPlan && !isVariableCheckoutPlan && !isGiftCheckout && (
    <div className="grid grid-cols-2 gap-2 sm:gap-3">
      <button
        type="button"
        onClick={() => setBillingCycle("monthly")}
        aria-pressed={effectiveBillingCycle === "monthly"}
        className={cn(
          "no-hover-overlay flex cursor-pointer flex-col items-start rounded-[var(--settings-card-radius)] px-3.5 py-3 text-left text-[13px] leading-[18px] transition-[background-color,box-shadow,transform] shadow-[var(--settings-card-shadow)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--settings-fg)]/25",
          effectiveBillingCycle === "monthly"
            ? "bg-[color-mix(in_oklab,var(--settings-card-bg)_96%,var(--settings-fg))] ring-1 ring-[var(--settings-fg)] shadow-[0_3px_10px_rgba(24,24,27,0.10)]"
            : "bg-[var(--settings-card-bg)] hover:bg-[color-mix(in_oklab,var(--settings-card-bg)_94%,var(--settings-fg))]",
        )}
      >
        <div className="mb-3 flex w-full items-center justify-between">
          <div
            className={cn(
              "flex h-5 w-5 items-center justify-center rounded-full border-2",
              effectiveBillingCycle === "monthly"
                ? "border-[var(--settings-fg)]"
                : "border-[var(--settings-input-border)]",
            )}
          >
            {effectiveBillingCycle === "monthly" && (
              <div className="h-2 w-2 rounded-full bg-[var(--settings-fg)]" />
            )}
          </div>
        </div>
        <span className="max-w-[75%] text-left font-medium text-[var(--settings-fg)]">Monthly</span>
        <span className="app-page-muted mt-1 text-left">
          {isTeamPlan || isBusinessWorkspace
            ? "Billed monthly per seat"
            : `${formatInr(details.monthly)}/month`}
        </span>
      </button>

      <button
        type="button"
        onClick={() => setBillingCycle("yearly")}
        disabled={orgPlan ? !orgPlan.yearlySupported : false}
        aria-pressed={effectiveBillingCycle === "yearly"}
        className={cn(
          "no-hover-overlay flex cursor-pointer flex-col items-start rounded-[var(--settings-card-radius)] px-3.5 py-3 text-left text-[13px] leading-[18px] transition-[background-color,box-shadow,transform] shadow-[var(--settings-card-shadow)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--settings-fg)]/25",
          effectiveBillingCycle === "yearly"
            ? "bg-[color-mix(in_oklab,var(--settings-card-bg)_96%,var(--settings-fg))] ring-1 ring-[var(--settings-fg)] shadow-[0_3px_10px_rgba(24,24,27,0.10)]"
            : "bg-[var(--settings-card-bg)] hover:bg-[color-mix(in_oklab,var(--settings-card-bg)_94%,var(--settings-fg))]",
          orgPlan &&
            !orgPlan.yearlySupported &&
            "cursor-not-allowed opacity-50",
        )}
      >
        <div className="mb-3 flex w-full items-center justify-between">
          <div
            className={cn(
              "flex h-5 w-5 items-center justify-center rounded-full border-2",
              effectiveBillingCycle === "yearly"
                ? "border-[var(--settings-fg)]"
                : "border-[var(--settings-input-border)]",
            )}
          >
            {effectiveBillingCycle === "yearly" && (
              <div className="h-2 w-2 rounded-full bg-[var(--settings-fg)]" />
            )}
          </div>
          {(orgPlan?.yearlySupported ?? details.yearly > 0) && (
            <div className="rounded-[4px] bg-[color-mix(in_oklab,#18181b_6%,transparent)] px-2 py-0.5 text-[11px] font-medium leading-4 text-[var(--settings-fg-muted)]">
              Save {YEARLY_DISCOUNT_PERCENT}%
            </div>
          )}
        </div>
        <span className="max-w-[75%] text-left font-medium text-[var(--settings-fg)]">Yearly</span>
        <span className="app-page-muted mt-1 text-left">
          {isTeamPlan || isBusinessWorkspace
            ? `Save ${YEARLY_DISCOUNT_PERCENT}% billed annually`
            : `${formatInr(details.yearly)}/year`}
        </span>
      </button>
    </div>
  );

  const maxTierToggle = isMaxPlan && (
    <div className="grid grid-cols-2 gap-2 sm:gap-3">
      {(
        Object.entries(MAX_TIER_OPTIONS) as Array<
          [MaxTier, (typeof MAX_TIER_OPTIONS)[MaxTier]]
        >
      ).map(([tier, tierDetails]) => (
        <button
          key={tier}
          type="button"
          onClick={() => setMaxTier(tier)}
          aria-pressed={maxTier === tier}
          className={cn(
            "no-hover-overlay flex cursor-pointer flex-col items-start rounded-[var(--settings-card-radius)] px-3.5 py-3 text-left text-[13px] leading-[18px] transition-[background-color,box-shadow,transform] shadow-[var(--settings-card-shadow)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--settings-fg)]/25",
            maxTier === tier
              ? "bg-[color-mix(in_oklab,var(--settings-card-bg)_96%,var(--settings-fg))] ring-1 ring-[var(--settings-fg)] shadow-[0_3px_10px_rgba(24,24,27,0.10)]"
              : "bg-[var(--settings-card-bg)] hover:bg-[color-mix(in_oklab,var(--settings-card-bg)_94%,var(--settings-fg))]",
          )}
        >
          <div className="mb-3 flex w-full items-center justify-between">
            <div
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded-full border-2",
                maxTier === tier
                  ? "border-[var(--settings-fg)]"
                  : "border-[var(--settings-input-border)]",
              )}
            >
              {maxTier === tier && (
                <div className="h-2 w-2 rounded-full bg-[var(--settings-fg)]" />
              )}
            </div>
            {tierDetails.badge && (
              <div className="rounded-[4px] bg-[color-mix(in_oklab,#18181b_6%,transparent)] px-2 py-0.5 text-[11px] font-medium leading-4 text-[var(--settings-fg-muted)]">
                {tierDetails.badge}
              </div>
            )}
          </div>
          <span className="max-w-[75%] text-left font-medium text-[var(--settings-fg)]">
            {tierDetails.usageLabel}
          </span>
          <span className="app-page-muted mt-1 text-left">
            {formatInr(tierDetails.monthlyPriceInr)}/month
          </span>
        </button>
      ))}
    </div>
  );

  const teamSeatConfigurator = isTeamPlan && orgPlan && (
    <div className="settings-card px-3.5 py-3">
      <p className="mb-1 text-[11px] font-medium leading-4 text-[var(--settings-fg-muted)]">
        {orgPlan.userRangeLabel}
      </p>
      <p className="mb-3 text-[11px] font-medium leading-4 text-[var(--settings-fg-muted)]">
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
              {index > 0 && <div className="my-2.5 border-t border-[var(--settings-hairline)]" />}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <span className="text-[12px] font-medium leading-4 text-[var(--settings-fg)]">
                    {seat.label}
                  </span>
                  <div className="mt-1 flex flex-wrap items-baseline gap-1">
                    {display.strikethrough != null && (
                      <span className="text-[11px] text-[var(--settings-fg-muted)] line-through">
                        ₹{display.strikethrough.toLocaleString("en-IN")}
                      </span>
                    )}
                    <span className="text-[13px] font-medium leading-4 text-[var(--settings-fg)]">
                      ₹{display.amount.toLocaleString("en-IN")}
                      <span className="text-[11px] font-medium text-[var(--settings-fg-muted)]">
                        /mo
                      </span>
                    </span>
                  </div>
                  <p className="mt-0.5 max-w-[200px] text-[10px] leading-[14px] text-[var(--settings-fg-muted)]">
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
    <div className="settings-card px-3.5 py-3">
      <p className="mb-1 text-[11px] font-medium leading-4 text-[var(--settings-fg-muted)]">
        {orgPlan.userRangeLabel}
      </p>
      <p className="mb-3 text-[11px] font-medium leading-4 text-[var(--settings-fg-muted)]">
        Min {minSeats} seats · per seat
      </p>
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="text-[12px] font-medium leading-4 text-[var(--settings-fg)]">
            Business seat
          </span>
          <div className="mt-1 flex flex-wrap items-baseline gap-1">
            {orgPlan.bundleSeatMonthlyStrikethroughInr != null && (
              <span className="text-[11px] text-[var(--settings-fg-muted)] line-through">
                ₹
                {orgPlan.bundleSeatMonthlyStrikethroughInr.toLocaleString(
                  "en-IN",
                )}
              </span>
            )}
            {(() => {
              const display = getOrganizationSeatDisplayPrice(
                orgPlan.bundleSeatMonthlyInr ??
                  BUSINESS_WORKSPACE_SEAT_MONTHLY_INR,
                effectiveBillingCycle,
                orgPlan.yearlySupported,
              );
              return (
                <span className="text-[13px] font-medium leading-4 text-[var(--settings-fg)]">
                  ₹{display.amount.toLocaleString("en-IN")}
                  <span className="text-[11px] font-medium text-[var(--settings-fg-muted)]">
                    /mo
                  </span>
                </span>
              );
            })()}
          </div>
          <p className="mt-0.5 max-w-[200px] text-[10px] leading-[14px] text-[var(--settings-fg-muted)]">
            Clauxen & Collabry bundle for every seat
          </p>
        </div>
        <SeatStepper
          count={bundleSeatCount}
          canDecrement={bundleSeatCount > minSeats}
          canIncrement={bundleSeatCount < (orgPlan.maxSeats ?? 500)}
          onDecrement={() =>
            setBundleSeatCount((n) => Math.max(minSeats, n - 1))
          }
          onIncrement={() =>
            setBundleSeatCount((n) => Math.min(orgPlan.maxSeats ?? 500, n + 1))
          }
        />
      </div>
    </div>
  );

  const variablePlanNotice = isVariableCheckoutPlan && (
    <div className="settings-card px-3.5 py-3 settings-muted">
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
    !auth.loading && sessionReminted && Boolean(checkoutSessionId) && ready;

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
    <div className="app-surface-shell settings-canvas relative w-full font-sans text-[var(--settings-fg)]">
      <button
        type="button"
        onClick={onBack}
        className="ui-icon-button absolute left-4 top-[max(1rem,env(safe-area-inset-top))] z-20 text-[var(--settings-fg)] transition-colors hover:bg-[var(--ui-hover-wash)] sm:left-6"
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
        <main className="mx-auto flex w-full max-w-[1120px] flex-col items-start gap-7 px-4 pb-28 pt-[max(4.5rem,calc(env(safe-area-inset-top)+3.25rem))] sm:gap-8 sm:px-6 lg:flex-row lg:gap-10">
          {/* Left column — plan summary */}
          <aside className="w-full shrink-0 self-start lg:sticky lg:top-6 lg:w-[400px]">
            <div className="mb-5 px-1">
              <div className="mb-2 inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--settings-fg-muted)]">
                <ShieldCheck className="h-4 w-4" aria-hidden />
                Secure checkout
              </div>
              <h1 className="app-page-title">Complete your purchase</h1>
              <p className="app-page-subtitle mt-1.5">
                Review your plan, then choose a payment method.
              </p>
            </div>

            <div className="flex flex-col gap-4">
              <div className="rounded-[var(--settings-card-radius)] border border-[var(--settings-hairline)] bg-[color-mix(in_oklab,var(--settings-card-bg)_94%,var(--settings-fg))] px-4 py-3.5 shadow-[var(--settings-card-shadow)]">
                <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--settings-fg-muted)]">
                  Selected plan
                </p>
                <div className="mt-1 flex items-baseline justify-between gap-3">
                  <span className="text-[18px] font-semibold tracking-[-0.02em] text-[var(--settings-fg)]">
                    {details.name}
                  </span>
                  {!isVariableCheckoutPlan && (
                    <span className="text-[13px] font-medium text-[var(--settings-fg-muted)]">
                      {cycleDetailLabel}
                    </span>
                  )}
                </div>
              </div>
              {maxTierToggle}
              {billingCycleToggle}
              {teamSeatConfigurator}
              {businessSeatConfigurator}
              {variablePlanNotice}

              <div className="settings-card flex flex-col gap-3 px-4 py-3.5">
                <div className="text-[12px] font-medium uppercase tracking-[0.04em] text-[var(--settings-fg-muted)]">
                  Order details
                </div>

                {orderLineItems.map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between text-[13px] leading-[18px]"
                  >
                    <div className="flex flex-col">
                      <span className="font-medium text-[var(--settings-fg)]">{item.label}</span>
                      <span className="text-[var(--settings-fg-muted)]">{item.sublabel}</span>
                    </div>
                    <span className="font-medium text-[var(--settings-fg)]">
                      {isVariableCheckoutPlan
                        ? isUsageCodePlan
                          ? "Usage pricing"
                          : "Custom quote"
                        : formatInr(item.amount)}
                    </span>
                  </div>
                ))}

                <div className="h-px w-full bg-[var(--settings-hairline)]" />

                <div className="flex items-center justify-between text-[13px] font-medium leading-[18px]">
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
                  <div className="flex items-center justify-between text-[13px] font-medium leading-[18px]">
                    <span>{taxResult.taxLabel ?? "Tax"}</span>
                    <span>
                      {taxResult.isGstExempt ? formatInr(0) : formatInr(tax)}
                    </span>
                  </div>
                )}
                {taxResult.taxNote && (
                  <p className="settings-muted text-[12px]">
                    {taxResult.taxNote}
                  </p>
                )}
                <div className="h-px w-full bg-[var(--settings-hairline)]" />
                <div className="flex items-center justify-between text-[13px] font-medium leading-[18px] text-[var(--settings-fg)]">
                  <span>Total due today</span>
                  <span>
                    {isVariableCheckoutPlan ? formatInr(0) : formatInr(total)}
                  </span>
                </div>
              </div>

              <div className="settings-card flex gap-3 px-3.5 py-3">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--settings-fg-muted)]" />
                <p className="settings-muted">
                  {isGiftCheckout ? (
                    <>
                      Gift subscription for{" "}
                      <span className="font-semibold">
                        {giftMonths === 1
                          ? "1 month"
                          : `${giftMonths ?? 0} months`}
                      </span>{" "}
                      of {details.name.replace(/ plan$/i, "")}. It will not
                      auto-renew. Unredeemed gifts expire one year after
                      purchase. You will be charged{" "}
                      <span className="font-semibold">
                        {formatInr(total)} today
                        {taxResult.showTaxRow && !taxResult.isGstExempt
                          ? " including applicable tax"
                          : ""}
                      </span>
                      .
                    </>
                  ) : isVariableCheckoutPlan ? (
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
          <div className="app-page-card box-border min-w-0 w-full flex-1 rounded-[var(--radius-md)] px-5 py-5 shadow-[0_10px_32px_-24px_rgba(24,24,27,0.38)] sm:px-6 sm:py-6">
            <div className="mb-5 flex items-start justify-between gap-4 border-b border-[var(--settings-hairline)] pb-4">
              <div>
                <h2 className="app-page-section-title">Payment details</h2>
                <p className="app-page-muted mt-1">Your payment information is encrypted and secure.</p>
              </div>
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[var(--settings-fg-muted)]" aria-hidden />
            </div>
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
                if (
                  (paymentTab !== "netbanking" && paymentTab !== "card") ||
                  isUsd
                ) {
                  return;
                }
                const keyId =
                  prefetchedOrderRef.current?.keyId ||
                  process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID?.trim();
                if (keyId) {
                  void warmRazorpayCustomCheckout(keyId).then((ok) => {
                    if (ok || isRazorpayCustomScriptReady()) {
                      setRazorpayScriptReady(true);
                    }
                  });
                } else {
                  void loadRazorpayCustomScript().then((ok) => {
                    if (ok) setRazorpayScriptReady(true);
                  });
                }
              }}
              paymentMobile={paymentMobile}
              onPaymentMobileChange={setPaymentMobile}
              onCardFieldsChange={handleCardFieldsChange}
              onNetbankingChange={handleNetbankingFieldsChange}
              billingAddress={billingAddress}
              onBillingAddressChange={(next) => {
                setBillingAddress(next);
                if (!next.isComplete) setBillingAddressCollapsed(false);
              }}
              billingAddressCollapsed={billingAddressCollapsed}
              onEditBillingAddress={() => setBillingAddressCollapsed(false)}
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
