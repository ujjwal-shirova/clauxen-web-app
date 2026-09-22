"use client";

import * as React from "react";
import { ArrowLeft, Check, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { chrome } from "@/lib/app-chrome";
import { appBtn } from "@/lib/app-buttons";
import {
  segmentedOptionClass,
  segmentedTrackClass,
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
  /** Active subscription plan id (pro or max). Drives "Current plan" CTAs. */
  currentPlanId?: string | null;
}

const PLAN_RANK: Record<string, number> = {
  pro: 1,
  max: 2,
};

function normalizePlanId(planId: string | null | undefined): string {
  if (!planId) return "";
  const normalized = planId.replace(/_/g, "").toLowerCase();
  if (normalized === "max5x" || normalized === "max20x") return "max";
  if (normalized in PLAN_RANK) return normalized;
  return "";
}

function PlanBadge({
  label,
  variant,
}: {
  label: string;
  variant: "popular" | "special" | "recommended";
}) {
  if (variant === "recommended") {
    return (
      <span className="inline-flex h-6 items-center rounded-[6px] px-2 text-[11px] font-medium text-[var(--settings-fg)] shadow-[inset_0_0_0_1px_var(--settings-btn-border)]">
        {label}
      </span>
    );
  }

  return (
    <span className="inline-flex h-6 items-center rounded-[6px] bg-[var(--settings-fg)] px-2 text-[11px] font-medium text-[var(--settings-canvas-bg)]">
      {label}
    </span>
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
        "w-full max-sm:min-h-11",
        variant === "primary" && appBtn.primaryLg,
        variant === "secondary" && cn(appBtn.secondary, "h-9 w-full px-4 max-sm:h-11"),
        variant === "current" &&
          cn(appBtn.secondary, "h-9 w-full cursor-default px-4 opacity-70 max-sm:h-11"),
      )}
    >
      {children}
    </button>
  );
}

const FEATURE_PREVIEW_COUNT = 4;

