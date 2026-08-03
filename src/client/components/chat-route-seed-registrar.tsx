"use client";

import { useLayoutEffect } from "react";
import {
  clearPendingChatRouteSeed,
  setPendingChatRouteSeed,
  type ChatRouteSeed,
} from "@/lib/chat-route-seed";

/**
 * Registers SSR chat messages before ChatView's select effect runs,
 * so the first paint can show real content instead of shimmer.
 */
export function ChatRouteSeedRegistrar({
  seed,
}: {
  seed: ChatRouteSeed | null;
}) {
  // Sync before paint / useEffect in ChatView.
  useLayoutEffect(() => {
    setPendingChatRouteSeed(seed);
    return () => {
      // Do not clear a newer route's synchronous render seed during a fast
      // /c/A → /c/B transition.
      clearPendingChatRouteSeed(seed?.chatId);
    };
  }, [seed]);

  // Also set during render so the first select effect in the same commit sees it.
  if (seed) {
    setPendingChatRouteSeed(seed);
  }

  return null;
}
