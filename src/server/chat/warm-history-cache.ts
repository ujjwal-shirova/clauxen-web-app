import { env } from "@/server/config/env";
import { warmLimitsForPlanId } from "@/lib/chat-hydrate-limits";

type WarmInput = {
  userId: string;
  chatId: string;
  limit?: number;
  limits?: number[];
  /** Prefer CF Queue fanout (archive + warm) when the Worker exposes it. */
  async?: boolean;
  planId?: string | null;
};

function resolveLimits(input: WarmInput): number[] {
  if (input.limits?.length) return input.limits;
  if (input.planId !== undefined) {
    return warmLimitsForPlanId(input.planId);
  }
  const primary = input.limit ?? 80;
  return [2, 20, primary, 500].filter(
    (v, i, a) => a.indexOf(v) === i,
  );
}

/**
 * Best-effort write-through so the edge Worker serves latest pages from
 * Cache API / KV / R2 without hitting Hyperdrive on every reload.
 *
 * Prefers `/internal/enqueue` (CF Queues) for non-blocking archive+warm;
 * falls back to synchronous `/internal/warm`.
 */
export async function warmChatHistoryCache(
  input: WarmInput,
): Promise<boolean> {
  const base = env.chatHistoryWorkerUrl;
  const token = env.chatHistoryInternalToken;
  if (!base || !token) return false;

  const limits = resolveLimits(input);
  const payload = {
    userId: input.userId,
    chatId: input.chatId,
    limit: input.limit ?? limits[limits.length - 1],
    limits,
  };

  const headers = {
    "content-type": "application/json",
    "x-clauxen-internal": token,
  };

  const sleep = (ms: number) =>
    new Promise<void>((resolve) => {
      setTimeout(resolve, ms);
    });

  // P4: enqueue archive + warm via CF Queues (non-blocking), with one retry.
  if (input.async !== false) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const enqueued = await fetch(`${base}/internal/enqueue`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            type: "warm_and_archive",
            ...payload,
          }),
          cache: "no-store",
          signal: AbortSignal.timeout(3_000),
        });
        if (enqueued.ok) return true;
      } catch {
        // Retry once, then fall through to sync warm.
      }
      if (attempt === 0) await sleep(400);
    }
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(`${base}/internal/warm`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        cache: "no-store",
        signal: AbortSignal.timeout(12_000),
      });
      if (response.ok) return true;
    } catch {
      // Retry sync warm once.
    }
    if (attempt === 0) await sleep(500);
  }
  return false;
}

/** Purge every mutable page/list cache before a chat write becomes visible. */
export async function invalidateChatHistoryCache(input: {
  userId: string;
  chatId?: string;
  listsOnly?: boolean;
}): Promise<boolean> {
  const base = env.chatHistoryWorkerUrl;
  const token = env.chatHistoryInternalToken;
  if (!base || !token) return false;

  try {
    const response = await fetch(`${base}/internal/invalidate`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-clauxen-internal": token,
      },
      body: JSON.stringify({
        userId: input.userId,
        chatId: input.chatId,
        listsOnly: input.listsOnly,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(3_000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
