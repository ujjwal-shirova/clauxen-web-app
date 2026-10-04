"use client";

import { useLayoutEffect } from "react";
import {
  clearPendingChatRouteSeed,
  setPendingChatRouteSeed,
  type ChatRouteSeed,
} from "@/lib/chat-route-seed";

/** Seeds already handed to the store — never re-register a consumed seed. */
const registeredSeeds = new WeakSet<ChatRouteSeed>();

/**
 * Registers the SSR chat seed (hard loads only) before ChatView's select
 * effect runs, so first paint shows real content instead of a skeleton.
 */
export function ChatRouteSeedRegistrar({
  seed,
}: {
  seed: ChatRouteSeed | null;
}) {
  // Register during render so the first select effect in the same commit
  // sees it — but only once per seed object. Re-registering on every render
  // used to resurrect a stale seed after it had been consumed.
  if (seed && !registeredSeeds.has(seed)) {
    registeredSeeds.add(seed);
    setPendingChatRouteSeed(seed);
  }

  useLayoutEffect(() => {
    return () => {
      // Do not clear a newer route's seed during a fast /c/A → /c/B switch.
      clearPendingChatRouteSeed(seed?.chatId);
    };
  }, [seed]);

  return null;
}
