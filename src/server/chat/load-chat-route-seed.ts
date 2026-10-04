import { cookies, headers } from "next/headers";
import type { ChatRouteSeed } from "@/lib/chat-route-seed";
import type { ApiMessage } from "@/lib/api/chats";
import { getClaimsFromCookies } from "@/server/auth/jwt";
import * as chatService from "@/server/services/chat.service";

/** One page covers almost every thread; older turns load on scroll. */
const SEED_PAGE_LIMIT = 200;

/**
 * Server-side first-paint seed for `/c/[chatId]` — HARD loads only.
 *
 * On soft (client-side) navigation the sidebar has already started the client
 * fetch, so a server seed would only duplicate the same query. Next marks
 * client navigations with the `rsc: 1` request header.
 *
 * One query, local JWT verification, fail soft (null → client hydrate path).
 */
export async function loadChatRouteSeed(
  chatId: string,
): Promise<ChatRouteSeed | null> {
  if (!chatId || chatId.length > 200) return null;

  try {
    const requestHeaders = await headers();
    if (requestHeaders.get("rsc") === "1") return null;

    const claims = await getClaimsFromCookies(await cookies());
    if (!claims) return null;

    const page = await chatService.listChatThreadPage(chatId, claims.sub, {
      limit: SEED_PAGE_LIMIT,
    });

    const messages: ApiMessage[] = page.messages.map((row) => ({
      id: row.id,
      chat_id: row.chat_id,
      role: row.role,
      content: row.content ?? "",
      status: row.status,
      metadata: (row.metadata ?? {}) as Record<string, unknown>,
      content_json: (row.content_json ?? {}) as Record<string, unknown>,
      created_at: row.created_at,
      parent_message_id: row.parent_message_id ?? null,
      variant_index: row.variant_index,
      variant_count: row.variant_count,
    }));

    return {
      chatId,
      messages,
      hasMore: page.hasMore,
      nextCursor: page.nextCursor,
    };
  } catch {
    return null;
  }
}