function PlanFeatureList({
  heading,
  features,
}: {
  heading?: string;
  features: string[];
}) {
  const [expanded, setExpanded] = React.useState(false);
  const hiddenCount = Math.max(0, features.length - FEATURE_PREVIEW_COUNT);

  return (
    <div className="mt-5 flex min-h-0 flex-1 flex-col">
      {heading ? (
        <p className="settings-section-label">{heading}</p>
      ) : null}
      <ul className="mt-2.5 flex flex-col gap-1.5" role="list">
        {features.map((feature, index) => (
          <li
            key={feature}
            className={cn(
              "flex gap-2 text-[13px] leading-[18px] text-[var(--settings-fg)]",
              index >= FEATURE_PREVIEW_COUNT && !expanded && "max-sm:hidden",
            )}
          >
            <Check
              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--settings-fg-muted)]"
              strokeWidth={2}
              aria-hidden
            />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      {hiddenCount > 0 ? (
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          className="mt-2 min-h-8 self-start px-0.5 text-[12.5px] font-medium text-zinc-500 sm:hidden"
        >
          {expanded ? "Show less" : `${hiddenCount} more`}
        </button>
      ) : null}
    </div>
  );
}

function PlanCardsScroller({
  resetKey,
  children,
}: {
  resetKey: string;
  children: React.ReactNode;
}) {
  const scrollerRef = React.useRef<HTMLDivElement>(null);
  const items = React.Children.toArray(children);
  const [activeIndex, setActiveIndex] = React.useState(0);

  React.useEffect(() => {
    const node = scrollerRef.current;
    if (!node) return;
    node.scrollTo({ left: 0 });
    setActiveIndex(0);
  }, [resetKey]);

  const onScroll = () => {
    const node = scrollerRef.current;
    if (!node) return;
    const cards = Array.from(node.children) as HTMLElement[];
    if (cards.length === 0) return;
    const midpoint = node.scrollLeft + node.clientWidth / 2;
    let best = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    cards.forEach((card, index) => {
      const center = card.offsetLeft + card.offsetWidth / 2;
      const distance = Math.abs(center - midpoint);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = index;
      }
    });
    setActiveIndex(best);
  };

  const scrollToIndex = (index: number) => {
    const node = scrollerRef.current;
    const card = node?.children[index] as HTMLElement | undefined;
    card?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  };

  return (
    <div>
      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain px-4 pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 xl:grid-cols-3"
      >
        {items.map((child, index) => (
          <div
            key={index}
            className="flex w-[min(calc(100vw-4.25rem),22rem)] shrink-0 snap-center sm:w-auto sm:min-w-0 sm:snap-align-none"
          >
            {child}
          </div>
        ))}
      </div>
      {items.length > 1 ? (
        <div className="mt-3 flex items-center justify-center gap-1.5 sm:hidden">
          {items.map((_, index) => (
            <button
              key={index}
              type="button"
              aria-label={`Show plan ${index + 1}`}
              onClick={() => scrollToIndex(index)}
              className={cn(
                "h-1.5 rounded-full transition-[width,background-color]",
                index === activeIndex
                  ? "w-4 bg-zinc-900"
                  : "w-1.5 bg-zinc-300",
              )}
              aria-current={index === activeIndex ? "true" : undefined}
            />
          ))}
        </div>
      ) : null}
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
  currentPlanId = "",
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
  const isHighlighted = Boolean(plan.isPopular || plan.isRecommended);

  return (
    <article
      className={cn(
        "app-page-card relative flex h-full min-h-0 w-full flex-col p-4",
        isHighlighted && "ring-1 ring-[var(--settings-fg)]",
      )}
    >
      <div className="mb-1 flex items-start justify-between gap-2">
        <h3 className="app-page-title text-[18px] leading-6">{plan.name}</h3>
        {plan.isPopular && <PlanBadge label="Popular" variant="popular" />}
        {plan.isRecommended && (
          <PlanBadge label="Recommended" variant="recommended" />
        )}
        {plan.isSpecialOffer && (
          <PlanBadge label="Special Offer" variant="special" />
        )}
      </div>

      <div className="mt-1 flex items-center justify-between gap-2">
        <p className="flex flex-wrap items-baseline gap-1 text-[22px] font-medium leading-7 tracking-[-0.02em] text-[var(--settings-fg)]">
          {price.strikethrough != null && (
            <span className="mr-0.5 text-[13px] font-normal text-[var(--settings-fg-muted)] line-through">
              ₹{price.strikethrough.toLocaleString("en-IN")}
            </span>
          )}
          <span>
            {plan.customPriceLabel === "From" && !isMax ? "From " : ""}
            {plan.customPriceLabel !== "Custom" ? "₹" : ""}
            {price.main}
          </span>
          {price.suffix && (
            <span className="text-[13px] font-normal text-[var(--settings-fg-muted)]">
              {price.suffix}
            </span>
          )}
        </p>

        {isMax && (
          <div className={cn(segmentedTrackClass, "shrink-0")}>
            {(["5x", "20x"] as const).map((tier) => (
              <button
                key={tier}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onMaxTierChange?.(tier);
                }}
                className={segmentedOptionClass(maxTier === tier)}
              >
                {tier}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-1 min-h-[36px]">
        {plan.subtitle ? (
          <p className="app-page-muted">{plan.subtitle}</p>
        ) : price.subtext ? (
          <p className="app-page-muted">{price.subtext}</p>
        ) : null}
      </div>

      <div className="mt-4">
        {isCurrent ? (
          <PricingCtaButton disabled variant="current">
            <Check className="h-4 w-4" />
            Current plan
          </PricingCtaButton>
        ) : isLowerThanCurrent ? (
          <div className="h-9" />
        ) : (
          <PricingCtaButton
            onClick={onSelect}
            variant={plan.isPopular ? "primary" : "secondary"}
          >
            {ctaLabel ?? plan.buttonLabel}
          </PricingCtaButton>
        )}
      </div>

      <PlanFeatureList
        heading={plan.highlight ? plan.highlight : "Includes"}
        features={features}
      />
    </article>
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
    <article
      className={cn(
        "app-page-card relative flex h-full w-full flex-col p-4",
        isPrimaryCta && "ring-1 ring-[var(--settings-fg)]",
      )}
    >
      <div className="flex flex-col">
        <div className="mb-1 flex items-start justify-between gap-2">
          <h3 className="app-page-title text-[18px] leading-6">{displayName}</h3>
          {plan.isRecommended && (
            <PlanBadge label="Recommended" variant="recommended" />
          )}
          {plan.isSpecialOffer && (
            <PlanBadge label="Special Offer" variant="special" />
          )}
        </div>

        <p className="app-page-muted">{plan.subtitle}</p>

        <div className="mt-4 rounded-[var(--radius-sm)] bg-[var(--settings-icon-bg)] p-3">
          <p className="mb-2.5 text-[11px] font-medium leading-4 text-[var(--settings-fg-muted)]">
            {plan.userRangeLabel}
          </p>

          {plan.pricingModel === "per-seat" && plan.seatOptions && (
            <div className="flex flex-col">
              <p className="mb-2.5 text-[11px] font-medium leading-4 text-[var(--settings-fg-muted)]">
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
                      <div className="my-2.5 border-t border-[var(--settings-hairline)]" />
                    )}
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[12px] font-medium leading-4 text-[var(--settings-fg)]">
                        {seat.label}
                      </span>
                      <div className="shrink-0 text-right">
                        <div className="flex items-baseline justify-end gap-1">
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
                        {seat.note && (
                          <p className="mt-0.5 max-w-[118px] text-[10px] leading-[14px] text-[var(--settings-fg-muted)]">
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
                <p className="text-[11px] font-medium leading-4 text-[var(--settings-fg-muted)]">
                  Min {plan.minSeats} seats · per seat
                </p>
                <div className="flex flex-wrap items-baseline gap-1">
                  {plan.bundleSeatMonthlyStrikethroughInr != null && (
                    <span className="text-[11px] text-[var(--settings-fg-muted)] line-through">
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
                        <span className="text-[15px] font-medium text-[var(--settings-fg)]">
                          ₹{display.amount.toLocaleString("en-IN")}
                        </span>
                        <span className="text-[11px] font-medium text-[var(--settings-fg-muted)]">
                          / seat / mo
                        </span>
                      </>
                    );
                  })()}
                </div>
                {cycle === "yearly" && (
                  <p className="text-[10px] leading-4 text-[var(--settings-fg-muted)]">
                    Billed annually · {YEARLY_DISCOUNT_PERCENT}% off vs monthly
                  </p>
                )}
              </div>
            )}

          {plan.pricingModel === "usage" && (
            <div className="flex flex-col gap-1">
              <p className="text-[11px] font-medium leading-4 text-[var(--settings-fg-muted)]">
                Min {plan.minSeats} members
              </p>
              <p className="text-[15px] font-medium text-[var(--settings-fg)]">
                {plan.usagePricingLabel}
              </p>
              {plan.usagePricingSubtext && (
                <p className="text-[10px] leading-4 text-[var(--settings-fg-muted)]">
                  {plan.usagePricingSubtext}
                </p>
              )}
            </div>
          )}

          {plan.pricingModel === "seat-plus-usage" && (
            <div className="flex flex-col gap-2">
              <p className="text-[11px] font-medium leading-4 text-[var(--settings-fg-muted)]">
                Min {plan.minSeats} seats · pooled usage
              </p>
              <p className="text-[15px] font-medium text-[var(--settings-fg)]">
                {plan.usagePricingLabel}
              </p>
              {plan.usagePricingSubtext && (
                <p className="text-[10px] leading-4 text-[var(--settings-fg-muted)]">
                  {plan.usagePricingSubtext}
                </p>
              )}
              {plan.seatOptions && (
                <div className="border-t border-[var(--settings-hairline)] pt-2">
                  <p className="mb-1.5 text-[10px] font-medium leading-4 text-[var(--settings-fg-muted)]">
                    Per-seat personal tier (Plus, Pro, or Max):
                  </p>
                  {plan.seatOptions.slice(0, 2).map((seat) => (
                    <p
                      key={seat.id}
                      className="text-[10px] leading-4 text-[var(--settings-fg-muted)]"
                    >
                      {seat.label}: ₹
                      {seat.monthlyPriceInr.toLocaleString("en-IN")}/mo
                    </p>
                  ))}
                  <p className="text-[10px] leading-4 text-[var(--settings-fg-muted)]">
                    + Max 5x & Max 20x seats available
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-4">
          <PricingCtaButton
            onClick={onSelect}
            variant={isPrimaryCta ? "primary" : "secondary"}
          >
            {ctaLabel ?? plan.buttonLabel}
          </PricingCtaButton>
        </div>

        <PlanFeatureList
          heading={plan.highlight ? plan.highlight : "Includes"}
          features={plan.features}
        />

        {plan.footerNote && (
          <p className="mt-3 text-[11px] leading-4 text-[var(--settings-fg-muted)]">
            {plan.footerNote}
          </p>
        )}
      </div>
    </article>
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
  currentPlanId = "",
  className,
}: PlansCarouselSectionProps) {
  const [activeTab, setActiveTab] = React.useState<"individual" | "team">(
    "individual",
  );
  const [billingCycle, setBillingCycle] = React.useState<BillingCycle>("monthly");
  const [maxTier, setMaxTier] = React.useState<MaxTier>("5x");

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

  const showIndividual = layout === "all" || activeTab === "individual";
  const showOrganization = layout === "all" || activeTab === "team";

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="sticky top-0 z-10 -mx-4 bg-[var(--pricing-bg,var(--settings-canvas-bg,#f4f4f3))] px-4 py-2 sm:static sm:mx-0 sm:bg-transparent sm:px-0 sm:py-0">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
        {layout === "tabs" && ORGANIZATION_PLANS.length > 0 ? (
          <div className={cn(segmentedTrackClass, "w-full sm:w-auto")} role="tablist" aria-label="Plan type">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "individual"}
              onClick={() => setActiveTab("individual")}
              className={cn(segmentedOptionClass(activeTab === "individual"), "flex-1 sm:flex-none")}
            >
              Individual
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "team"}
              onClick={() => setActiveTab("team")}
              className={cn(segmentedOptionClass(activeTab === "team"), "flex-1 sm:flex-none")}
            >
              <span className="sm:hidden">Team</span>
              <span className="hidden sm:inline">Team & Enterprise</span>
            </button>
          </div>
        ) : null}

        <div className={cn(segmentedTrackClass, "w-full sm:w-auto")} role="group" aria-label="Billing cycle">
          <button
            type="button"
            aria-pressed={billingCycle === "monthly"}
            onClick={() => setBillingCycle("monthly")}
            className={cn(segmentedOptionClass(billingCycle === "monthly"), "flex-1 sm:flex-none")}
          >
            Monthly
          </button>
          <button
            type="button"
            aria-pressed={billingCycle === "yearly"}
            onClick={() => setBillingCycle("yearly")}
            className={cn(segmentedOptionClass(billingCycle === "yearly"), "flex-1 sm:flex-none")}
          >
            <span className="sm:hidden">Yearly · {YEARLY_DISCOUNT_PERCENT}% off</span>
            <span className="hidden sm:inline">Yearly (save {YEARLY_DISCOUNT_PERCENT}%)</span>
          </button>
        </div>
        </div>
      </div>

      <PlanCardsScroller resetKey={`${layout}-${activeTab}`}>
        {showIndividual
          ? PERSONAL_PLANS.map((plan) => (
              <PlanCarouselCard
                key={plan.id}
                plan={plan}
                billingCycle={billingCycle}
                maxTier={maxTier}
                onMaxTierChange={plan.id === "max" ? setMaxTier : undefined}
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
      </PlanCardsScroller>

      {layout === "tabs" && activeTab === "team" ? (
        <div className="settings-card flex items-start gap-2.5 px-3.5 py-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--settings-fg)]" />
          <p className="app-page-muted">
            Work email required. Each seat can be Plus, Pro, Max 5x, or Max 20x
            — Go is not available on organization plans. Minimum seats: Team 2 ·
            Business 4 · Enterprise 10.
          </p>
        </div>
      ) : null}
    </div>
  );
}

export default function UpgradePageContent({
  onClose,
  onSelectPlan,
  currentPlanId = "",
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
    <div className={cn(chrome.overlay.surface, "settings-canvas")}>
      <header className="relative z-20 flex w-full shrink-0 items-center px-2 py-2 sm:justify-center sm:px-4 sm:py-4">
        <button
          type="button"
          onClick={onClose}
          className="ui-icon-button no-hover-overlay text-[var(--settings-fg)] sm:absolute sm:left-6 sm:top-1/2 sm:-translate-y-1/2"
          aria-label="Back"
        >
          <ArrowLeft className="icon-lg" />
        </button>
        <h1 className="min-w-0 flex-1 truncate px-1 text-[15px] font-medium tracking-[-0.02em] text-[var(--settings-fg)] sm:hidden">
          Plans
        </h1>
      </header>

      <main
        className="mobile-page-inset min-h-0 flex-1 overflow-y-auto pb-24 sm:px-6"
        data-scroll-region=""
      >
        <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-4 pt-1 sm:gap-7 sm:pt-2">
          <div className="mx-auto hidden max-w-[36rem] text-center sm:block">
            <h1 className="app-page-title">Plans that grow with you</h1>
            <p className="app-page-subtitle">
              Pro is ₹1,999 a month. Max is for the highest limits.
            </p>
          </div>

          <PlansCarouselSection
            layout="tabs"
            currentPlanId={activePlanId}
            onPersonalPlanSelect={handlePersonalPlanSelection}
            onOrganizationPlanSelect={handleOrganizationPlanSelection}
          />

          <p className="app-page-muted mx-auto max-w-xl text-center">
            *
            <a
              href="#"
              onClick={handlePlaceholderLinkClick}
              className="underline decoration-[var(--settings-fg)]/25 underline-offset-4 hover:text-[var(--settings-fg)]"
            >
              Usage limits apply
            </a>
            . Prices shown don&apos;t include applicable tax. Plans and pricing
            are subject to change at Shirova&apos;s discretion.
          </p>
        </div>
      </main>
    </div>
  );
}

export { PlanCarouselCard, OrganizationPlanCarouselCard };
