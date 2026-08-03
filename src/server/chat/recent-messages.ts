import { env } from "@/server/config/env";
import type { MessageRow } from "@/server/repositories/messages.repository";
import * as messagesRepo from "@/server/repositories/messages.repository";

const HISTORY_WORKER_BUDGET_MS = 450;

/**
 * Load recent chat turns for model context via Cloudflare chat-history Worker
 * (Cache API → KV → R2 → Hyperdrive). Falls back to direct Postgres only when
 * the Worker is unset or unavailable — keeps continued chat off the Vercel→Supabase
 * hot path.
 */
export async function listRecentMessagesPreferCloudflare(input: {
  chatId: string;
  userId: string;
  limit?: number;
}): Promise<MessageRow[]> {
  const limit = Math.min(120, Math.max(1, input.limit ?? 40));
  const base = env.chatHistoryWorkerUrl;
  const token = env.chatHistoryInternalToken;

  if (base && token) {
    try {
      const response = await fetch(`${base}/internal/recent`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-clauxen-internal": token,
          Accept: "application/json",
        },
        body: JSON.stringify({
          userId: input.userId,
          chatId: input.chatId,
          limit,
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(HISTORY_WORKER_BUDGET_MS),
      });
      if (response.ok) {
        const payload = (await response.json()) as {
          data?: { messages?: MessageRow[] };
        };
        if (Array.isArray(payload.data?.messages)) {
          return payload.data.messages;
        }
      }
    } catch {
      // Worker cold/outage — fall through to Postgres once.
    }
  }

  try {
    return await messagesRepo.listRecentMessagesForChat(input.chatId, limit);
  } catch {
    // Client transcript in the generate body still carries continuity.
    return [];
  }
}
