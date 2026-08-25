"use client";

import { ChatView } from "@/components/chat-view";

/**
 * Shared client surface for the `/new` and `/c/[chatId]` routes.
 *
 * Both page modules render this SAME component so React reconciles it across
 * the route swap instead of unmounting the live chat tree. Previously the
 * /new → /c/:id transition swapped two unrelated page components, which
 * remounted ChatView mid-stream — the visible "sudden reload".
 */
export function ChatRouteSurface() {
  return <ChatView />;
}
