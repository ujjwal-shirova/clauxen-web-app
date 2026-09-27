const MB = 1024 * 1024;
const GB = 1024 * MB;

/**
 * Included storage by plan.
 * Free 1 GB → Go 10 GB → Pro 25 GB → Max 50 GB.
 * Extra space is purchased on top at STORAGE_USD_PER_GB.
 */
export const STORAGE_INCLUDED_BYTES = {
  free: 1 * GB,
  go: 10 * GB,
  pro: 25 * GB,
  max: 50 * GB,
} as const;

/** Add-on price. Charged in INR at checkout using the live USD→INR rate. */
export const STORAGE_USD_PER_GB = 0.026;

/** 0.026 USD expressed in millionths of a dollar, so totals stay integers. */
const USD_MICROS_PER_GB = 26_000;

export const STORAGE_ADDON_MIN_GB = 1;
export const STORAGE_ADDON_MAX_GB = 10_000;
export const STORAGE_EXTRA_GB_CAP = 100_000;

export const STORAGE_PLAN_LADDER = [
  { id: "free", label: "Free", gb: 1 },
  { id: "go", label: "Go", gb: 10 },
  { id: "pro", label: "Pro", gb: 25 },
  { id: "max", label: "Max", gb: 50 },
] as const;

export type StoragePlanTier = (typeof STORAGE_PLAN_LADDER)[number]["id"];

function normalizePlanId(planId: string | null | undefined): string {
  return (planId ?? "free").trim().toLowerCase().replace(/[_-]/g, "");
}

/** Which included bucket a subscription plan uses. */
export function storageTierForPlan(
  planId: string | null | undefined,
): StoragePlanTier {
  const id = normalizePlanId(planId);
  if (!id || id === "free") return "free";
  if (id === "go") return "go";
  if (id === "max" || id === "max5x" || id === "max20x") return "max";
  return "pro";
}

export function includedBytesForPlan(planId: string | null | undefined): number {
  return STORAGE_INCLUDED_BYTES[storageTierForPlan(planId)];
}

export function includedGbForPlan(planId: string | null | undefined): number {
  return STORAGE_PLAN_LADDER.find((step) => step.id === storageTierForPlan(planId))!
    .gb;
}

export function storageQuotaBytesForPlan(
  planId: string | null | undefined,
  extraGb = 0,
): number {
  const extra = normalizeExtraGb(extraGb);
  return includedBytesForPlan(planId) + extra * GB;
}

export function normalizeExtraGb(extraGb: number): number {
  if (!Number.isFinite(extraGb) || extraGb <= 0) return 0;
  return Math.min(STORAGE_EXTRA_GB_CAP, Math.floor(extraGb));
}

export function normalizeAddonGigabytes(value: unknown): number | null {
  const gigabytes =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : NaN;
  if (!Number.isInteger(gigabytes)) return null;
  if (gigabytes < STORAGE_ADDON_MIN_GB || gigabytes > STORAGE_ADDON_MAX_GB) {
    return null;
  }
  return gigabytes;
}

export function storageAddonUsdMicros(gigabytes: number): number {
  return gigabytes * USD_MICROS_PER_GB;
}

/** INR paise for a storage add-on. Never below Razorpay's ₹1 minimum. */
export function storageAddonAmountPaise(
  gigabytes: number,
  usdInrRate: number,
): number {
  const rate = Number.isFinite(usdInrRate) && usdInrRate > 0 ? usdInrRate : 1;
  const usd = gigabytes * STORAGE_USD_PER_GB;
  const paise = Math.round(usd * rate * 100);
  return Math.max(100, paise);
}

type SubscriptionLike = {
  plan_id: string | null;
  status: string | null;
} | null;

/** Active paid subscription plan id, otherwise free. */
export function resolveActiveStoragePlanId(
  subscription: SubscriptionLike,
): string {
  if (!subscription?.plan_id) return "free";
  const status = (subscription.status ?? "").toLowerCase();
  if (status === "active" || status === "trialing" || status === "past_due") {
    return subscription.plan_id;
  }
  return "free";
}

if (process.env.NODE_ENV !== "production") {
  const assert = (cond: boolean, msg: string) => {
    if (!cond) throw new Error(`storage-quota selfcheck: ${msg}`);
  };
  assert(includedBytesForPlan("free") === STORAGE_INCLUDED_BYTES.free, "free");
  assert(includedBytesForPlan("go") === STORAGE_INCLUDED_BYTES.go, "go");
  assert(includedBytesForPlan("pro") === STORAGE_INCLUDED_BYTES.pro, "pro");
  assert(includedBytesForPlan("plus") === STORAGE_INCLUDED_BYTES.pro, "plus");
  assert(includedBytesForPlan("max") === STORAGE_INCLUDED_BYTES.max, "max");
  assert(includedBytesForPlan("max_5x") === STORAGE_INCLUDED_BYTES.max, "max5x");
  assert(includedBytesForPlan("max-20x") === STORAGE_INCLUDED_BYTES.max, "max20x");
  assert(
    storageQuotaBytesForPlan("pro", 10) === STORAGE_INCLUDED_BYTES.pro + 10 * GB,
    "extra",
  );
  assert(storageAddonUsdMicros(1) === 26_000, "usd micros");
  assert(storageAddonAmountPaise(1, 95.58) >= 100, "min paise");
  assert(
    resolveActiveStoragePlanId({ plan_id: "plus", status: "active" }) === "plus",
    "active sub",
  );
  assert(
    resolveActiveStoragePlanId({ plan_id: "plus", status: "canceled" }) === "free",
    "canceled sub",
  );
  assert(normalizeAddonGigabytes(0) === null, "zero gb");
  assert(normalizeAddonGigabytes(25) === 25, "25 gb");
}
