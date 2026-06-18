import type { Message, RecentChat } from "@/frontend/lib/types";

type ChatMessageLookup = Record<
  string,
  readonly string[] | string[] | Message[] | undefined
>;

/** Chats that have at least one saved message — hide empty drafts from Recents. */
export function filterStartedRecentChats(
  recentChats: RecentChat[],
  messagesByChat: ChatMessageLookup,
): RecentChat[] {
  return recentChats.filter(
    (chat) => (messagesByChat[chat.id]?.length ?? 0) > 0,
  );
}
