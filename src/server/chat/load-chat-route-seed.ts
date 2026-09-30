import { createClient } from "@/utils/supabase/server";
import { FULL_CHAT_HYDRATE_LIMIT } from "@/lib/chat-history-page-size";
import type { ChatRouteSeed } from "@/lib/chat-route-seed";
import type { ApiMessage } from "@/lib/api/chats";
import * as chatService from "@/server/services/chat.service";

/**
 * Server-side full-thread hydrate for `/c/[chatId]`.
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

    const pageResult = await chatService.getChatMessagesPage(chatId, userId, {
      limit: FULL_CHAT_HYDRATE_LIMIT,
      accessToken,
    });

    let messages: ApiMessage[] = pageResult.messages.map((row) => ({
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

    // Rare: thread longer than hydrate window — finish before paint.
    let cursor = pageResult.nextCursor;
    let hasMore = pageResult.hasMore;
    for (let i = 0; i < 10 && hasMore && cursor; i += 1) {
      const older = await chatService.getChatMessagesPage(chatId, userId, {
        limit: FULL_CHAT_HYDRATE_LIMIT,
        accessToken,
        cursorDepth: cursor.depth,
      });
      const olderMapped: ApiMessage[] = older.messages.map((row) => ({
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
      const existing = new Set(messages.map((m) => m.id));
      messages = [
        ...olderMapped.filter((m) => !existing.has(m.id)),
        ...messages,
      ];
      hasMore = older.hasMore;
      cursor = older.nextCursor;
    }

    return {
      chatId,
      messages,
      hasMore: false,
      nextCursor: null,
    };
  } catch {
    return null;
  }
}
