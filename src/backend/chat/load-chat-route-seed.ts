import { createClient } from "@/utils/supabase/server";
import { INITIAL_CHAT_MESSAGE_PAGE_SIZE } from "@/frontend/lib/chat-history-page-size";
import type { ChatRouteSeed } from "@/frontend/lib/chat-route-seed";
import type { ApiMessage } from "@/frontend/lib/api/chats";
import * as chatService from "@/backend/services/chat.service";

/**
 * Server-side first page + optional branch overlay for `/c/[chatId]`.
 * Fail soft: any error returns null so the client hydrate path still works.
 */
export async function loadChatRouteSeed(
  chatId: string,
): Promise<ChatRouteSeed | null> {
  if (!chatId || chatId.length > 200) return null;

  try {
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) return null;

    const accessToken = session.access_token ?? null;

    const [pageResult, branchRow] = await Promise.all([
      chatService.getChatMessagesPage(chatId, userId, {
        limit: INITIAL_CHAT_MESSAGE_PAGE_SIZE,
        accessToken,
      }),
      chatService.getBranchState(chatId, userId).catch(() => null),
    ]);

    const messages: ApiMessage[] = pageResult.messages.map((row) => ({
      id: row.id,
      chat_id: row.chat_id,
      role: row.role,
      content: row.content ?? "",
      status: row.status,
      metadata: (row.metadata ?? {}) as Record<string, unknown>,
      content_json: (row.content_json ?? {}) as Record<string, unknown>,
      created_at: row.created_at,
    }));

    const branchMessages = Array.isArray(branchRow?.messages)
      ? branchRow.messages
      : null;

    return {
      chatId,
      messages,
      hasMore: Boolean(pageResult.hasMore),
      nextCursor: pageResult.nextCursor,
      branchMessages: Array.isArray(branchMessages) ? branchMessages : null,
    };
  } catch {
    return null;
  }
}
