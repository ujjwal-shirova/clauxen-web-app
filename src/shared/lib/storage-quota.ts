const MB = 1024 * 1024;
const GB = 1024 * MB;

/** Tier caps — ponytail: no per-plan overrides beyond go vs paid bucket. */
export const STORAGE_QUOTA_BYTES = {
  free: 512 * MB,
  go: 10 * GB,
  paid: 20 * GB,
} as const;

export function storageQuotaBytesForPlan(planId: string | null | undefined): number {
  const id = (planId ?? "free").trim().toLowerCase();
  if (!id || id === "free") return STORAGE_QUOTA_BYTES.free;
  if (id === "go") return STORAGE_QUOTA_BYTES.go;
  return STORAGE_QUOTA_BYTES.paid;
}

type SubscriptionLike = {
  plan_id: string | null;
  status: string | null;
} | null;

/** Active paid subscription plan id, otherwise free. */
export function resolveActiveStoragePlanId(subscription: SubscriptionLike): string {
  if (!subscription?.plan_id) return "free";
  const status = (subscription.status ?? "").toLowerCase();
  if (
    status === "active" ||
    status === "trialing" ||
    status === "past_due"
  ) {
    return subscription.plan_id;
  }
  return "free";
}

if (process.env.NODE_ENV !== "production") {
  const assert = (cond: boolean, msg: string) => {
    if (!cond) throw new Error(`storage-quota selfcheck: ${msg}`);
  };
  assert(storageQuotaBytesForPlan("free") === STORAGE_QUOTA_BYTES.free, "free");
  assert(storageQuotaBytesForPlan("go") === STORAGE_QUOTA_BYTES.go, "go");
  assert(storageQuotaBytesForPlan("plus") === STORAGE_QUOTA_BYTES.paid, "plus");
  assert(
    resolveActiveStoragePlanId({ plan_id: "plus", status: "active" }) === "plus",
    "active sub",
  );
  assert(
    resolveActiveStoragePlanId({ plan_id: "plus", status: "canceled" }) === "free",
    "canceled sub",
  );
}
