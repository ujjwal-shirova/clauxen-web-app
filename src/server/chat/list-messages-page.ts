import type {
  ThreadPageResult,
} from "@/server/repositories/messages.repository";
import * as messagesRepo from "@/server/repositories/messages.repository";

/**
 * Keyset page of the ACTIVE branch path for conversation UI.
 * Queries Postgres directly via the thread RPC (`fetch_chat_thread_page`)
 * using the server connection pool for ultra-low latency (~20ms), avoiding
 * cross-cloud network round-trips and JWT verification hops.
 *
 * Serves the ACTIVE branch path only — inactive sibling rows never leak into
 * the visible thread.
 */
export async function listThreadPagePreferEdge(input: {
  chatId: string;
  userId: string;
  accessToken?: string | null;
  cursorDepth?: number | null;
  limit?: number;
}): Promise<ThreadPageResult> {
  return messagesRepo.listThreadPage({
    chatId: input.chatId,
    userId: input.userId,
    depthCursor: input.cursorDepth,
    limit: input.limit,
  });
}