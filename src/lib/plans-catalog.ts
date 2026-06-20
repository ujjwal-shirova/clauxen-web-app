/**
 * Single source of truth for personal plan pricing, features, and checkout IDs.
 * Update values here — subscription, checkout, gift, and onboarding read from this file.
 */

export const YEARLY_DISCOUNT = 0.2;
export const YEARLY_DISCOUNT_PERCENT = Math.round(YEARLY_DISCOUNT * 100);
export const GST_RATE = 0.18;

export type BillingCycle = "monthly" | "yearly";
export type MaxTier = "5x" | "20x";

export type PersonalPlanId = "free" | "go" | "plus" | "pro" | "max";
export type GiftPlanId = "go" | "plus" | "pro" | "max5x" | "max20x";
export type CheckoutPlanId =
  | "go"
  | "plus"
  | "pro"
  | "max"
  | "max5x"
  | "max20x"
  | "team"
  | "enterprise"
  | "business-workspace"
  | "business-code";

export type SeatAssignablePlanId = "plus" | "pro" | "max5x" | "max20x";

export type OrganizationPlanId =
  | "team"
  | "business-workspace"
  | "business-code"
  | "enterprise";

export type PlanCard = {
  id: PersonalPlanId;
  name: string;
  subtitle: string;
  description: string;
  monthlyPriceInr?: number;
  customPriceLabel?: "Custom" | "From";
  yearlySupported: boolean;
  giftable: boolean;
  isCurrent?: boolean;
  isPopular?: boolean;
  isSpecialOffer?: boolean;
  isHighlight?: boolean;
  highlight?: string;
  buttonLabel: string;
  features: string[] | ((ctx: { maxTier?: MaxTier }) => string[]);
};

export type OrganizationSeatOption = {
  id: string;
  label: string;
  assignablePlan: SeatAssignablePlanId;
  monthlyPriceInr: number;
  note?: string;
};

export type OrganizationPlanCard = {
  id: OrganizationPlanId;
  name: string;
  nameAccent?: string;
  subtitle: string;
  userRangeLabel: string;
  minSeats: number;
  maxSeats?: number;
  pricingModel: "per-seat" | "bundle-seat" | "usage" | "seat-plus-usage";
  seatOptions?: OrganizationSeatOption[];
  bundleSeatMonthlyInr?: number;
  bundleSeatMonthlyStrikethroughInr?: number;
  usagePricingLabel?: string;
  usagePricingSubtext?: string;
  yearlySupported: boolean;
  isRecommended?: boolean;
  isSpecialOffer?: boolean;
  isHighlight?: boolean;
  highlight?: string;
  buttonLabel: string;
  features: string[];
  footerNote?: string;
};

export const MAX_TIER_OPTIONS: Record<
  MaxTier,
  {
    label: string;
    usageLabel: string;
    monthlyPriceInr: number;
    apiPlanId: "max5x" | "max20x";
    badge?: string;
    checkoutName: string;
  }
> = {
  "5x": {
    label: "5x",
    usageLabel: "5x more usage than Pro",
    monthlyPriceInr: 9_999,
    apiPlanId: "max5x",
    checkoutName: "Max 5x plan",
  },
  "20x": {
    label: "20x",
    usageLabel: "20x more usage than Pro",
    monthlyPriceInr: 19_999,
    apiPlanId: "max20x",
    checkoutName: "Max 20x plan",
  },
};

export const PLAN_MONTHLY_PRICES_INR = {
  free: 0,
  go: 99,
  plus: 1_999,
  pro: 4_999,
} as const;

/** Personal tiers assignable to organization seats (Go is not allowed). */
export const SEAT_ASSIGNABLE_PLANS: Record<
  SeatAssignablePlanId,
  { label: string; monthlyPriceInr: number; usageNote: string }
> = {
  plus: {
    label: "Plus seat",
    monthlyPriceInr: PLAN_MONTHLY_PRICES_INR.plus,
    usageNote: "All Clauxen features, with more usage than Go",
  },
  pro: {
    label: "Pro seat",
    monthlyPriceInr: PLAN_MONTHLY_PRICES_INR.pro,
    usageNote: "5x more usage than Plus seats",
  },
  max5x: {
    label: "Max 5x seat",
    monthlyPriceInr: MAX_TIER_OPTIONS["5x"].monthlyPriceInr,
    usageNote: "5x more usage than Pro seats",
  },
  max20x: {
    label: "Max 20x seat",
    monthlyPriceInr: MAX_TIER_OPTIONS["20x"].monthlyPriceInr,
    usageNote: "20x more usage than Pro seats",
  },
};

