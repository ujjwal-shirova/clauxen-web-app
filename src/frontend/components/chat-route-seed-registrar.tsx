"use client";

import { useLayoutEffect } from "react";
import {
  setPendingChatRouteSeed,
  type ChatRouteSeed,
} from "@/frontend/lib/chat-route-seed";

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
      setPendingChatRouteSeed(null);
    };
  }, [seed]);

  // Also set during render so the first select effect in the same commit sees it.
  if (seed) {
    setPendingChatRouteSeed(seed);
  }

  return null;
}
