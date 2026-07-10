"use client";

import * as React from "react";
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Info,
  Plus,
} from "lucide-react";
import { cn } from "@/frontend/lib/utils";
import type { MaxTier } from "@/frontend/components/billing-checkout";
import {
  CHECKOUT_PLAN_IDS,
  ORGANIZATION_PLANS,
  PERSONAL_PLANS,
  YEARLY_DISCOUNT_PERCENT,
  getOrganizationSeatDisplayPrice,
  getPlanPriceInr,
  getYearlyPriceInr,
  resolvePlanFeatures,
  type BillingCycle,
  type OrganizationPlanCard,
  type PlanCard,
} from "@/lib/plans-catalog";

interface UpgradePageContentProps {
  onClose: () => void;
  onSelectPlan: (
    planId: string,
    billingCycle: BillingCycle,
    maxTier?: MaxTier,
    planDisplayName?: string,
  ) => void;
}

const CARD_SHADOW =
  "shadow-[0_0_1.072px_rgba(0,0,0,0.4),0_2px_4px_rgba(0,0,0,0.04)]";

function PlanBadge({
  label,
  variant,
}: {
  label: string;
  variant: "popular" | "special" | "recommended";
}) {
  return (
    <div
      className={cn(
        "absolute right-0 top-[-6px] flex h-6 items-center rounded-full px-2.5 text-[12px] font-medium",
        (variant === "popular" ||
          variant === "special" ||
          variant === "recommended") &&
          "bg-zinc-900 text-white",
      )}
    >
      {label}
    </div>
  );
}

function getPriceDisplay(
  plan: PlanCard,
  billingCycle: BillingCycle,
  maxTier: MaxTier,
) {
  if (plan.customPriceLabel === "Custom") {
    return {
      main: "Custom",
      suffix: "",
      strikethrough: null as number | null,
      subtext: null as string | null,
    };
  }

  if (plan.id === "max") {
    const price = getPlanPriceInr(plan, "monthly", maxTier) ?? 0;
    return {
      main: price.toLocaleString("en-IN"),
      suffix: "/mo",
      strikethrough: null,
      subtext: "No commitment · Cancel anytime",
    };
  }

  const monthly = plan.monthlyPriceInr ?? 0;
  if (monthly === 0) {
    return { main: "0", suffix: "/mo", strikethrough: null, subtext: null };
  }

  if (billingCycle === "yearly" && plan.yearlySupported) {
    const yearlyTotal = getYearlyPriceInr(monthly);
    const effectiveMonthly = Math.round(yearlyTotal / 12);
    return {
      main: effectiveMonthly.toLocaleString("en-IN"),
      suffix: "/mo",
      strikethrough: monthly,
      subtext: "billed annually",
    };
  }

  return {
    main: monthly.toLocaleString("en-IN"),
    suffix: "/mo",
    strikethrough: null,
    subtext: billingCycle === "monthly" ? "billed monthly" : null,
  };
}

