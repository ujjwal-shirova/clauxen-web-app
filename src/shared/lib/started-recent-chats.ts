import type { Message, RecentChat } from "@/lib/types";

type ChatMessageLookup = Record<
  string,
  readonly string[] | string[] | Message[] | undefined
>;

/**
 * Filter chats for Recents in the sidebar.
 * Real server chats (persisted chats) must always stay visible.
 * Optimistic / creating rows also stay visible.
 * Only client-only draft chats that have no messages are omitted.
 */
export function filterStartedRecentChats(
  recentChats: RecentChat[],
  messagesByChat: ChatMessageLookup,
): RecentChat[] {
  return recentChats.filter((chat) => {
    // Optimistic / creating rows always stay until remapped or dropped.
    if (chat.isCreating || chat.id.startsWith("pending-")) return true;

    // Server-persisted chats (UUID or non-draft) must stay visible even if
    // local message cache is still loading or empty.
    const isLocalDraft =
      chat.id.startsWith("draft-") ||
      chat.id.startsWith("temp-") ||
      (chat as { isDraft?: boolean }).isDraft === true;

    if (!isLocalDraft) {
      return true;
    }

    const local = messagesByChat[chat.id];
    if (local === undefined) return true;
    return local.length > 0;
  });
}
