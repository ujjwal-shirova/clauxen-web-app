import type { ApiMessage } from "@/frontend/lib/api/chats";

/** Serializable SSR payload for `/c/[chatId]` first paint (avoids client hydrate waterfall). */
export type ChatRouteSeed = {
  chatId: string;
  messages: ApiMessage[];
  hasMore: boolean;
  nextCursor: { id: string; createdAt: string } | null;
  branchMessages: unknown | null;
};

let pendingSeed: ChatRouteSeed | null = null;

export function setPendingChatRouteSeed(seed: ChatRouteSeed | null) {
  pendingSeed = seed;
}

/** Consume a one-shot SSR seed for the matching chat id. */
export function takePendingChatRouteSeed(
  chatId: string,
): ChatRouteSeed | null {
  if (!pendingSeed || pendingSeed.chatId !== chatId) return null;
  const seed = pendingSeed;
  pendingSeed = null;
  return seed;
}

export function peekPendingChatRouteSeed(
  chatId: string,
): ChatRouteSeed | null {
  if (!pendingSeed || pendingSeed.chatId !== chatId) return null;
  return pendingSeed;
}