/** Bundled business workspace seat price (Clauxen & Collabry). */
export const BUSINESS_WORKSPACE_SEAT_MONTHLY_INR = 1_799;

export const PLAN_TOKEN_GRANTS: Record<string, number> = {
  go: 50_000,
  plus: 500_000,
  pro: 1_000_000,
  max5x: 2_000_000,
  max20x: 4_000_000,
  max: 2_000_000,
  "business-workspace": 1_000_000,
};

export const CHECKOUT_PLAN_IDS = new Set<string>([
  "go",
  "plus",
  "pro",
  "max",
  "max5x",
  "max20x",
  "team",
  "enterprise",
  "business-workspace",
  "business-code",
]);

/** Plans with monthly/yearly billing toggle (Max is monthly-only). */
export const BILLING_CYCLE_PLAN_IDS = new Set<string>([
  "go",
  "plus",
  "pro",
  "team",
  "business-workspace",
]);

export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

export function getYearlyPriceInr(monthlyInr: number): number {
  return Math.round(monthlyInr * 12 * (1 - YEARLY_DISCOUNT));
}

export function getYearlyPricePaise(monthlyPaise: number): number {
  return Math.round(monthlyPaise * 12 * (1 - YEARLY_DISCOUNT));
}

export function formatInr(rupees: number, options?: { suffix?: string }): string {
  const formatted = `₹${rupees.toLocaleString("en-IN")}`;
  return options?.suffix ? `${formatted}${options.suffix}` : formatted;
}

export function formatInrFromPaise(paise: number, options?: { suffix?: string }): string {
  return formatInr(Math.round(paise / 100), options);
}

export type SeatCounts = Record<SeatAssignablePlanId, number>;

export const EMPTY_SEAT_COUNTS: SeatCounts = {
  plus: 0,
  pro: 0,
  max5x: 0,
  max20x: 0,
};

export function createDefaultSeatCounts(minSeats: number): SeatCounts {
  return { ...EMPTY_SEAT_COUNTS, plus: minSeats };
}

export function getTotalSeatCount(seats: SeatCounts): number {
  return (Object.keys(seats) as SeatAssignablePlanId[]).reduce(
    (sum, id) => sum + seats[id],
    0,
  );
}

export function getOrganizationPlan(
  planId: string,
): OrganizationPlanCard | undefined {
  return ORGANIZATION_PLANS.find((plan) => plan.id === planId);
}

export function computeSeatMixSubtotalInr(
  seats: SeatCounts,
  billingCycle: BillingCycle,
  yearlySupported: boolean,
): number {
  return (Object.keys(seats) as SeatAssignablePlanId[]).reduce((total, id) => {
    const count = seats[id];
    if (count <= 0) return total;
    const monthly = SEAT_ASSIGNABLE_PLANS[id].monthlyPriceInr;
    const unit =
      billingCycle === "yearly" && yearlySupported
        ? getYearlyPriceInr(monthly)
        : monthly;
    return total + unit * count;
  }, 0);
}

export function computeSeatMixLineInr(
  seatId: SeatAssignablePlanId,
  count: number,
  billingCycle: BillingCycle,
  yearlySupported: boolean,
): number {
  if (count <= 0) return 0;
  const monthly = SEAT_ASSIGNABLE_PLANS[seatId].monthlyPriceInr;
  const unit =
    billingCycle === "yearly" && yearlySupported
      ? getYearlyPriceInr(monthly)
      : monthly;
  return unit * count;
}

export function computeBundleSeatSubtotalInr(
  seatCount: number,
  monthlyPerSeat: number,
  billingCycle: BillingCycle,
  yearlySupported: boolean,
): number {
  const unit =
    billingCycle === "yearly" && yearlySupported
      ? getYearlyPriceInr(monthlyPerSeat)
      : monthlyPerSeat;
  return unit * seatCount;
}

