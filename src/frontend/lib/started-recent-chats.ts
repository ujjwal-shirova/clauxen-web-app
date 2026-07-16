import type { Message, RecentChat } from "@/frontend/lib/types";

type ChatMessageLookup = Record<
  string,
  readonly string[] | string[] | Message[] | undefined
>;

/**
 * Hide empty local drafts from Recents.
 * Server list is the source of truth on reload — chats that are not hydrated
 * locally yet (`undefined`) stay visible (ChatGPT/Claude behavior).
 * Only hide when we know the chat is an empty local draft (never started).
 * Evicted inactive chats omit their key entirely — they stay visible.
 */
export function filterStartedRecentChats(
  recentChats: RecentChat[],
  messagesByChat: ChatMessageLookup,
): RecentChat[] {
  return recentChats.filter((chat) => {
    // Optimistic / creating rows always stay until remapped or dropped.
    if (chat.isCreating || chat.id.startsWith("pending-")) return true;
    const local = messagesByChat[chat.id];
    if (local === undefined) return true;
    return local.length > 0;
  });
}
