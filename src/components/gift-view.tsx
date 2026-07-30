"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Link as LinkIcon, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
  const auth = useAuth();
  const { currency, usdInrRate } = useCheckoutCurrency();
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedPlan, setSelectedPlan] = useState<GiftPlanId>("plus");
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

  const previewTints = useMemo(() => {
    const base = selectedColor.value;
    return {
      waveA: `color-mix(in srgb, ${base} 88%, white)`,
      waveB: `color-mix(in srgb, ${base} 62%, white)`,
      waveC: `color-mix(in srgb, ${base} 45%, black)`,
      glow: `color-mix(in srgb, ${base} 35%, transparent)`,
    };
  }, [selectedColor.value]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      <div className="fixed inset-0 z-[200] flex flex-col overflow-hidden bg-[var(--app-shell-bg)] pt-[env(safe-area-inset-top)] font-sans lg:flex-row lg:pt-0">
        <button
          type="button"
          onClick={handleBack}
          className="absolute left-3 top-[max(0.75rem,env(safe-area-inset-top))] z-[110] rounded-lg p-2 transition-all hover:bg-zinc-100/80 sm:left-6 sm:top-6"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5 text-zinc-800" />
        </button>

        <div
          className="app-scrollbar relative min-h-0 flex-[1.6] overflow-y-auto border-b border-black/5 bg-[var(--app-shell-bg)] lg:border-b-0 lg:border-r lg:border-black/5"
          data-scroll-region=""
          tabIndex={0}
        >
          <div className="mobile-page-inset mx-auto flex min-h-full max-w-[512px] flex-col justify-center pb-8 pt-14 sm:px-8 sm:py-24 lg:pt-16">
            {step === 1 && (
              <div className="animate-in fade-in slide-in-from-left-4 duration-500">
                <h1 className="mb-2 font-serif text-[30px] font-medium leading-[1.3] text-zinc-800 sm:text-[38px] sm:leading-[1.4]">
                  Give the gift of Clauxen
                </h1>
                <p className="mb-10 text-[16px] font-[430] leading-relaxed text-zinc-600">
                  Every plan includes Clauxen Code, unlimited projects, and
                  access to our latest models.
                </p>

                <div className="mb-8">
                  <span className="mb-3 block text-[14px] font-semibold text-zinc-800">
                    Which plan?
                  </span>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {plans.map((plan) => (
                      <button
                        key={plan.id}
                        type="button"
                        onClick={() => setSelectedPlan(plan.id)}
                        className={cn(
                          "rounded-xl border p-4 text-left transition-all duration-200 outline-none",
                          selectedPlan === plan.id
                            ? "border-zinc-900 bg-white shadow-sm ring-1 ring-zinc-900"
                            : "border-black/10 bg-white/60 hover:border-black/25",
                        )}
                      >
                        <div className="text-[14px] font-semibold text-zinc-800">
                          {plan.name}
                        </div>
                        <div className="mt-1 text-[14px] font-[430] leading-tight text-zinc-500">
                          {plan.subtitle}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mb-8">
                  <span className="mb-3 block text-[14px] font-semibold text-zinc-800">
                    How many months?
                  </span>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {durations.map((duration) => (
                      <button
                        key={duration.id}
                        type="button"
                        onClick={() => setSelectedDuration(duration.id)}
                        className={cn(
                          "rounded-xl border px-2 py-3 text-center transition-all duration-200 outline-none",
                          selectedDuration === duration.id
                            ? "border-zinc-900 bg-white shadow-sm ring-1 ring-zinc-900"
                            : "border-black/10 bg-white/60 hover:border-black/25",
                        )}
                      >
                        <div className="text-[14px] font-semibold text-zinc-800">
                          {duration.label}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mb-10">
                  <span className="mb-1 block text-[14px] font-semibold text-zinc-800">
                    Total
                  </span>
                  <div className="text-[24px] font-bold text-zinc-800">
                    {formatCheckoutAmountFromPaise(
                      total * 100,
                      currency,
                      usdInrRate,
                    )}
                  </div>
                </div>

                <div className="flex justify-end border-t border-black/5 pt-4">
                  <Button
                    type="button"
                    onClick={() => setStep(2)}
                    className={cn(appBtn.primaryLgAuto, "px-8")}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                <h1 className="mb-6 font-serif text-[28px] font-medium text-zinc-800">
                  Personalize your gift
                </h1>

                <div className="mb-8">
                  <span className="mb-3 block text-[14px] font-semibold text-zinc-800">
                    Pick a color
                  </span>
                  <div className="flex flex-wrap gap-3">
                    {colors.map((color) => (
                      <button
                        key={color.id}
                        type="button"
                        onClick={() => setSelectedColor(color)}
                        className={cn(
                          "no-hover-overlay flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all",
                          selectedColor.id === color.id
                            ? "border-zinc-900 ring-2 ring-zinc-900/20"
                            : "border-transparent",
                        )}
                        style={{ backgroundColor: color.value }}
                        aria-label={color.label}
                      >
                        {selectedColor.id === color.id && (
                          <Check
                            className={cn(
                              "h-4 w-4",
                              isLightSwatch(color.id)
                                ? "text-zinc-900"
                                : "text-white",
                            )}
                          />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mb-8">
                  <span className="mb-3 block text-[14px] font-semibold text-zinc-800">
                    Choose how to send
                  </span>
                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={() => setDeliveryMethod("email")}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-all",
                        deliveryMethod === "email"
                          ? "border-zinc-900 bg-white ring-1 ring-zinc-900/10"
                          : "border-black/10 bg-white/60 hover:border-black/25",
                      )}
                    >
                      <Mail className="h-5 w-5 text-zinc-500" />
                      <div className="flex-1 text-[14px] font-semibold">
                        Send an email
                      </div>
                      {deliveryMethod === "email" && (
                        <div className="h-2.5 w-2.5 rounded-full bg-zinc-900" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeliveryMethod("link")}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-all",
                        deliveryMethod === "link"
                          ? "border-zinc-900 bg-white ring-1 ring-zinc-900/10"
                          : "border-black/10 bg-white/60 hover:border-black/25",
                      )}
                    >
                      <LinkIcon className="h-5 w-5 text-zinc-500" />
                      <div className="flex-1 text-[14px] font-semibold">
                        Get a link to share
                      </div>
                      {deliveryMethod === "link" && (
                        <div className="h-2.5 w-2.5 rounded-full bg-zinc-900" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="mb-10 space-y-4">
                  {deliveryMethod === "email" && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[14px] font-medium text-zinc-800">
                          Recipient&apos;s name
                        </label>
                        <input
                          type="text"
                          placeholder="Name"
                          value={recipientName}
                          onChange={(e) => setRecipientName(e.target.value)}
                          className="h-10 w-full rounded-lg border border-black/10 bg-white px-3 text-[14px] transition-all focus:outline-none focus:ring-2 focus:ring-black/10"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[14px] font-medium text-zinc-800">
                          Recipient&apos;s email
                        </label>
                        <input
                          type="email"
                          placeholder="Email"
                          value={recipientEmail}
                          onChange={(e) => setRecipientEmail(e.target.value)}
                          className="h-10 w-full rounded-lg border border-black/10 bg-white px-3 text-[14px] transition-all focus:outline-none focus:ring-2 focus:ring-black/10"
                        />
                      </div>
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <label className="text-[14px] font-medium text-zinc-800">
                      Your name
                    </label>
                    <input
                      type="text"
                      value={yourName}
                      onChange={(e) => setYourName(e.target.value)}
                      className="h-10 w-full rounded-lg border border-black/10 bg-white px-3 text-[14px] transition-all focus:outline-none focus:ring-2 focus:ring-black/10"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[14px] font-medium text-zinc-800">
                      Add a note
                      {deliveryMethod === "link" && (
                        <span className="ml-1 font-normal text-zinc-500">
                          (optional)
                        </span>
                      )}
                    </label>
                    <textarea
                      placeholder="Gift message"
                      rows={3}
                      value={giftNote}
                      onChange={(e) => setGiftNote(e.target.value)}
                      className="w-full resize-none rounded-lg border border-black/10 bg-white p-3 text-[14px] transition-all focus:outline-none focus:ring-2 focus:ring-black/10"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[14px] font-medium text-zinc-800">
                      Your email
                    </label>
                    <input
                      type="email"
                      value={yourEmail}
                      onChange={(e) => setYourEmail(e.target.value)}
                      className="h-10 w-full rounded-lg border border-black/10 bg-white px-3 text-[14px] transition-all focus:outline-none focus:ring-2 focus:ring-black/10"
                    />
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2 border-t border-black/5 pt-4">
                  <div className="flex justify-end gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setStep(1)}
                      className={cn(appBtn.secondary, "h-10 rounded-xl px-8")}
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
                      className={cn(appBtn.primaryLgAuto, "px-8")}
                    >
                      {checkoutLoading ? "Preparing…" : "Check out"}
                    </Button>
                  </div>
                  {checkoutError && (
                    <p className="text-[12px] text-red-600">{checkoutError}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-center justify-center bg-zinc-100/80 p-5 sm:p-8 lg:sticky lg:top-0 lg:h-full lg:flex-1">
          <div className="relative flex scale-[0.92] flex-col items-center gap-4 transition-all duration-500 animate-in zoom-in-95 sm:scale-100 lg:scale-[1.25]">
            <div className="relative w-[min(100%,240px)] sm:w-[288px]">
              <div
                className="relative overflow-hidden transition-colors duration-500"
                style={{
                  aspectRatio: "3 / 2",
                  backgroundColor: selectedColor.value,
                  borderRadius: "16px",
                  boxShadow:
                    "inset 0 0 0 1px rgba(255,255,255,0.28), 0 14px 28px -8px rgba(0,0,0,0.22)",
                }}
              >
                <div className="pointer-events-none absolute inset-0 overflow-hidden">
                  <div
                    className="absolute -left-14 top-0 h-28 w-72 rounded-[999px] opacity-80 blur-2xl"
                    style={{
                      background: `linear-gradient(90deg, ${previewTints.waveA} 0%, ${previewTints.waveB} 55%, ${previewTints.glow} 100%)`,
                      transform: "rotate(-14deg)",
                    }}
                  />
                  <div
                    className="absolute -right-16 top-10 h-24 w-72 rounded-[999px] opacity-70 blur-2xl"
                    style={{
                      background: `linear-gradient(90deg, ${previewTints.glow} 0%, ${previewTints.waveA} 52%, ${previewTints.waveB} 100%)`,
                      transform: "rotate(18deg)",
                    }}
                  />
                  <div
                    className="absolute -left-16 bottom-6 h-24 w-80 rounded-[999px] opacity-65 blur-2xl"
                    style={{
                      background: `linear-gradient(90deg, ${previewTints.waveB} 0%, ${previewTints.waveC} 50%, ${previewTints.waveA} 100%)`,
                      transform: "rotate(6deg)",
                    }}
                  />
                  <svg
                    viewBox="0 0 288 192"
                    aria-hidden="true"
                    className="absolute inset-0 h-full w-full opacity-75"
                    preserveAspectRatio="none"
                  >
                    <path
                      d="M-18 58C18 32 58 28 104 42C150 56 194 64 238 46C266 34 286 30 316 40"
                      fill="none"
                      stroke="rgba(255,255,255,0.55)"
                      strokeWidth="14"
                      strokeLinecap="round"
                    />
                    <path
                      d="M-24 92C14 68 52 66 96 80C144 96 190 104 234 88C262 78 286 74 316 82"
                      fill="none"
                      stroke="rgba(255,255,255,0.35)"
                      strokeWidth="10"
                      strokeLinecap="round"
                    />
                    <path
                      d="M-18 132C26 112 70 114 116 126C164 140 208 144 250 128C278 118 298 114 320 120"
                      fill="none"
                      stroke="rgba(0,0,0,0.08)"
                      strokeWidth="12"
                      strokeLinecap="round"
                    />
                  </svg>
                  <div
                    className="absolute inset-0"
                    style={{
                      background: `radial-gradient(circle at 50% 36%, ${previewTints.glow}, transparent 42%)`,
                    }}
                  />
                </div>

                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center">
                  <GiftAnimation />
                  <div className="mt-[6px] text-center">
                    <div className="text-[12px] font-semibold leading-[16.8px] text-zinc-900 drop-shadow-sm">
                      {currentDuration.label} of Clauxen {currentPlan.name}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {(deliveryMethod === "email" || deliveryMethod === "link") &&
              (recipientName || giftNote) && (
                <div className="w-72 animate-in fade-in slide-in-from-top-2 rounded-xl border border-zinc-200/80 bg-white/90 p-4 duration-300 backdrop-blur-sm">
                  {recipientName && (
                    <div className="mb-1 text-[12px] font-semibold text-zinc-900">
                      To: {recipientName}
                    </div>
                  )}
                  {giftNote && (
                    <p className="break-words text-[12px] font-[430] leading-relaxed text-zinc-700">
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
