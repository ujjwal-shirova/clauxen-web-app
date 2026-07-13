import { env } from "@/backend/config/env";

/**
 * Best-effort write-through so the edge Worker serves latest pages from
 * Cache API / KV / R2 without hitting Hyperdrive on every reload.
 */
export async function warmChatHistoryCache(input: {
  userId: string;
  chatId: string;
  limit?: number;
}): Promise<void> {
  const base = env.chatHistoryWorkerUrl;
  const token = env.chatHistoryInternalToken;
  if (!base || !token) return;

  try {
    await fetch(`${base}/internal/warm`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-clauxen-internal": token,
      },
      body: JSON.stringify({
        userId: input.userId,
        chatId: input.chatId,
        limit: input.limit ?? 2,
      }),
      cache: "no-store",
    });
  } catch {
    // best-effort
  }
}

/** Purge edge latest-page caches after delete / destructive edits. */
export async function invalidateChatHistoryCache(input: {
  userId: string;
  chatId: string;
}): Promise<void> {
  const base = env.chatHistoryWorkerUrl;
  const token = env.chatHistoryInternalToken;
  if (!base || !token) return;

  try {
    await fetch(`${base}/internal/invalidate`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-clauxen-internal": token,
      },
      body: JSON.stringify({
        userId: input.userId,
        chatId: input.chatId,
      }),
      cache: "no-store",
    });
  } catch {
    // best-effort
  }
}