export function resolveApiPlanId(planId: string, maxTier: MaxTier = "5x"): string {
  if (planId === "max") {
    return MAX_TIER_OPTIONS[maxTier].apiPlanId;
  }
  return planId;
}

export function resolveCheckoutPlanId(
  planId: string,
  maxTier: MaxTier = "5x",
): string {
  return resolveApiPlanId(planId, maxTier);
}

export function getOrganizationSeatDisplayPrice(
  monthlyInr: number,
  billingCycle: BillingCycle,
  yearlySupported: boolean,
): { amount: number; strikethrough: number | null } {
  if (billingCycle === "yearly" && yearlySupported) {
    return {
      amount: Math.round(getYearlyPriceInr(monthlyInr) / 12),
      strikethrough: monthlyInr,
    };
  }
  return { amount: monthlyInr, strikethrough: null };
}

export function getCheckoutPlanDetails(
  planId: string,
  maxTier: MaxTier = "5x",
): { name: string; monthly: number; yearly: number } {
  if (planId === "max") {
    const tier = MAX_TIER_OPTIONS[maxTier];
    return {
      name: tier.checkoutName,
      monthly: tier.monthlyPriceInr,
      yearly: tier.monthlyPriceInr,
    };
  }

  if (planId === "business-workspace") {
    return {
      name: "Business Clauxen & Collabry",
      monthly: BUSINESS_WORKSPACE_SEAT_MONTHLY_INR,
      yearly: getYearlyPriceInr(BUSINESS_WORKSPACE_SEAT_MONTHLY_INR),
    };
  }

  if (planId === "business-code") {
    return {
      name: "Business Clauxen Code",
      monthly: 0,
      yearly: 0,
    };
  }

  const monthly =
    planId in PLAN_MONTHLY_PRICES_INR
      ? PLAN_MONTHLY_PRICES_INR[planId as keyof typeof PLAN_MONTHLY_PRICES_INR]
      : 0;

  const names: Record<string, string> = {
    go: "Go plan",
    plus: "Plus plan",
    pro: "Pro plan",
    team: "Team plan",
    enterprise: "Enterprise plan",
    "business-workspace": "Business Clauxen & Collabry",
    "business-code": "Business Clauxen Code",
  };

  return {
    name: names[planId] ?? planId,
    monthly,
    yearly: monthly > 0 ? getYearlyPriceInr(monthly) : 0,
  };
}

function maxFeatures(maxTier: MaxTier): string[] {
  const usage = MAX_TIER_OPTIONS[maxTier].usageLabel;
  return [
    `${usage}*`,
    "Frontier premium models",
    "Maximum access to Clauxen Code and Collabry",
    "Maximum deep research",
    "Unlimited core chat (subject to fair use guardrails)",
    "Unlimited and faster image creation",
    "Maximum memory and context",
    "Early access to experimental features",
    "Priority access at high traffic times",
    "Recommended for Clauxen Code and Collabry power users",
  ];
}

