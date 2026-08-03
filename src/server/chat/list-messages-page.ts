import { env } from "@/server/config/env";
import type {
  MessagePageCursor,
  MessagePageResult,
  MessageRow,
} from "@/server/repositories/messages.repository";
import * as messagesRepo from "@/server/repositories/messages.repository";

/**
 * Prefer Cloudflare chat-history Worker (Cache API → KV → R2 → Hyperdrive)
 * when configured; otherwise query Postgres directly via the RPC.
 * Latest pages are pair-aligned so the client never needs a second fetch.
 */
export async function listMessagesPagePreferEdge(input: {
  chatId: string;
  userId: string;
  accessToken?: string | null;
  cursorCreatedAt?: string | null;
  cursorId?: string | null;
  limit?: number;
}): Promise<MessagePageResult> {
  const workerBase = env.chatHistoryWorkerUrl;
  if (workerBase && input.accessToken) {
    try {
      const params = new URLSearchParams();
      params.set("fresh", "1");
      if (input.limit) params.set("limit", String(input.limit));
      if (input.cursorId) params.set("cursor_id", input.cursorId);
      if (input.cursorCreatedAt) {
        params.set("cursor_created_at", input.cursorCreatedAt);
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
            messages?: MessageRow[];
            nextCursor?: MessagePageCursor | null;
            hasMore?: boolean;
          };
        };
        if (payload.data?.messages) {
          return {
            messages: payload.data.messages,
            nextCursor: payload.data.nextCursor ?? null,
            hasMore: Boolean(payload.data.hasMore),
          };
        }
      }
    } catch {
      // Fall through to direct Postgres.
    }
  }

  const page = await messagesRepo.listMessagesPage({
    chatId: input.chatId,
    userId: input.userId,
    cursorCreatedAt: input.cursorCreatedAt,
    cursorId: input.cursorId,
    limit: input.limit,
  });

  // Match Worker alignLatestPair when serving the latest page from Postgres.
  const isLatestPage = !input.cursorId && !input.cursorCreatedAt;
  if (
    !isLatestPage ||
    page.messages[0]?.role === "user" ||
    !page.hasMore ||
    !page.nextCursor
  ) {
    return page;
  }

  let aligned = page;
  for (
    let pageCount = 0;
    pageCount < 10 &&
    aligned.messages[0]?.role !== "user" &&
    aligned.hasMore &&
    aligned.nextCursor;
    pageCount += 1
  ) {
    const older = await messagesRepo.listMessagesPage({
      chatId: input.chatId,
      userId: input.userId,
      cursorCreatedAt: aligned.nextCursor.createdAt,
      cursorId: aligned.nextCursor.id,
      limit: input.limit,
    });
    const existing = new Set(aligned.messages.map((message) => message.id));
    aligned = {
      messages: [
        ...older.messages.filter((message) => !existing.has(message.id)),
        ...aligned.messages,
      ],
      nextCursor: older.nextCursor,
      hasMore: older.hasMore,
    };
  }
  return aligned;
}
