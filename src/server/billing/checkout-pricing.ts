import { AppError } from "@/server/db/errors";
import type { CheckoutSessionClaims } from "@/server/billing/checkout-session";
import {
  isCheckoutCurrency,
  type CheckoutCurrency,
} from "@/lib/checkout-currency";
import {
  BUSINESS_WORKSPACE_SEAT_MONTHLY_INR,
  computeBundleSeatSubtotalInr,
  computeSeatMixSubtotalInr,
  getOrganizationPlan,
  getTotalSeatCount,
  rupeesToPaise,
  type SeatAssignablePlanId,
  type SeatCounts,
} from "@/lib/plans-catalog";

const SEAT_ASSIGNABLE_IDS: SeatAssignablePlanId[] = [
  "plus",
  "pro",
  "max5x",
  "max20x",
];

export type CheckoutPlanRow = {
  id: string;
  price_paise_monthly: number;
  price_paise_yearly: number;
  yearly_supported: boolean;
};

export function parseSeatBreakdown(raw: unknown): SeatCounts | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const seats: SeatCounts = { plus: 0, pro: 0, max5x: 0, max20x: 0 };
  for (const seatId of SEAT_ASSIGNABLE_IDS) {
    const value = record[seatId];
    if (value === undefined) continue;
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
      throw new AppError("Invalid seat breakdown.", 400, "invalid_seats");
    }
    seats[seatId] = value;
  }
  return seats;
}

function seatBreakdownsEqual(
  a: Record<string, number>,
  b: Record<string, number>,
): boolean {
  for (const seatId of SEAT_ASSIGNABLE_IDS) {
    if ((a[seatId] ?? 0) !== (b[seatId] ?? 0)) return false;
  }
  return true;
}

/** Reject DevTools tampering — client body must match signed checkout session. */
export function assertCheckoutClaimsMatchClientInput(
  claims: CheckoutSessionClaims,
  client: {
    planId?: string;
    billingCycle?: string;
    currency?: string | null;
    maxTier?: string | null;
    seatBreakdown?: Record<string, number> | null;
    organizationSeatCount?: number | null;
  },
) {
  if (client.planId && client.planId.trim() !== claims.planId) {
    throw new AppError("Checkout session plan mismatch.", 400, "invalid_session");
  }

  if (
    client.billingCycle &&
    client.billingCycle !== claims.billingCycle
  ) {
    throw new AppError(
      "Checkout session billing cycle mismatch.",
      400,
      "invalid_session",
    );
  }

  const sessionCurrency: CheckoutCurrency = claims.currency ?? "INR";
  if (client.currency && client.currency !== sessionCurrency) {
    throw new AppError(
      "Checkout session currency mismatch.",
      400,
      "invalid_session",
    );
  }
  if (client.currency && !isCheckoutCurrency(client.currency)) {
    throw new AppError("Invalid checkout currency.", 400, "invalid_currency");
  }

  if (claims.maxTier) {
    const clientTier = client.maxTier?.trim() ?? "";
    if (clientTier && clientTier !== claims.maxTier) {
      throw new AppError(
        "Checkout session tier mismatch.",
        400,
        "invalid_session",
      );
    }
  }

  if (claims.seatBreakdown) {
    const clientSeats = client.seatBreakdown
      ? parseSeatBreakdown(client.seatBreakdown)
      : null;
    if (
      !clientSeats ||
      !seatBreakdownsEqual(claims.seatBreakdown, clientSeats)
    ) {
      throw new AppError(
        "Checkout session seat mismatch.",
        400,
        "invalid_session",
      );
    }
  }

  if (claims.organizationSeatCount != null) {
    if (client.organizationSeatCount !== claims.organizationSeatCount) {
      throw new AppError(
        "Checkout session seat count mismatch.",
        400,
        "invalid_session",
      );
    }
  }
}

export function resolveCheckoutSubtotalPaise(
  claims: CheckoutSessionClaims,
  plan: CheckoutPlanRow,
): {
  subtotalPaise: number;
  seatBreakdown: SeatCounts | null;
  organizationSeatCount: number | null;
} {
  if (plan.id === "team") {
    const seatBreakdown = parseSeatBreakdown(claims.seatBreakdown);
    if (!seatBreakdown) {
      throw new AppError("seatBreakdown is required for Team checkout.", 400);
    }

    const orgPlan = getOrganizationPlan("team");
    if (!orgPlan) {
      throw new AppError("Team plan is not configured.", 500);
    }

    const totalSeats = getTotalSeatCount(seatBreakdown);
    if (
      totalSeats < orgPlan.minSeats ||
      (orgPlan.maxSeats != null && totalSeats > orgPlan.maxSeats)
    ) {
      throw new AppError("Invalid team seat count.", 400, "invalid_seats");
    }

    return {
      subtotalPaise: rupeesToPaise(
        computeSeatMixSubtotalInr(
          seatBreakdown,
          claims.billingCycle,
          orgPlan.yearlySupported,
        ),
      ),
      seatBreakdown,
      organizationSeatCount: null,
    };
  }

  if (plan.id === "business-workspace" || plan.id === "business") {
    const organizationSeatCount = claims.organizationSeatCount ?? null;
    if (
      typeof organizationSeatCount !== "number" ||
      !Number.isInteger(organizationSeatCount) ||
      organizationSeatCount <= 0
    ) {
      throw new AppError(
        "organizationSeatCount is required for Business checkout.",
        400,
      );
    }

    const orgPlan = getOrganizationPlan("business-workspace");
    if (!orgPlan?.bundleSeatMonthlyInr) {
      throw new AppError("Business plan is not configured.", 500);
    }

    if (
      organizationSeatCount < orgPlan.minSeats ||
      (orgPlan.maxSeats != null && organizationSeatCount > orgPlan.maxSeats)
    ) {
      throw new AppError("Invalid business seat count.", 400, "invalid_seats");
    }

    return {
      subtotalPaise: rupeesToPaise(
        computeBundleSeatSubtotalInr(
          organizationSeatCount,
          orgPlan.bundleSeatMonthlyInr ?? BUSINESS_WORKSPACE_SEAT_MONTHLY_INR,
          claims.billingCycle,
          orgPlan.yearlySupported,
        ),
      ),
      seatBreakdown: null,
      organizationSeatCount,
    };
  }

  const subtotalPaise =
    claims.billingCycle === "yearly" && plan.yearly_supported
      ? plan.price_paise_yearly > 0
        ? plan.price_paise_yearly
        : plan.price_paise_monthly * 12
      : plan.price_paise_monthly;

  return {
    subtotalPaise,
    seatBreakdown: null,
    organizationSeatCount: null,
  };
}
