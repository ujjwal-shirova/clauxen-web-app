/**
 * Sync cache for the signed-in user's plan so pricing / sidebar can paint
 * "Current plan" without waiting on a network round-trip.
 */
const STORAGE_KEY = "clauxen:billing-plan";

export type CachedBillingPlan = {
  planId: string;
  planLabel: string;
  updatedAt: number;
};

export function formatPlanLabel(
  planId: string | null | undefined,
  displayName?: string | null,
): string {
  const id = (planId || "free").trim().toLowerCase() || "free";
  if (id === "free") return "Free plan";
  const name = (displayName || planId || "Free").trim();
  return name.toLowerCase().includes("plan") ? name : `${name} plan`;
}

export function readCachedBillingPlan(): CachedBillingPlan | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedBillingPlan>;
    if (
      typeof parsed.planId !== "string" ||
      !parsed.planId.trim() ||
      typeof parsed.planLabel !== "string" ||
      !parsed.planLabel.trim()
    ) {
      return null;
    }
    return {
      planId: parsed.planId.trim().toLowerCase(),
      planLabel: parsed.planLabel.trim(),
      updatedAt:
        typeof parsed.updatedAt === "number" ? parsed.updatedAt : Date.now(),
    };
  } catch {
    return null;
  }
}

export function writeCachedBillingPlan(
  planId: string | null | undefined,
  displayName?: string | null,
): CachedBillingPlan {
  const normalizedId = (planId || "free").trim().toLowerCase() || "free";
  const entry: CachedBillingPlan = {
    planId: normalizedId,
    planLabel: formatPlanLabel(normalizedId, displayName),
    updatedAt: Date.now(),
  };
  if (typeof window !== "undefined") {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
    } catch {
      /* ignore quota / private mode */
    }
  }
  return entry;
}

export function readCachedPlanId(fallback = "free"): string {
  return readCachedBillingPlan()?.planId ?? fallback;
}