function PlanCarouselCard({
  plan,
  billingCycle,
  maxTier,
  onMaxTierChange,
  onSelect,
  ctaLabel,
  forceSelectable = false,
}: {
  plan: PlanCard;
  billingCycle: BillingCycle;
  maxTier: MaxTier;
  onMaxTierChange?: (tier: MaxTier) => void;
  onSelect: () => void;
  ctaLabel?: string;
  /** When true, treat isCurrent plans as selectable (onboarding Free). */
  forceSelectable?: boolean;
}) {
  const features = resolvePlanFeatures(plan, { maxTier });
  const price = getPriceDisplay(plan, billingCycle, maxTier);
  const isCurrent = plan.isCurrent && !forceSelectable;
  const isMax = plan.id === "max";

  return (
    <div
      className={cn(
        "flex w-[240px] shrink-0 flex-col isolate rounded-xl",
        CARD_SHADOW,
      )}
    >
      <div className="relative z-[2] rounded-t-xl bg-white px-5 pb-5 pt-[26px]">
        {plan.isPopular && <PlanBadge label="Popular" variant="popular" />}
        {plan.isSpecialOffer && (
          <PlanBadge label="Special Offer" variant="special" />
        )}

        <div className="flex flex-col gap-4">
          <div className="relative flex flex-col gap-4">
            <div className="flex items-start justify-between gap-2">
              <span className="text-[15px] font-medium leading-[15px]">
                {plan.name}
              </span>
              {isMax && (
                <div className="flex rounded-[10px] bg-black/[0.043] p-0.5">
                  {(["5x", "20x"] as const).map((tier) => (
                    <button
                      key={tier}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onMaxTierChange?.(tier);
                      }}
                      className={cn(
                        "rounded-lg px-2.5 py-1 text-[12px] font-medium transition-all",
                        maxTier === tier
                          ? "bg-white shadow-sm"
                          : "text-zinc-500 hover:text-zinc-900",
                      )}
                    >
                      {tier}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <p className="text-[13px] text-zinc-600">{plan.subtitle}</p>

            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-1.5">
                {price.strikethrough != null && (
                  <span className="text-[13px] font-medium text-zinc-500 line-through">
                    ₹{price.strikethrough.toLocaleString("en-IN")}
                  </span>
                )}
                <div className="flex items-baseline gap-0.5">
                  <p className="text-[24px] font-semibold leading-[27px] tracking-[-0.24px]">
                    {plan.customPriceLabel === "From" && !isMax ? "From " : ""}
                    {plan.customPriceLabel !== "Custom" ? "₹" : ""}
                    {price.main}
                  </p>
                  {price.suffix && (
                    <span className="text-[13px] font-medium text-zinc-500">
                      {price.suffix}
                    </span>
                  )}
                </div>
              </div>
              <div className="h-5">
                {price.subtext && (
                  <p className="text-[12px] leading-4 text-zinc-500">
                    {price.subtext}
                  </p>
                )}
              </div>
            </div>
          </div>

          {isCurrent ? (
            <button
              type="button"
              disabled
              className="flex h-9 w-full cursor-default items-center justify-center rounded-[10px] border-2 border-black/10 text-[14px] font-medium text-zinc-300"
            >
              <Check className="mr-1.5 h-[18px] w-[18px]" />
              Current plan
            </button>
          ) : (
            <button
              type="button"
              onClick={onSelect}
              className={cn(
                "flex h-9 w-full items-center justify-center rounded-[10px] text-[14px] font-medium transition-colors",
                plan.isPopular
                  ? "bg-zinc-900 text-white hover:bg-zinc-800"
                  : "border-2 border-black/10 bg-white text-zinc-900 hover:bg-zinc-50",
              )}
            >
              {ctaLabel ??
                (forceSelectable && plan.id === "free"
                  ? "Continue with Free"
                  : plan.buttonLabel)}
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3.5 rounded-b-xl bg-black/[0.02] px-4 py-4 pb-5">
        {plan.highlight && (
          <div className="flex items-start gap-0.5">
            <Plus className="mt-0.5 h-[18px] w-[18px] shrink-0 text-zinc-500" />
            <p className="text-[13px] font-medium leading-[19.5px] text-zinc-500">
              {plan.highlight}
            </p>
          </div>
        )}
        {features.map((feature) => (
          <div key={feature} className="flex items-start gap-0.5">
            <Check
              className="mt-0.5 h-[18px] w-[18px] shrink-0 text-zinc-900"
              strokeWidth={1.5}
            />
            <p className="text-[13px] leading-[19.5px] text-zinc-900">
              {feature}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function OrganizationPlanCarouselCard({
  plan,
  billingCycle,
  onSelect,
  ctaLabel,
}: {
  plan: OrganizationPlanCard;
  billingCycle: BillingCycle;
  onSelect: () => void;
  ctaLabel?: string;
}) {
  const cycle =
    plan.yearlySupported && billingCycle === "yearly" ? "yearly" : "monthly";
  const isPrimaryCta =
    plan.isRecommended || plan.isSpecialOffer || plan.isHighlight;

  const displayName = plan.nameAccent
    ? `${plan.name} ${plan.nameAccent}`
    : plan.name;

  return (
    <div
      className={cn(
        "flex w-[240px] shrink-0 flex-col isolate rounded-xl",
        CARD_SHADOW,
      )}
    >
      <div className="relative z-[2] rounded-t-xl bg-white px-5 pb-5 pt-[26px]">
        {plan.isRecommended && (
          <PlanBadge label="Recommended" variant="recommended" />
        )}
        {plan.isSpecialOffer && (
          <PlanBadge label="Special Offer" variant="special" />
        )}

        <div className="flex flex-col gap-4">
          <div className="relative flex flex-col gap-4">
            <span className="text-[15px] font-medium leading-[15px]">
              {displayName}
            </span>

            <p className="text-[13px] text-zinc-600">{plan.subtitle}</p>

            <div className="rounded-lg bg-black/[0.04] p-3">
              <p className="mb-2.5 text-[11px] font-medium leading-4 text-zinc-500">
                {plan.userRangeLabel}
              </p>

              {plan.pricingModel === "per-seat" && plan.seatOptions && (
                <div className="flex flex-col">
                  <p className="mb-2.5 text-[11px] font-medium leading-4 text-zinc-600">
                    Min {plan.minSeats} seats · configure each seat separately
                  </p>
                  {plan.seatOptions.map((seat, index) => {
                    const display = getOrganizationSeatDisplayPrice(
                      seat.monthlyPriceInr,
                      cycle,
                      plan.yearlySupported,
                    );
                    return (
                      <div key={seat.id}>
                        {index > 0 && (
                          <div className="my-2.5 border-t border-black/10" />
                        )}
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-[12px] font-medium leading-4 text-zinc-900">
                            {seat.label}
                          </span>
                          <div className="shrink-0 text-right">
                            <div className="flex items-baseline justify-end gap-1">
                              {display.strikethrough != null && (
                                <span className="text-[11px] text-zinc-500 line-through">
                                  ₹
                                  {display.strikethrough.toLocaleString(
                                    "en-IN",
                                  )}
                                </span>
                              )}
                              <span className="text-[13px] font-semibold leading-4 text-zinc-900">
                                ₹{display.amount.toLocaleString("en-IN")}
                                <span className="text-[11px] font-medium text-zinc-500">
                                  /mo
                                </span>
                              </span>
                            </div>
                            {seat.note && (
                              <p className="mt-0.5 max-w-[118px] text-[10px] leading-[14px] text-zinc-500">
                                {seat.note}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {plan.pricingModel === "bundle-seat" &&
                plan.bundleSeatMonthlyInr != null && (
                  <div className="flex flex-col gap-1">
                    <p className="text-[11px] font-medium leading-4 text-zinc-600">
                      Min {plan.minSeats} seats · per seat
                    </p>
                    <div className="flex flex-wrap items-baseline gap-1">
                      {plan.bundleSeatMonthlyStrikethroughInr != null && (
                        <span className="text-[11px] text-zinc-500 line-through">
                          ₹
                          {plan.bundleSeatMonthlyStrikethroughInr.toLocaleString(
                            "en-IN",
                          )}
                        </span>
                      )}
                      {(() => {
                        const display = getOrganizationSeatDisplayPrice(
                          plan.bundleSeatMonthlyInr,
                          cycle,
                          plan.yearlySupported,
                        );
                        return (
                          <>
                            <span className="text-[18px] font-semibold leading-6 tracking-[-0.18px] text-zinc-900">
                              ₹{display.amount.toLocaleString("en-IN")}
                            </span>
                            <span className="text-[11px] font-medium text-zinc-500">
                              / seat / mo
                            </span>
                          </>
                        );
                      })()}
                    </div>
                    {cycle === "yearly" && (
                      <p className="text-[10px] leading-4 text-zinc-500">
                        Billed annually · {YEARLY_DISCOUNT_PERCENT}% off vs
                        monthly
                      </p>
                    )}
                  </div>
                )}

              {plan.pricingModel === "usage" && (
                <div className="flex flex-col gap-1">
                  <p className="text-[11px] font-medium leading-4 text-zinc-600">
                    Min {plan.minSeats} members
                  </p>
                  <p className="text-[18px] font-semibold leading-6 tracking-[-0.18px] text-zinc-900">
                    {plan.usagePricingLabel}
                  </p>
                  {plan.usagePricingSubtext && (
                    <p className="text-[10px] leading-4 text-zinc-500">
                      {plan.usagePricingSubtext}
                    </p>
                  )}
                </div>
              )}

              {plan.pricingModel === "seat-plus-usage" && (
                <div className="flex flex-col gap-2">
                  <p className="text-[11px] font-medium leading-4 text-zinc-600">
                    Min {plan.minSeats} seats · pooled usage
                  </p>
                  <p className="text-[15px] font-semibold leading-5 text-zinc-900">
                    {plan.usagePricingLabel}
                  </p>
                  {plan.usagePricingSubtext && (
                    <p className="text-[10px] leading-4 text-zinc-500">
                      {plan.usagePricingSubtext}
                    </p>
                  )}
                  {plan.seatOptions && (
                    <div className="border-t border-black/10 pt-2">
                      <p className="mb-1.5 text-[10px] font-medium leading-4 text-zinc-500">
                        Per-seat personal tier (Plus, Pro, or Max):
                      </p>
                      {plan.seatOptions.slice(0, 2).map((seat) => (
                        <p
                          key={seat.id}
                          className="text-[10px] leading-4 text-zinc-600"
                        >
                          {seat.label}: ₹
                          {seat.monthlyPriceInr.toLocaleString("en-IN")}/mo
                        </p>
                      ))}
                      <p className="text-[10px] leading-4 text-zinc-500">
                        + Max 5x & Max 20x seats available
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="h-0" />
          </div>

          <button
            type="button"
            onClick={onSelect}
            className={cn(
              "flex h-9 w-full items-center justify-center rounded-[10px] text-[14px] font-medium transition-colors",
              isPrimaryCta
                ? "bg-zinc-900 text-white hover:bg-zinc-800"
                : "border-2 border-black/10 bg-white text-zinc-900 hover:bg-zinc-50",
            )}
          >
            {ctaLabel ?? plan.buttonLabel}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3.5 rounded-b-xl bg-black/[0.02] px-4 py-4 pb-5">
        {plan.highlight && (
          <div className="flex items-start gap-0.5">
            <Plus className="mt-0.5 h-[18px] w-[18px] shrink-0 text-zinc-500" />
            <p className="text-[13px] font-medium leading-[19.5px] text-zinc-500">
              {plan.highlight}
            </p>
          </div>
        )}
        {plan.features.map((feature) => (
          <div key={feature} className="flex items-start gap-0.5">
            <Check
              className="mt-0.5 h-[18px] w-[18px] shrink-0 text-zinc-900"
              strokeWidth={1.5}
            />
            <p className="text-[13px] leading-[19.5px] text-zinc-900">
              {feature}
            </p>
          </div>
        ))}
        {plan.footerNote && (
          <p className="text-[11px] leading-4 text-zinc-500">
            {plan.footerNote}
          </p>
        )}
      </div>
    </div>
  );
}

export type PlansCarouselSectionProps = {
  /** `tabs` switches individual vs team; `all` shows every plan in one row */
  layout?: "tabs" | "all";
  ctaLabel?: string;
  onPersonalPlanSelect?: (
    plan: PlanCard,
    cycle: BillingCycle,
    tier?: MaxTier,
    displayName?: string,
  ) => void;
  onOrganizationPlanSelect?: (
    plan: OrganizationPlanCard,
    cycle: BillingCycle,
    displayName?: string,
  ) => void;
  /** When set, every plan CTA invokes this instead of the select handlers */
  onCtaClick?: () => void;
  /** Plan ids that stay selectable even when marked `isCurrent` (e.g. Free in onboarding). */
  selectableCurrentPlanIds?: string[];
  className?: string;
};

export function PlansCarouselSection({
  layout = "tabs",
  ctaLabel,
  onPersonalPlanSelect,
  onOrganizationPlanSelect,
  onCtaClick,
  selectableCurrentPlanIds,
  className,
}: PlansCarouselSectionProps) {
  const [activeTab, setActiveTab] = React.useState<"individual" | "team">(
    "individual",
  );
  const [billingCycle, setBillingCycle] = React.useState<BillingCycle>("monthly");
  const [maxTier, setMaxTier] = React.useState<MaxTier>("5x");
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = React.useState(false);
  const [canScrollRight, setCanScrollRight] = React.useState(true);

  const updateScrollButtons = React.useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollButtons();
    el.addEventListener("scroll", updateScrollButtons, { passive: true });
    window.addEventListener("resize", updateScrollButtons);
    return () => {
      el.removeEventListener("scroll", updateScrollButtons);
      window.removeEventListener("resize", updateScrollButtons);
    };
  }, [activeTab, layout, updateScrollButtons]);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ left: 0 });
    updateScrollButtons();
  }, [activeTab, layout, updateScrollButtons]);

  const scrollBy = (direction: "left" | "right") => {
    scrollRef.current?.scrollBy({
      left: direction === "left" ? -280 : 280,
      behavior: "smooth",
    });
  };

  const handlePersonalSelect = (plan: PlanCard) => {
    if (onCtaClick) {
      onCtaClick();
      return;
    }
    const cycle =
      plan.yearlySupported && billingCycle === "yearly" && plan.id !== "max"
        ? "yearly"
        : "monthly";
    const tier = plan.id === "max" ? maxTier : undefined;
    onPersonalPlanSelect?.(plan, cycle, tier, plan.name);
  };

  const handleOrganizationSelect = (plan: OrganizationPlanCard) => {
    if (onCtaClick) {
      onCtaClick();
      return;
    }
    const cycle =
      plan.yearlySupported && billingCycle === "yearly" ? "yearly" : "monthly";
    onOrganizationPlanSelect?.(plan, cycle, plan.name);
  };

  const showIndividual =
    layout === "all" || activeTab === "individual";
  const showOrganization =
    layout === "all" || activeTab === "team";

  return (
    <div className={cn("flex flex-col gap-3 sm:gap-4", className)}>
      <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
        {layout === "tabs" ? (
          <div className="rounded-[10px] bg-black/[0.043] p-0.5">
            <button
              type="button"
              onClick={() => setActiveTab("individual")}
              className={cn(
                "rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all",
                activeTab === "individual"
                  ? "bg-white shadow-sm"
                  : "text-zinc-500 hover:text-zinc-900",
              )}
            >
              Individual
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("team")}
              className={cn(
                "rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all",
                activeTab === "team"
                  ? "bg-white shadow-sm"
                  : "text-zinc-500 hover:text-zinc-900",
              )}
            >
              Team & Enterprise
            </button>
          </div>
        ) : null}

        <div className="rounded-[10px] bg-black/[0.043] p-0.5">
          <button
            type="button"
            onClick={() => setBillingCycle("monthly")}
            className={cn(
              "rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all",
              billingCycle === "monthly"
                ? "bg-white shadow-sm"
                : "text-zinc-500 hover:text-zinc-900",
            )}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setBillingCycle("yearly")}
            className={cn(
              "rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all",
              billingCycle === "yearly"
                ? "bg-white shadow-sm"
                : "text-zinc-500 hover:text-zinc-900",
            )}
          >
            Yearly (save {YEARLY_DISCOUNT_PERCENT}%)
          </button>
        </div>

        <div className="flex items-center justify-end gap-2 sm:ml-auto sm:gap-3">
          <button
            type="button"
            aria-label="Scroll left"
            disabled={!canScrollLeft}
            onClick={() => scrollBy("left")}
            className={cn(
              "flex rounded-full p-1.5 shadow-sm transition-opacity",
              canScrollLeft
                ? "bg-white hover:bg-zinc-50"
                : "cursor-default bg-white opacity-30",
              CARD_SHADOW,
            )}
          >
            <ChevronLeft className="h-[18px] w-[18px]" />
          </button>
          <button
            type="button"
            aria-label="Scroll right"
            disabled={!canScrollRight}
            onClick={() => scrollBy("right")}
            className={cn(
              "flex rounded-full p-1.5 shadow-sm transition-opacity",
              canScrollRight
                ? "bg-white hover:bg-zinc-50"
                : "cursor-default bg-white opacity-30",
              CARD_SHADOW,
            )}
          >
            <ChevronRight className="h-[18px] w-[18px]" />
          </button>
        </div>
      </div>

      <div className="relative -mx-4 overflow-hidden">
        <div
          ref={scrollRef}
          className="flex items-start gap-5 overflow-x-auto px-7 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{
            maskImage:
              "linear-gradient(90deg, transparent 0%, black 50px, black calc(100% - 50px), transparent 100%)",
          }}
        >
          {showIndividual
            ? PERSONAL_PLANS.map((plan) => (
                <PlanCarouselCard
                  key={plan.id}
                  plan={plan}
                  billingCycle={billingCycle}
                  maxTier={maxTier}
                  onMaxTierChange={
                    plan.id === "max" ? setMaxTier : undefined
                  }
                  onSelect={() => handlePersonalSelect(plan)}
                  ctaLabel={ctaLabel}
                  forceSelectable={selectableCurrentPlanIds?.includes(plan.id)}
                />
              ))
            : null}

          {showOrganization
            ? ORGANIZATION_PLANS.map((plan) => (
                <OrganizationPlanCarouselCard
                  key={plan.id}
                  plan={plan}
                  billingCycle={billingCycle}
                  onSelect={() => handleOrganizationSelect(plan)}
                  ctaLabel={ctaLabel}
                />
              ))
            : null}
        </div>
      </div>

      {layout === "tabs" && activeTab === "team" ? (
        <div className="flex items-center gap-2 rounded-xl border border-black/10 bg-zinc-50 p-3 text-[13px] text-zinc-600">
          <Info className="h-4 w-4 shrink-0" />
          <span>
            Work email required. Each seat can be Plus, Pro, Max 5x, or Max 20x
            — Go is not available on organization plans. Minimum seats: Team 2 ·
            Business 4 · Enterprise 10.
          </span>
        </div>
      ) : null}
    </div>
  );
}

export default function UpgradePageContent({
  onClose,
  onSelectPlan,
}: UpgradePageContentProps) {
  const handlePersonalPlanSelection = (
    plan: PlanCard,
    cycle: BillingCycle,
    tier?: MaxTier,
  ) => {
    if (plan.isCurrent || !CHECKOUT_PLAN_IDS.has(plan.id)) return;
    onSelectPlan(plan.id, cycle, tier, plan.name);
  };

  const handleOrganizationPlanSelection = (
    plan: OrganizationPlanCard,
    cycle: BillingCycle,
  ) => {
    if (!CHECKOUT_PLAN_IDS.has(plan.id)) return;
    onSelectPlan(plan.id, cycle, undefined, plan.name);
  };

  const handlePlaceholderLinkClick = (
    event: React.MouseEvent<HTMLAnchorElement>,
  ) => {
    event.preventDefault();
  };

  return (
    <div className="h-full w-full overflow-y-auto bg-white font-sans text-zinc-900">
      <header className="sticky top-0 z-20 flex items-center justify-center border-b border-black/5 bg-white/90 px-12 py-3.5 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-md sm:py-4">
        <button
          onClick={onClose}
          className="absolute left-3 top-1/2 -translate-y-1/2 rounded-lg p-2 transition-colors hover:bg-zinc-100 sm:left-4"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="max-w-[min(100%,14rem)] truncate text-center text-[17px] font-medium tracking-[-0.1px] sm:max-w-none sm:text-[20px]">
          Plans that grow with you
        </h1>
      </header>

      <main className="mobile-page-inset mx-auto flex w-full max-w-[1152px] flex-col gap-5 py-5 pb-24 sm:gap-6 sm:py-6 lg:px-6">
        <PlansCarouselSection
          layout="tabs"
          onPersonalPlanSelect={handlePersonalPlanSelection}
          onOrganizationPlanSelect={handleOrganizationPlanSelection}
        />

        <p className="text-center text-[13px] text-zinc-500">
          *
          <a
            href="#"
            onClick={handlePlaceholderLinkClick}
            className="underline underline-offset-4 decoration-zinc-400/40 hover:text-zinc-900"
          >
            Usage limits apply
          </a>
          . Prices shown don&apos;t include applicable tax. Plans and pricing
          are subject to change at Shirova&apos;s discretion.
        </p>
      </main>
    </div>
  );
}

export { PlanCarouselCard, OrganizationPlanCarouselCard };
