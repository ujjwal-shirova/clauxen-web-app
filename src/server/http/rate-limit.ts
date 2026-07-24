import { AppError } from "@/server/db/errors";

type WindowEntry = { count: number; resetAt: number };

const windows = new Map<string, WindowEntry>();

/**
 * Simple process-local sliding window. Complements Cloudflare WAF; not a
 * substitute for durable multi-instance quotas (DB/KV) on every edge.
 */
export function assertRateLimit(options: {
  key: string;
  limit: number;
  windowMs: number;
  message?: string;
}): void {
  const now = Date.now();
  const entry = windows.get(options.key);
  if (!entry || now > entry.resetAt) {
    windows.set(options.key, {
      count: 1,
      resetAt: now + options.windowMs,
    });
    return;
  }
  entry.count += 1;
  if (entry.count > options.limit) {
    throw new AppError(
      options.message ?? "Too many requests. Try again later.",
      429,
      "rate_limited",
    );
  }
}

/** Best-effort prune to keep the map bounded in long-lived Node processes. */
export function pruneRateLimitWindows(now = Date.now()) {
  for (const [key, entry] of windows) {
    if (now > entry.resetAt) windows.delete(key);
  }
}
