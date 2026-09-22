"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Link as LinkIcon, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { chrome } from "@/lib/app-chrome";
import { appBtn } from "@/lib/app-buttons";
import { GiftAnimation } from "./gift-animation";
import { FullscreenPortal } from "./fullscreen-portal";
import {
  clearPendingGiftPurchase,
  purchaseGift,
  readPendingGiftPurchase,
  storePendingGiftPurchase,
} from "@/lib/api/gifts";
import { createCheckoutSession } from "@/lib/api/billing";
import { GiftPurchaseSuccessDialog } from "@/components/gift-purchase-success-dialog";
import { useAuth } from "@/hooks/use-auth";
import {
  GIFT_PLAN_IDS,
  GIFT_PLANS,
  type GiftPlanId,
} from "@/lib/plans-catalog";
import { useCheckoutCurrency } from "@/hooks/use-checkout-currency";
import { formatCheckoutAmountFromPaise } from "@/lib/checkout-currency";
import { useOverlaySurfaceFocus } from "@/lib/surface-focus";

interface GiftViewProps {
  onClose: () => void;
}

const colors = [
  { id: "clay", value: "#DD8164", label: "Clay" },
  { id: "sky", value: "#77A3CF", label: "Sky" },
  { id: "olive", value: "#839569", label: "Olive" },
  { id: "fig", value: "#C8728F", label: "Fig" },
  { id: "coral", value: "#EFD9D9", label: "Coral" },
  { id: "cactus", value: "#CBDCD5", label: "Cactus" },
  { id: "heather", value: "#D7D6E1", label: "Heather" },
];

const plans = GIFT_PLANS.map((plan) => ({
  id: plan.id,
  name: plan.name,
  subtitle: plan.subtitle,
  monthlyPrice: plan.monthlyPriceInr,
}));

const durations = [
  { id: "1month", label: "1 month", months: 1 },
  { id: "3months", label: "3 months", months: 3 },
  { id: "6months", label: "6 months", months: 6 },
  { id: "1year", label: "1 year", months: 12 },
];

const GIFT_DURATION_MONTHS = new Set(
  durations.map((duration) => duration.months),
);
const GIFT_COLOR_VALUES = new Set(colors.map((color) => color.value));

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isLightSwatch(colorId: string) {
  return colorId === "coral" || colorId === "cactus" || colorId === "heather";
}

function buildClaimUrl(claimToken?: string, claimUrl?: string) {
  if (claimUrl) return claimUrl;
  if (!claimToken || typeof window === "undefined") return null;
  return `${window.location.origin}/gift/claim/${encodeURIComponent(claimToken)}`;
}

type SuccessState = {
  giftCode: string;
  claimUrl: string | null;
  deliveryMethod: "email" | "link";
  planName: string;
  months: number;
  recipientEmail: string | null;
};

