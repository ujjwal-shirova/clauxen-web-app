"use client";

import * as React from "react";
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  subscriptionSegmentClass,
  subscriptionSegmentTrackClass,
} from "@/lib/segmented-control";
import type { MaxTier } from "@/components/billing-checkout";
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
  /** Active subscription plan id (e.g. go, plus). Drives "Current plan" CTAs. */
  currentPlanId?: string | null;
}

const PLAN_RANK: Record<string, number> = {
  free: 0,
  go: 1,
  plus: 2,
  pro: 3,
  max: 4,
};

function normalizePlanId(planId: string | null | undefined): string {
  if (!planId) return "free";
  const normalized = planId.replace(/_/g, "").toLowerCase();
  if (normalized in PLAN_RANK) return normalized;
  const known = Object.keys(PLAN_RANK).find((id) => normalized.startsWith(id));
  return known ?? "free";
}

function PlanBadge({
  label,
}: {
  label: string;
  variant: "popular" | "special" | "recommended";
}) {
  return (
    <div className="absolute right-3 top-3 flex h-6 items-center rounded-full bg-[var(--pricing-cta)] px-2.5 text-[12px] font-medium text-[var(--pricing-cta-fg)]">
      {label}
    </div>
  );
}

function PricingCtaButton({
  children,
  onClick,
  disabled,
  variant = "primary",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "current";
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex w-full items-center justify-center rounded-full px-[21.6px] py-3 text-[13px] font-medium leading-4 transition-colors",
        variant === "primary" &&
          "bg-[var(--pricing-cta)] text-[var(--pricing-cta-fg)] hover:opacity-90",
        variant === "secondary" &&
          "bg-[var(--pricing-cta-secondary)] text-[var(--pricing-fg)] hover:opacity-90",
        variant === "current" &&
          "cursor-default bg-[var(--pricing-cta-secondary)] text-[var(--pricing-muted)]",
      )}
    >
      {children}
    </button>
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
  currentPlanId = "free",
}: {
  plan: PlanCard;
  billingCycle: BillingCycle;
  maxTier: MaxTier;
  onMaxTierChange?: (tier: MaxTier) => void;
  onSelect: () => void;
  ctaLabel?: string;
  /** When true, treat isCurrent plans as selectable (onboarding Free). */
  forceSelectable?: boolean;
  currentPlanId?: string;
}) {
  const features = resolvePlanFeatures(plan, { maxTier });
  const price = getPriceDisplay(plan, billingCycle, maxTier);
  const activeId = normalizePlanId(currentPlanId);
  const isCurrent =
    !forceSelectable && normalizePlanId(plan.id) === activeId;
  const isLowerThanCurrent =
    !forceSelectable &&
    (PLAN_RANK[normalizePlanId(plan.id)] ?? 0) < (PLAN_RANK[activeId] ?? 0);
  const isMax = plan.id === "max";

  return (
    <div className="relative flex w-[240px] shrink-0 flex-col justify-between rounded-xl bg-[var(--pricing-card)] px-[15px] pb-[15px] pt-[13px]">
      {plan.isPopular && <PlanBadge label="Popular" variant="popular" />}
      {plan.isSpecialOffer && (
        <PlanBadge label="Special Offer" variant="special" />
      )}

      <div className="flex flex-col">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-[22px] font-normal leading-[1.3] tracking-[-0.11px] text-[var(--pricing-fg)]">
            {plan.name}
          </h3>
        </div>

        <p className="mt-0.5 flex items-baseline gap-0.5 text-[22px] leading-[1.3] tracking-[-0.11px] text-[var(--pricing-muted)]">
          {price.strikethrough != null && (
            <span className="mr-1.5 text-[14px] line-through">
              ₹{price.strikethrough.toLocaleString("en-IN")}
            </span>
          )}
          <span>
            {plan.customPriceLabel === "From" && !isMax ? "From " : ""}
            {plan.customPriceLabel !== "Custom" ? "₹" : ""}
            {price.main}
          </span>
          {price.suffix && (
            <span className="text-[14px] leading-5">{price.suffix}</span>
          )}
        </p>

        <div className="mt-1 min-h-5">
          {plan.subtitle ? (
            <p className="text-[13px] leading-[18px] text-[var(--pricing-muted)]">
              {plan.subtitle}
            </p>
          ) : price.subtext ? (
            <p className="text-[12px] leading-4 text-[var(--pricing-muted)]">
              {price.subtext}
            </p>
          ) : null}
        </div>

        <div className="mt-4 flex min-h-[38px] items-center">
          {isMax ? (
            <div
              className={cn(
                subscriptionSegmentTrackClass,
                "bg-[var(--pricing-thumb)]",
              )}
            >
              {(["5x", "20x"] as const).map((tier) => (
                <button
                  key={tier}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onMaxTierChange?.(tier);
                  }}
                  className={cn(
                    "relative z-[1] rounded-full px-3 py-1 text-[12px] font-medium leading-4 transition-colors",
                    maxTier === tier
                      ? "bg-[var(--pricing-thumb-active)] text-[var(--pricing-fg)]"
                      : "text-[var(--pricing-muted)] hover:text-[var(--pricing-fg)]",
                  )}
                >
                  {tier}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {plan.highlight ? (
          <p className="mt-4 text-[13px] text-[var(--pricing-muted)]">
            {plan.highlight}
          </p>
        ) : (
          <p className="mt-4 text-[13px] text-[var(--pricing-muted)]">Includes:</p>
        )}

        <ul className="mt-4 flex flex-col gap-[3.7px]" role="list">
          {features.map((feature) => (
            <li key={feature} className="flex gap-[7.5px] text-[13px] leading-[18px] text-[var(--pricing-fg)]">
              <span className="shrink-0 text-[var(--pricing-fg)]" aria-hidden>
                ✓
              </span>
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-8">
        {isCurrent ? (
          <PricingCtaButton disabled variant="current">
            <Check className="mr-1.5 h-4 w-4" />
            Current plan
          </PricingCtaButton>
        ) : isLowerThanCurrent ? null : (
          <PricingCtaButton
            onClick={onSelect}
            variant={plan.isPopular ? "primary" : "secondary"}
          >
            {ctaLabel ??
              (forceSelectable && plan.id === "free"
                ? "Continue with Free"
                : plan.buttonLabel)}
          </PricingCtaButton>
        )}
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
    <div className="relative flex w-[240px] shrink-0 flex-col justify-between rounded-xl bg-[var(--pricing-card)] px-[15px] pb-[15px] pt-[13px]">
      {plan.isRecommended && (
        <PlanBadge label="Recommended" variant="recommended" />
      )}
      {plan.isSpecialOffer && (
        <PlanBadge label="Special Offer" variant="special" />
      )}

      <div className="flex flex-col">
        <h3 className="text-[22px] font-normal leading-[1.3] tracking-[-0.11px] text-[var(--pricing-fg)]">
          {displayName}
        </h3>

        <p className="mt-0.5 text-[13px] leading-[18px] text-[var(--pricing-muted)]">
          {plan.subtitle}
        </p>

        <div className="mt-4 rounded-lg bg-[var(--pricing-thumb)]/70 p-3">
          <p className="mb-2.5 text-[11px] font-medium leading-4 text-[var(--pricing-muted)]">
            {plan.userRangeLabel}
          </p>

          {plan.pricingModel === "per-seat" && plan.seatOptions && (
            <div className="flex flex-col">
              <p className="mb-2.5 text-[11px] font-medium leading-4 text-[var(--pricing-muted)]">
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
                      <div className="my-2.5 border-t border-[var(--pricing-fg)]/10" />
                    )}
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[12px] font-medium leading-4 text-[var(--pricing-fg)]">
                        {seat.label}
                      </span>
                      <div className="shrink-0 text-right">
                        <div className="flex items-baseline justify-end gap-1">
                          {display.strikethrough != null && (
                            <span className="text-[11px] text-[var(--pricing-muted)] line-through">
                              ₹
                              {display.strikethrough.toLocaleString("en-IN")}
                            </span>
                          )}
                          <span className="text-[13px] font-semibold leading-4 text-[var(--pricing-fg)]">
                            ₹{display.amount.toLocaleString("en-IN")}
                            <span className="text-[11px] font-medium text-[var(--pricing-muted)]">
                              /mo
                            </span>
                          </span>
                        </div>
                        {seat.note && (
                          <p className="mt-0.5 max-w-[118px] text-[10px] leading-[14px] text-[var(--pricing-muted)]">
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
                <p className="text-[11px] font-medium leading-4 text-[var(--pricing-muted)]">
                  Min {plan.minSeats} seats · per seat
                </p>
                <div className="flex flex-wrap items-baseline gap-1">
                  {plan.bundleSeatMonthlyStrikethroughInr != null && (
                    <span className="text-[11px] text-[var(--pricing-muted)] line-through">
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
                        <span className="text-[15px] font-medium text-[var(--pricing-fg)]">
                          ₹{display.amount.toLocaleString("en-IN")}
                        </span>
                        <span className="text-[11px] font-medium text-[var(--pricing-muted)]">
                          / seat / mo
                        </span>
                      </>
                    );
                  })()}
                </div>
                {cycle === "yearly" && (
                  <p className="text-[10px] leading-4 text-[var(--pricing-muted)]">
                    Billed annually · {YEARLY_DISCOUNT_PERCENT}% off vs monthly
                  </p>
                )}
              </div>
            )}

          {plan.pricingModel === "usage" && (
            <div className="flex flex-col gap-1">
              <p className="text-[11px] font-medium leading-4 text-[var(--pricing-muted)]">
                Min {plan.minSeats} members
              </p>
              <p className="text-[15px] font-medium text-[var(--pricing-fg)]">
                {plan.usagePricingLabel}
              </p>
              {plan.usagePricingSubtext && (
                <p className="text-[10px] leading-4 text-[var(--pricing-muted)]">
                  {plan.usagePricingSubtext}
                </p>
              )}
            </div>
          )}

          {plan.pricingModel === "seat-plus-usage" && (
            <div className="flex flex-col gap-2">
              <p className="text-[11px] font-medium leading-4 text-[var(--pricing-muted)]">
                Min {plan.minSeats} seats · pooled usage
              </p>
              <p className="text-[15px] font-medium text-[var(--pricing-fg)]">
                {plan.usagePricingLabel}
              </p>
              {plan.usagePricingSubtext && (
                <p className="text-[10px] leading-4 text-[var(--pricing-muted)]">
                  {plan.usagePricingSubtext}
                </p>
              )}
              {plan.seatOptions && (
                <div className="border-t border-[var(--pricing-fg)]/10 pt-2">
                  <p className="mb-1.5 text-[10px] font-medium leading-4 text-[var(--pricing-muted)]">
                    Per-seat personal tier (Plus, Pro, or Max):
                  </p>
                  {plan.seatOptions.slice(0, 2).map((seat) => (
                    <p
                      key={seat.id}
                      className="text-[10px] leading-4 text-[var(--pricing-muted)]"
                    >
                      {seat.label}: ₹
                      {seat.monthlyPriceInr.toLocaleString("en-IN")}/mo
                    </p>
                  ))}
                  <p className="text-[10px] leading-4 text-[var(--pricing-muted)]">
                    + Max 5x & Max 20x seats available
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-4 min-h-[38px]" />

        {plan.highlight ? (
          <p className="mt-4 text-[13px] text-[var(--pricing-muted)]">
            {plan.highlight}
          </p>
        ) : (
          <p className="mt-4 text-[13px] text-[var(--pricing-muted)]">Includes:</p>
        )}

        <ul className="mt-4 flex flex-col gap-[3.7px]" role="list">
          {plan.features.map((feature) => (
            <li
              key={feature}
              className="flex gap-[7.5px] text-[13px] leading-[18px] text-[var(--pricing-fg)]"
            >
              <span className="shrink-0" aria-hidden>
                ✓
              </span>
              <span>{feature}</span>
            </li>
          ))}
        </ul>

        {plan.footerNote && (
          <p className="mt-3 text-[11px] leading-4 text-[var(--pricing-muted)]">
            {plan.footerNote}
          </p>
        )}
      </div>

      <div className="mt-8">
        <PricingCtaButton
          onClick={onSelect}
          variant={isPrimaryCta ? "primary" : "secondary"}
        >
          {ctaLabel ?? plan.buttonLabel}
        </PricingCtaButton>
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
  /** Active subscription plan id for Current plan / hide lower-tier CTAs. */
  currentPlanId?: string | null;
  className?: string;
};

export function PlansCarouselSection({
  layout = "tabs",
  ctaLabel,
  onPersonalPlanSelect,
  onOrganizationPlanSelect,
  onCtaClick,
  selectableCurrentPlanIds,
  currentPlanId = "free",
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
          <div className={subscriptionSegmentTrackClass}>
            <button
              type="button"
              onClick={() => setActiveTab("individual")}
              className={cn(
                subscriptionSegmentClass(activeTab === "individual"),
                activeTab === "individual" &&
                  "bg-[var(--pricing-thumb)]",
              )}
            >
              Individual
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("team")}
              className={cn(
                subscriptionSegmentClass(activeTab === "team"),
                activeTab === "team" && "bg-[var(--pricing-thumb)]",
              )}
            >
              Team & Enterprise
            </button>
          </div>
        ) : null}

        <div className={subscriptionSegmentTrackClass}>
          <button
            type="button"
            onClick={() => setBillingCycle("monthly")}
            className={cn(
              subscriptionSegmentClass(billingCycle === "monthly"),
              billingCycle === "monthly" && "bg-[var(--pricing-thumb)]",
            )}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setBillingCycle("yearly")}
            className={cn(
              subscriptionSegmentClass(billingCycle === "yearly"),
              billingCycle === "yearly" && "bg-[var(--pricing-thumb)]",
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
              "flex rounded-full bg-[var(--pricing-card)] p-1.5 transition-opacity",
              canScrollLeft
                ? "text-[var(--pricing-fg)] hover:bg-[var(--pricing-thumb)]"
                : "cursor-default text-[var(--pricing-muted)] opacity-40",
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
              "flex rounded-full bg-[var(--pricing-card)] p-1.5 transition-opacity",
              canScrollRight
                ? "text-[var(--pricing-fg)] hover:bg-[var(--pricing-thumb)]"
                : "cursor-default text-[var(--pricing-muted)] opacity-40",
            )}
          >
            <ChevronRight className="h-[18px] w-[18px]" />
          </button>
        </div>
      </div>

      <div className="relative -mx-4 overflow-hidden">
        <div
          ref={scrollRef}
          className="flex items-stretch gap-2.5 overflow-x-auto px-7 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
                  currentPlanId={normalizePlanId(currentPlanId)}
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
        <div className="flex items-center gap-2 rounded-xl bg-[var(--pricing-card)] p-3 text-[13px] text-[var(--pricing-muted)]">
          <Info className="h-4 w-4 shrink-0 text-[var(--pricing-fg)]" />
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
  currentPlanId = "free",
}: UpgradePageContentProps) {
  const activePlanId = normalizePlanId(currentPlanId);

  const handlePersonalPlanSelection = (
    plan: PlanCard,
    cycle: BillingCycle,
    tier?: MaxTier,
  ) => {
    if (!CHECKOUT_PLAN_IDS.has(plan.id)) return;
    if (normalizePlanId(plan.id) === activePlanId) return;
    if ((PLAN_RANK[normalizePlanId(plan.id)] ?? 0) < (PLAN_RANK[activePlanId] ?? 0)) {
      return;
    }
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
    <div className="h-full w-full overflow-y-auto bg-[var(--pricing-bg)] font-sans text-[var(--pricing-fg)]">
      <header className="sticky top-0 z-20 flex items-center justify-center border-b border-[var(--pricing-fg)]/[0.06] bg-[var(--pricing-bg)]/95 px-12 py-3.5 pt-[max(0.75rem,env(safe-area-inset-top))] sm:py-4">
        <button
          onClick={onClose}
          className="absolute left-3 top-1/2 -translate-y-1/2 rounded-lg p-2 transition-colors hover:bg-[var(--pricing-card)] sm:left-4"
          aria-label="Back"
        >
          <ArrowLeft className="icon-lg" />
        </button>
        <h1 className="max-w-[min(100%,14rem)] truncate text-center text-[22px] font-normal leading-[1.3] tracking-[-0.11px] text-[var(--pricing-fg)] sm:max-w-none sm:text-[28px] sm:tracking-[-0.4px]">
          Plans that grow with you
        </h1>
      </header>

      <main className="mobile-page-inset mx-auto flex w-full max-w-[1152px] flex-col gap-5 py-5 pb-24 sm:gap-6 sm:py-6 lg:px-6">
        <PlansCarouselSection
          layout="tabs"
          currentPlanId={activePlanId}
          onPersonalPlanSelect={handlePersonalPlanSelection}
          onOrganizationPlanSelect={handleOrganizationPlanSelection}
        />

        <p className="text-center text-[13px] text-[var(--pricing-muted)]">
          *
          <a
            href="#"
            onClick={handlePlaceholderLinkClick}
            className="underline underline-offset-4 decoration-[var(--pricing-fg)]/25 hover:text-[var(--pricing-fg)]"
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
