"use client";

import type { CSSProperties } from "react";
import { Skeleton } from "@/components/ui/skeleton";

function delay(ms: number): CSSProperties {
  return { ["--skeleton-delay" as string]: `${ms}ms` } as CSSProperties;
}

/**
 * Conversation hydrate placeholder — user bubbles on the right, assistant
 * copy on the left, with a left-to-right shimmer (never a static gray wash).
 */
export function ConversationLoadingSkeleton() {
  return (
    <div
      className="mx-auto flex w-full max-w-[var(--chat-reading-column-max-width,704px)] flex-1 flex-col gap-7 px-4 pt-8 sm:px-6"
      aria-busy="true"
      aria-live="polite"
      role="status"
    >
      <span className="sr-only">Loading conversation</span>

      <div className="flex justify-end">
        <Skeleton className="chat-skeleton-bubble chat-skeleton-bubble--user h-12 w-[min(72%,28rem)]" />
      </div>

      <div className="flex w-full max-w-[min(80%,34rem)] flex-col gap-2.5">
        <Skeleton className="h-3.5 w-[94%]" variant="text" style={delay(70)} />
        <Skeleton className="h-3.5 w-[88%]" variant="text" style={delay(140)} />
        <Skeleton className="h-3.5 w-[76%]" variant="text" style={delay(210)} />
        <Skeleton
          className="chat-skeleton-bubble mt-1.5 h-[72px] w-full"
          style={delay(280)}
        />
      </div>

      <div className="flex justify-end">
        <Skeleton
          className="chat-skeleton-bubble chat-skeleton-bubble--user h-10 w-[min(56%,22rem)]"
          style={delay(350)}
        />
      </div>
    </div>
  );
}

/** @deprecated Use ConversationLoadingSkeleton for chat route hydrates. */
export function MessageSkeleton() {
  return <ConversationLoadingSkeleton />;
}