export const PERSONAL_PLANS: PlanCard[] = [
  {
    id: "free",
    name: "Free",
    subtitle: "See what AI can do",
    description: "Meet Clauxen",
    monthlyPriceInr: PLAN_MONTHLY_PRICES_INR.free,
    yearlySupported: false,
    giftable: false,
    isCurrent: true,
    buttonLabel: "Your current plan",
    features: [
      "Core models for everyday chat",
      "Limited messages and uploads",
      "Limited image creation",
      "Limited memory and context",
      "Chat on web, iOS, Android, and desktop",
      "Generate code and visualize data",
      "Built-in web search",
      "Extended thinking for complex work",
    ],
  },
  {
    id: "go",
    name: "Go",
    subtitle: "Keep chatting with expanded access",
    description: "Higher limits for everyday power users",
    monthlyPriceInr: PLAN_MONTHLY_PRICES_INR.go,
    yearlySupported: true,
    giftable: true,
    highlight: "Everything in Free, plus:",
    buttonLabel: "Upgrade to Go",
    features: [
      "Core models tuned for everyday tasks",
      "More messages and uploads",
      "More image creation",
      "Longer memory",
      "Expanded voice mode",
    ],
  },
  {
    id: "plus",
    name: "Plus",
    subtitle: "Unlock the full experience",
    description: "Research, code, and organize",
    monthlyPriceInr: PLAN_MONTHLY_PRICES_INR.plus,
    yearlySupported: true,
    giftable: true,
    isPopular: true,
    highlight: "Everything in Go, plus:",
    buttonLabel: "Upgrade to Plus",
    features: [
      "Advanced models",
      "Even more messages and uploads",
      "Advanced image creation with extended thinking",
      "Expanded memory across chats",
      "Clauxen Code directly in your codebase",
      "Expanded deep research and analysis",
      "Projects and custom assistants",
      "Memory that carries across conversations",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    subtitle: "Research, code, and organize at scale",
    description: "For professionals who rely on Clauxen every day",
    monthlyPriceInr: PLAN_MONTHLY_PRICES_INR.pro,
    yearlySupported: true,
    giftable: true,
    highlight: "Everything in Plus, plus:",
    buttonLabel: "Upgrade to Pro",
    features: [
      "Much higher usage limits across chat, uploads, and creation",
      "Frontier models for complex reasoning, coding, and creation",
      "Clauxen Code and Collabry with expanded access",
      "Deep research and analysis at Pro depth",
      "Agent multi-tasking and higher upload capacity",
      "Priority access during peak hours with faster premium inference",
      "Expanded project, artifact, and workflow capacity",
      "Generated content eligible for commercial use",
    ],
  },
  {
    id: "max",
    name: "Max",
    subtitle: "Maximize your productivity",
    description: "Higher limits, priority access",
    customPriceLabel: "From",
    yearlySupported: false,
    giftable: true,
    highlight: "Everything in Pro, plus:",
    buttonLabel: "Upgrade to Max",
    features: ({ maxTier = "5x" }) => maxFeatures(maxTier),
  },
];

function organizationSeatOptions(): OrganizationSeatOption[] {
  return (Object.keys(SEAT_ASSIGNABLE_PLANS) as SeatAssignablePlanId[]).map(
    (id) => ({
      id,
      label: SEAT_ASSIGNABLE_PLANS[id].label,
      assignablePlan: id,
      monthlyPriceInr: SEAT_ASSIGNABLE_PLANS[id].monthlyPriceInr,
      note: SEAT_ASSIGNABLE_PLANS[id].usageNote,
    }),
  );
}

export const ORGANIZATION_PLANS: OrganizationPlanCard[] = [
  {
    id: "team",
    name: "Team",
    subtitle: "Predictable usage per seat",
    userRangeLabel: "4–150 users",
    minSeats: 4,
    maxSeats: 150,
    pricingModel: "per-seat",
    seatOptions: organizationSeatOptions(),
    yearlySupported: true,
    isRecommended: true,
    highlight: "Each seat can be Plus, Pro, or Max (Go not available):",
    buttonLabel: "Upgrade to Team",
    features: [
      "Configure every seat on Plus, Pro, Max 5x, or Max 20x — mix tiers in one workspace",
      "200K context window across shared team projects and knowledge",
      "Clauxen Code and Collabry included per seat tier",
      "Central billing, seat assignment, and team-wide usage dashboard",
      "SAML single sign-on (SSO) with work-email domain capture",
      "Admin-approved connectors, skills, and deployment workflows",
      "Organization search across chats, projects, and uploaded files",
      "AES-256 encryption in transit and at rest for workspace data",
      "Shirova never trains on your team data — contractual no-training default",
      "Data Processing Agreement (DPA) available for GDPR-ready teams",
    ],
    footerNote:
      "Minimum 4 seats. Mix seat tiers freely within your seat limit. Usage limits apply.",
  },
  {
    id: "business-workspace",
    name: "Business",
    nameAccent: "Clauxen & Collabry",
    subtitle: "Get more work done with AI for teams",
    userRangeLabel: "4–500 users",
    minSeats: 4,
    maxSeats: 500,
    pricingModel: "bundle-seat",
    bundleSeatMonthlyInr: BUSINESS_WORKSPACE_SEAT_MONTHLY_INR,
    bundleSeatMonthlyStrikethroughInr: PLAN_MONTHLY_PRICES_INR.plus + 499,
    yearlySupported: true,
    isSpecialOffer: true,
    isHighlight: true,
    buttonLabel: "Upgrade to Business",
    features: [
      "Everything in Team, plus bundled Clauxen & Collabry for every seat",
      "Advanced models for chat, research, creation, and multi-step agents",
      "Unlimited core chat and uploads (subject to fair-use guardrails)",
      "Company knowledge base — documents, wikis, and connectors in one place",
      "Clauxen Code coding agent included without a separate dev seat fee",
      "Projects, custom assistants, and shared skills across departments",
      "Enforced MFA, SSO, and role-based workspace permissions for admins",
      "Workspace boundary isolation — no cross-tenant data mixing",
      "Admin policies to restrict external sharing and unapproved connectors",
      "Configurable workspace retention windows; Shirova never trains on your data",
    ],
    footerNote:
      "Minimum 4 seats, billed annually when yearly is selected. GST excluded at checkout with a valid GST ID.",
  },
  {
    id: "business-code",
    name: "Business",
    nameAccent: "Clauxen Code",
    subtitle: "For software development teams",
    userRangeLabel: "4+ users",
    minSeats: 4,
    pricingModel: "usage",
    usagePricingLabel: "Usage pricing",
    usagePricingSubtext: "Pay as you go based on agent and API usage",
    yearlySupported: false,
    buttonLabel: "Upgrade to Clauxen Code",
    features: [
      "Purpose-built for engineering teams — not a general chat add-on",
      "AI-powered coding across repositories with repo-scoped permissions",
      "Automated code review, security scanning, and vulnerability surfacing",
      "Collabry agents for local automation, PRs, and cross-tool workflows",
      "Built-in worktrees and cloud sandboxes for multi-agent development",
      "Secrets and credentials never stored in model context or training pipelines",
      "SAML SSO, role-based repo access, and engineering org billing",
      "Usage-based pricing — pay for agent and API consumption, not idle seats",
      "Source code and prompts excluded from Shirova model training by default",
      "Ideal when your team lives in IDEs and CI/CD, not shared chat workspaces",
    ],
    footerNote: "Minimum 4 members. Go plan cannot be assigned to code seats.",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    subtitle: "Flexible pooled usage",
    userRangeLabel: "10+ users",
    minSeats: 10,
    pricingModel: "seat-plus-usage",
    seatOptions: organizationSeatOptions(),
    usagePricingLabel: "Seat + usage",
    usagePricingSubtext: `₹${PLAN_MONTHLY_PRICES_INR.plus.toLocaleString("en-IN")}/seat platform fee + usage at API rates`,
    yearlySupported: false,
    highlight: "All Business features, plus:",
    buttonLabel: "Contact Sales",
    features: [
      "Minimum 10 seats — Plus, Pro, Max 5x, or Max 20x per seat with pooled usage",
      "Organization-wide spend caps, budgets, and per-team usage guardrails",
      "500K context window for contracts, codebases, and long-running workflows",
      "SCIM provisioning — auto onboard and offboard users from your identity provider",
      "Fine-grained RBAC across workspaces, projects, connectors, and admin actions",
      "Full audit logs with export to SIEM, eDiscovery, and compliance tooling",
      "Compliance API for programmatic monitoring of AI activity across the org",
      "Custom data retention, zero-retention modes, and legal hold on request",
      "IP allowlisting, network-level access control, and private connectivity options",
      "Custom DPA, SLA, invoicing, and dedicated Shirova security review support",
    ],
    footerNote:
      "Minimum 10 seats. Contact sales for custom pricing, procurement, and regulated-industry deployment.",
  },
];

/** @deprecated Use ORGANIZATION_PLANS */
export const TEAM_PLANS = ORGANIZATION_PLANS;

export type GiftPlanOption = {
  id: GiftPlanId;
  name: string;
  subtitle: string;
  monthlyPriceInr: number;
};

/** Giftable paid personal plans — derived from catalog prices. */
export const GIFT_PLANS: GiftPlanOption[] = [
  {
    id: "go",
    name: "Go",
    subtitle: "Affordable entry",
    monthlyPriceInr: PLAN_MONTHLY_PRICES_INR.go,
  },
  {
    id: "plus",
    name: "Plus",
    subtitle: "Unlock the full experience",
    monthlyPriceInr: PLAN_MONTHLY_PRICES_INR.plus,
  },
  {
    id: "pro",
    name: "Pro",
    subtitle: "Research, code, and organize at scale",
    monthlyPriceInr: PLAN_MONTHLY_PRICES_INR.pro,
  },
  {
    id: "max5x",
    name: "Max 5x",
    subtitle: "For the enthusiast",
    monthlyPriceInr: MAX_TIER_OPTIONS["5x"].monthlyPriceInr,
  },
  {
    id: "max20x",
    name: "Max 20x",
    subtitle: "For the power user",
    monthlyPriceInr: MAX_TIER_OPTIONS["20x"].monthlyPriceInr,
  },
];

export const GIFT_PLAN_IDS = new Set(GIFT_PLANS.map((plan) => plan.id));

export function resolvePlanFeatures(
  plan: PlanCard,
  ctx: { maxTier?: MaxTier } = {},
): string[] {
  return typeof plan.features === "function" ? plan.features(ctx) : plan.features;
}

/** Rotating copy for checkout preparing — only real plan capabilities, no payment fluff. */
export function getCheckoutPreparingFeatures(
  planId: string,
  maxTier: MaxTier = "5x",
): string[] {
  const personal = PERSONAL_PLANS.find((p) => p.id === planId);
  if (personal) {
    return resolvePlanFeatures(personal, { maxTier }).filter(
      (line) =>
        !line.startsWith("Everything in") && !line.startsWith("All Business"),
    );
  }

  const org = getOrganizationPlan(planId as OrganizationPlanId);
  if (org) {
    return org.features.filter(
      (line) =>
        !line.startsWith("Everything in") && !line.startsWith("All Business"),
    );
  }

  if (planId === "max5x") {
    return maxFeatures("5x");
  }
  if (planId === "max20x") {
    return maxFeatures("20x");
  }

  return ["Unlocking everything included in your plan"];
}

export function getPlanPriceInr(
  plan: PlanCard,
  billingCycle: BillingCycle,
  maxTier: MaxTier = "5x",
): number | null {
  if (plan.id === "max") {
    return MAX_TIER_OPTIONS[maxTier].monthlyPriceInr;
  }
  if (typeof plan.monthlyPriceInr !== "number") {
    return null;
  }
  if (plan.monthlyPriceInr === 0) {
    return 0;
  }
  if (!plan.yearlySupported || billingCycle === "monthly") {
    return plan.monthlyPriceInr;
  }
  return getYearlyPriceInr(plan.monthlyPriceInr);
}

export function formatPlanPriceLabel(
  plan: PlanCard,
  billingCycle: BillingCycle,
  maxTier: MaxTier = "5x",
): string {
  if (plan.customPriceLabel === "Custom") {
    return "Custom";
  }
  const price = getPlanPriceInr(plan, billingCycle, maxTier);
  if (price === null) {
    return "";
  }
  return price.toLocaleString("en-IN");
}

/** Onboarding cards — subset of personal plans (no Pro/Max on first signup). */
export const ONBOARDING_PLAN_IDS = ["free", "go", "plus"] as const;
export type OnboardingPlanId = (typeof ONBOARDING_PLAN_IDS)[number];

export function getOnboardingPlanCards(): Array<{
  id: OnboardingPlanId;
  name: string;
  subtitle: string;
  priceDisplay: string;
  priceSuffix?: string;
  features: string[];
  highlight?: string;
  cta: string;
  yearlySupported: boolean;
}> {
  return PERSONAL_PLANS.filter((plan): plan is PlanCard & { id: OnboardingPlanId } =>
    (ONBOARDING_PLAN_IDS as readonly string[]).includes(plan.id),
  ).map((plan) => ({
    id: plan.id as OnboardingPlanId,
    name: plan.name,
    subtitle: plan.subtitle,
    priceDisplay: formatInr(plan.monthlyPriceInr ?? 0),
    priceSuffix: plan.monthlyPriceInr ? "/ month" : undefined,
    features: resolvePlanFeatures(plan),
    highlight: plan.highlight,
    cta:
      plan.id === "free"
        ? "Get started with Free"
        : plan.id === "go"
          ? "Get Go plan"
          : "Get Plus plan",
    yearlySupported: plan.yearlySupported,
  }));
}
