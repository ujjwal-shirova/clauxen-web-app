/**
 * Plan-aware hydrate / warm page sizes for chat-history Worker.
 * Free keeps first paint small; paid tiers load deeper in one edge fetch.
 */

export const HYDRATE_LIMITS = {
  free: 80,
  go: 200,
  paid: 500,
} as const;

export function hydrateLimitForPlanId(
  planId: string | null | undefined,
): number {
  const id = (planId ?? "free").trim().toLowerCase();
  if (!id || id === "free") return HYDRATE_LIMITS.free;
  if (id === "go") return HYDRATE_LIMITS.go;
  return HYDRATE_LIMITS.paid;
}

/** Warm Cache/KV for a few window sizes so reopen hits the edge. */
export function warmLimitsForPlanId(
  planId: string | null | undefined,
): number[] {
  const primary = hydrateLimitForPlanId(planId);
  const set = new Set<number>([2, 20, primary, HYDRATE_LIMITS.paid]);
  return [...set].sort((a, b) => a - b);
}

/** Default client hydrate window when plan is unknown (edge-first). */
export const DEFAULT_CLIENT_HYDRATE_LIMIT = HYDRATE_LIMITS.free;
