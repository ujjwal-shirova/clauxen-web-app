import { env } from "@/server/config/env";
import type {
  ThreadPageCursor,
  ThreadPageResult,
  ThreadMessageRow,
} from "@/server/repositories/messages.repository";
import * as messagesRepo from "@/server/repositories/messages.repository";

/**
 * Prefer Cloudflare chat-history Worker (Cache API → KV → R2 → Hyperdrive)
 * when configured; otherwise query Postgres directly via the thread RPC.
 * Serves the ACTIVE branch path only — inactive sibling rows never leak into
 * the visible thread. `fresh=0` lets warm caches serve continues.
 */
export async function listThreadPagePreferEdge(input: {
  chatId: string;
  userId: string;
  accessToken?: string | null;
  cursorDepth?: number | null;
  limit?: number;
}): Promise<ThreadPageResult> {
  const workerBase = env.chatHistoryWorkerUrl;
  if (workerBase && input.accessToken) {
    try {
      const params = new URLSearchParams();
      params.set("fresh", "0");
      if (input.limit) params.set("limit", String(input.limit));
      if (typeof input.cursorDepth === "number") {
        params.set("cursor_depth", String(input.cursorDepth));
      }
      const qs = params.toString();
      const url = `${workerBase}/v1/chats/${encodeURIComponent(input.chatId)}/messages${qs ? `?${qs}` : ""}`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${input.accessToken}`,
          Accept: "application/json",
        },
        cache: "no-store",
      });
      if (response.ok) {
        const payload = (await response.json()) as {
          data?: {
            messages?: ThreadMessageRow[];
            nextCursor?: ThreadPageCursor | null;
            hasMore?: boolean;
          };
        };
        if (payload.data?.messages) {
          return {
            messages: payload.data.messages,
            nextCursor: payload.data.nextCursor ?? null,
            hasMore: Boolean(payload.data.hasMore),
            leafId: null,
          };
        }
      }
    } catch {
      // Fall through to direct Postgres.
    }
  }

  return messagesRepo.listThreadPage({
    chatId: input.chatId,
    userId: input.userId,
    depthCursor: input.cursorDepth,
    limit: input.limit,
  });
}