export function GiftView({ onClose }: GiftViewProps) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  useOverlaySurfaceFocus(surfaceRef);
  const auth = useAuth();
  const { currency, usdInrRate } = useCheckoutCurrency();
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedPlan, setSelectedPlan] = useState<GiftPlanId>("pro");
  const [selectedDuration, setSelectedDuration] = useState("6months");
  const [selectedColor, setSelectedColor] = useState(colors[0]);
  const [deliveryMethod, setDeliveryMethod] = useState<"email" | "link">(
    "email",
  );
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [success, setSuccess] = useState<SuccessState | null>(null);
  const [successOpen, setSuccessOpen] = useState(false);

  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [giftNote, setGiftNote] = useState("");
  const [yourName, setYourName] = useState(auth.user?.displayName ?? "");
  const [yourEmail, setYourEmail] = useState(auth.user?.email ?? "");

  const currentPlan = plans.find((p) => p.id === selectedPlan) || plans[0];
  const currentDuration =
    durations.find((d) => d.id === selectedDuration) || durations[2];
  const total = currentPlan.monthlyPrice * currentDuration.months;

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const fromCheckout =
      params.get("giftPurchased") === "1" ||
      (() => {
        try {
          return window.sessionStorage.getItem("clauxen:gift-just-paid") === "1";
        } catch {
          return false;
        }
      })();

    const pending = readPendingGiftPurchase();
    if (!pending && !fromCheckout) return;

    if (pending) {
      setSuccess({
        giftCode: pending.giftCode,
        claimUrl: buildClaimUrl(pending.claimToken, pending.claimUrl),
        deliveryMethod: pending.deliveryMethod,
        planName: pending.planName,
        months: pending.months ?? currentDuration.months,
        recipientEmail: pending.recipientEmail ?? null,
      });
      setSuccessOpen(true);
      clearPendingGiftPurchase();
    }

    try {
      window.sessionStorage.removeItem("clauxen:gift-just-paid");
    } catch {
      /* ignore */
    }

    if (params.get("giftPurchased") === "1") {
      params.delete("giftPurchased");
      params.delete("checkout");
      const search = params.toString();
      const path = window.location.pathname;
      const hash = window.location.hash || "#gift";
      window.history.replaceState(
        window.history.state,
        "",
        `${path}${search ? `?${search}` : ""}${hash}`,
      );
    }

    window.dispatchEvent(new CustomEvent("clauxen:billing-updated"));
    // currentDuration is only used as fallback months for older pending payloads
  }, []);

  const handleBack = () => {
    if (step === 2) setStep(1);
    else onClose();
  };

  const startCheckout = async () => {
    if (
      !GIFT_PLAN_IDS.has(selectedPlan) ||
      !GIFT_DURATION_MONTHS.has(currentDuration.months)
    ) {
      return;
    }
    if (deliveryMethod === "email" && !isValidEmail(recipientEmail.trim())) {
      return;
    }

    setCheckoutError(null);
    setCheckoutLoading(true);
    try {
      const themeColor = GIFT_COLOR_VALUES.has(selectedColor.value)
        ? selectedColor.value
        : colors[0].value;

      const result = await purchaseGift({
        planId: selectedPlan,
        months: currentDuration.months,
        currency,
        recipientEmail:
          deliveryMethod === "email" ? recipientEmail.trim() : undefined,
        recipientName:
          deliveryMethod === "email" ? recipientName.trim() : undefined,
        senderName: yourName || auth.user?.displayName || "Clauxen user",
        senderEmail: yourEmail || auth.user?.email || "",
        deliveryMethod,
        message: giftNote || undefined,
        themeColor,
      });

      const claimUrl = buildClaimUrl(
        result.gift.claimToken,
        result.gift.claimUrl,
      );

      storePendingGiftPurchase({
        giftId: result.gift.id,
        giftCode: result.gift.code,
        claimToken: result.gift.claimToken,
        claimUrl: claimUrl ?? undefined,
        planName: currentPlan.name,
        months: currentDuration.months,
        deliveryMethod,
        recipientEmail:
          deliveryMethod === "email" ? recipientEmail.trim() : undefined,
      });

      const sessionInput = {
        planId: selectedPlan,
        planName: currentPlan.name,
        billingCycle: "monthly" as const,
        currency,
        returnPath: "/new?giftPurchased=1",
        orderKind: "gift" as const,
        giftId: result.gift.id,
        giftMonths: currentDuration.months,
        giftDeliveryMethod: deliveryMethod,
      };

      const session = await createCheckoutSession(sessionInput);
      window.location.href = session.checkoutPath;
    } catch (error) {
      setCheckoutError(
        error instanceof Error ? error.message : "Could not start checkout.",
      );
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleSuccessClose = useCallback(() => {
    setSuccessOpen(false);
    setSuccess(null);
    onClose();
  }, [onClose]);

  return (
    <FullscreenPortal>
      <div ref={surfaceRef} data-app-overlay-surface="" tabIndex={-1} className={cn(chrome.overlay.surface, "bg-[var(--app-frame-bg)] pt-[env(safe-area-inset-top)] font-sans lg:flex-row lg:pt-0")}>
        <button
          type="button"
          onClick={handleBack}
          className="ui-icon-button absolute left-3 top-[max(0.75rem,env(safe-area-inset-top))] z-[110] text-[var(--settings-fg)] transition-colors hover:bg-[var(--ui-hover-wash)] sm:left-6 sm:top-6"
          aria-label="Back"
        >
          <ArrowLeft className="size-[18px]" />
        </button>

        <div
          className="app-scrollbar relative min-h-0 flex-[1.6] overflow-y-auto border-b border-[var(--settings-hairline)] bg-[var(--settings-canvas-bg)] lg:border-b-0 lg:border-r lg:border-[var(--settings-hairline)]"
          data-scroll-region=""
        >
          <div className="mobile-page-inset mx-auto flex min-h-full max-w-[512px] flex-col justify-center pb-8 pt-14 sm:px-8 sm:py-24 lg:pt-16">
            {step === 1 && (
              <div className="animate-in fade-in slide-in-from-left-4 duration-500">
                <h1 className="mb-2 font-serif text-[28px] font-medium leading-[1.3] text-[var(--settings-fg)] sm:text-[34px] sm:leading-[1.35]">
                  Give the gift of Clauxen
                </h1>
                <p className="app-page-muted mb-8">
                  Every plan includes Clauxen Code, unlimited projects, and
                  access to our latest models.
                </p>

                <div className="mb-8">
                  <span className="mb-3 block settings-section-label">
                    Which plan?
                  </span>
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    {plans.map((plan) => (
                      <button
                        key={plan.id}
                        type="button"
                        onClick={() => setSelectedPlan(plan.id)}
                        className={cn(
                          "rounded-[var(--settings-card-radius)] p-3.5 text-left transition-colors duration-150 outline-none shadow-[var(--settings-card-shadow)]",
                          selectedPlan === plan.id
                            ? "bg-[var(--settings-card-bg)] ring-1 ring-[var(--settings-fg)]"
                            : "bg-[var(--settings-card-bg)] hover:bg-[color-mix(in_oklab,var(--settings-card-bg)_92%,#18181b)]",
                        )}
                      >
                        <div className="app-page-body font-medium">
                          {plan.name}
                        </div>
                        <div className="mt-1 app-page-muted">
                          {plan.subtitle}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mb-8">
                  <span className="mb-3 block settings-section-label">
                    How many months?
                  </span>
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                    {durations.map((duration) => (
                      <button
                        key={duration.id}
                        type="button"
                        onClick={() => setSelectedDuration(duration.id)}
                        className={cn(
                          "rounded-[var(--settings-card-radius)] px-2 py-2.5 text-center transition-colors duration-150 outline-none shadow-[var(--settings-card-shadow)]",
                          selectedDuration === duration.id
                            ? "bg-[var(--settings-card-bg)] ring-1 ring-[var(--settings-fg)]"
                            : "bg-[var(--settings-card-bg)] hover:bg-[color-mix(in_oklab,var(--settings-card-bg)_92%,#18181b)]",
                        )}
                      >
                        <div className="app-page-body font-medium">
                          {duration.label}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mb-10">
                  <span className="mb-1 block settings-section-label">
                    Total
                  </span>
                  <div className="app-page-title font-medium">
                    {formatCheckoutAmountFromPaise(
                      total * 100,
                      currency,
                      usdInrRate,
                    )}
                  </div>
                </div>

                <div className="flex justify-end border-t border-[var(--settings-hairline)] pt-4">
                  <Button
                    type="button"
                    onClick={() => setStep(2)}
                    className={cn(appBtn.primaryLgAuto, "px-6")}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                <h1 className="app-page-title mb-5 font-medium">
                  Personalize your gift
                </h1>

                <div className="mb-8">
                  <span className="mb-3 block settings-section-label">
                    Pick a color
                  </span>
                  <div className="flex flex-wrap gap-2.5">
                    {colors.map((color) => (
                      <button
                        key={color.id}
                        type="button"
                        onClick={() => setSelectedColor(color)}
                        className={cn(
                          "no-hover-overlay flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all",
                          selectedColor.id === color.id
                            ? "border-[var(--settings-fg)] ring-2 ring-[color-mix(in_oklab,#18181b_12%,transparent)]"
                            : "border-transparent",
                        )}
                        style={{ backgroundColor: color.value }}
                        aria-label={color.label}
                      >
                        {selectedColor.id === color.id && (
                          <Check
                            className={cn(
                              "h-3.5 w-3.5",
                              isLightSwatch(color.id)
                                ? "text-[var(--settings-fg)]"
                                : "text-white",
                            )}
                          />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mb-8">
                  <span className="mb-3 block settings-section-label">
                    Choose how to send
                  </span>
                  <div className="space-y-2.5">
                    <button
                      type="button"
                      onClick={() => setDeliveryMethod("email")}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-[var(--settings-card-radius)] p-3.5 text-left transition-colors shadow-[var(--settings-card-shadow)]",
                        deliveryMethod === "email"
                          ? "bg-[var(--settings-card-bg)] ring-1 ring-[var(--settings-fg)]"
                          : "bg-[var(--settings-card-bg)] hover:bg-[color-mix(in_oklab,var(--settings-card-bg)_92%,#18181b)]",
                      )}
                    >
                      <Mail className="icon-md text-[var(--settings-fg-muted)]" />
                      <div className="flex-1 app-page-body font-medium">
                        Send an email
                      </div>
                      {deliveryMethod === "email" && (
                        <div className="h-2 w-2 rounded-full bg-[var(--settings-fg)]" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeliveryMethod("link")}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-[var(--settings-card-radius)] p-3.5 text-left transition-colors shadow-[var(--settings-card-shadow)]",
                        deliveryMethod === "link"
                          ? "bg-[var(--settings-card-bg)] ring-1 ring-[var(--settings-fg)]"
                          : "bg-[var(--settings-card-bg)] hover:bg-[color-mix(in_oklab,var(--settings-card-bg)_92%,#18181b)]",
                      )}
                    >
                      <LinkIcon className="icon-md text-[var(--settings-fg-muted)]" />
                      <div className="flex-1 app-page-body font-medium">
                        Get a link to share
                      </div>
                      {deliveryMethod === "link" && (
                        <div className="h-2 w-2 rounded-full bg-[var(--settings-fg)]" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="mb-10 space-y-3.5">
                  {deliveryMethod === "email" && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="app-page-body font-medium">
                          Recipient&apos;s name
                        </label>
                        <input
                          type="text"
                          placeholder="Name"
                          value={recipientName}
                          onChange={(e) => setRecipientName(e.target.value)}
                          className="app-page-search !pl-3 transition-all focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="app-page-body font-medium">
                          Recipient&apos;s email
                        </label>
                        <input
                          type="email"
                          placeholder="Email"
                          value={recipientEmail}
                          onChange={(e) => setRecipientEmail(e.target.value)}
                          className="app-page-search !pl-3 transition-all focus:outline-none"
                        />
                      </div>
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <label className="app-page-body font-medium">
                      Your name
                    </label>
                    <input
                      type="text"
                      value={yourName}
                      onChange={(e) => setYourName(e.target.value)}
                      className="app-page-search !pl-3 transition-all focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="app-page-body font-medium">
                      Add a note
                      {deliveryMethod === "link" && (
                        <span className="ml-1 font-normal text-[var(--settings-fg-muted)]">
                          (optional)
                        </span>
                      )}
                    </label>
                    <textarea
                      placeholder="Gift message"
                      rows={3}
                      value={giftNote}
                      onChange={(e) => setGiftNote(e.target.value)}
                      className="app-field w-full resize-none p-3 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="app-page-body font-medium">
                      Your email
                    </label>
                    <input
                      type="email"
                      value={yourEmail}
                      onChange={(e) => setYourEmail(e.target.value)}
                      className="app-page-search !pl-3 transition-all focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2 border-t border-[var(--settings-hairline)] pt-4">
                  <div className="flex justify-end gap-2.5">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setStep(1)}
                      className={cn(appBtn.secondary, "px-5")}
                    >
                      Back
                    </Button>
                    <Button
                      type="button"
                      onClick={() => void startCheckout()}
                      disabled={
                        checkoutLoading ||
                        (deliveryMethod === "email" &&
                          !isValidEmail(recipientEmail.trim()))
                      }
                      className={cn(appBtn.primaryLgAuto, "px-6")}
                    >
                      {checkoutLoading ? "Preparing…" : "Check out"}
                    </Button>
                  </div>
                  {checkoutError && (
                    <p className="text-[12px] leading-[18px] text-red-600">{checkoutError}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-center justify-center bg-[var(--app-frame-bg)] p-5 sm:p-8 lg:sticky lg:top-0 lg:h-full lg:flex-1">
          <div className="relative flex scale-[0.92] flex-col items-center gap-4 transition-all duration-500 animate-in zoom-in-95 sm:scale-100 lg:scale-[1.2]">
            <div className="relative w-[min(100%,248px)] sm:w-[300px]">
              <div
                className="relative overflow-hidden transition-colors duration-500"
                style={{
                  aspectRatio: "3 / 2",
                  backgroundColor: selectedColor.value,
                  borderRadius: "12px",
                  boxShadow:
                    "0 18px 40px -16px rgba(0,0,0,0.28), inset 0 0 0 1px rgba(255,255,255,0.18)",
                }}
              >
                {/* Soft horizontal wave bands — follow selected color */}
                <div className="pointer-events-none absolute inset-0 overflow-hidden">
                  <svg
                    viewBox="0 0 300 200"
                    aria-hidden="true"
                    className="absolute inset-0 h-full w-full"
                    preserveAspectRatio="none"
                  >
                    <path
                      d="M-20 52C40 28 90 34 150 52C210 70 250 58 320 40"
                      fill="none"
                      stroke="rgba(255,248,240,0.55)"
                      strokeWidth="18"
                      strokeLinecap="round"
                    />
                    <path
                      d="M-20 88C50 64 110 70 170 88C230 106 270 94 320 78"
                      fill="none"
                      stroke="rgba(255,255,255,0.42)"
                      strokeWidth="16"
                      strokeLinecap="round"
                    />
                    <path
                      d="M-20 124C45 104 105 110 165 126C225 142 265 132 320 118"
                      fill="none"
                      stroke="rgba(255,245,235,0.48)"
                      strokeWidth="15"
                      strokeLinecap="round"
                    />
                    <path
                      d="M-20 158C55 140 115 146 175 160C235 174 270 166 320 152"
                      fill="none"
                      stroke="rgba(255,255,255,0.32)"
                      strokeWidth="13"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>

                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2.5 px-4">
                  <GiftAnimation />
                  <div className="text-center">
                    <div className="text-[13px] font-medium leading-[18px] tracking-[-0.01em] text-[var(--settings-fg)]">
                      {currentDuration.label} of Clauxen {currentPlan.name}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {(deliveryMethod === "email" || deliveryMethod === "link") &&
              (recipientName || giftNote) && (
                <div className="w-72 animate-in fade-in slide-in-from-top-2 rounded-[var(--settings-card-radius)] bg-[var(--settings-card-bg)] p-3.5 shadow-[var(--settings-card-shadow)] duration-300">
                  {recipientName && (
                    <div className="mb-1 text-[12px] font-medium leading-[18px] text-[var(--settings-fg)]">
                      To: {recipientName}
                    </div>
                  )}
                  {giftNote && (
                    <p className="break-words text-[12px] leading-[18px] text-[var(--settings-fg-muted)]">
                      {giftNote}
                    </p>
                  )}
                </div>
              )}
          </div>
        </div>
      </div>

      {success && (
        <GiftPurchaseSuccessDialog
          open={successOpen}
          gift={{
            planName: success.planName,
            months: success.months,
            deliveryMethod: success.deliveryMethod,
            claimUrl: success.claimUrl,
            giftCode: success.giftCode,
            recipientEmail: success.recipientEmail,
          }}
          onClose={handleSuccessClose}
        />
      )}
    </FullscreenPortal>
  );
}
