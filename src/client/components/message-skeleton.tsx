"use client";

import type { CSSProperties } from "react";
import { Skeleton } from "@/components/ui/skeleton";

function delay(ms: number): CSSProperties {
  return { ["--skeleton-delay" as string]: `${ms}ms` } as CSSProperties;
}

/**
 * Conversation hydrate placeholder — user bubbles on the right, assistant
 * copy on the left, all sweeping with the same soft shimmer.
 */
export function ConversationLoadingSkeleton() {
  return (
    <div
      className="mx-auto flex w-full max-w-[var(--chat-reading-column-max-width,704px)] flex-1 flex-col gap-6 px-4 pt-14 sm:px-6"
      aria-busy="true"
      aria-live="polite"
      role="status"
    >
      <span className="sr-only">Loading conversation</span>

      <div className="flex justify-end">
        <Skeleton className="chat-skeleton-bubble chat-skeleton-bubble--user h-9 w-[min(62%,22rem)]" />
      </div>

      <div className="flex w-full flex-col gap-2">
        <Skeleton className="h-3 w-[92%]" variant="text" style={delay(80)} />
        <Skeleton className="h-3 w-[86%]" variant="text" style={delay(160)} />
        <Skeleton className="h-3 w-[64%]" variant="text" style={delay(240)} />
        <Skeleton className="mt-2 h-3 w-[78%]" variant="text" style={delay(320)} />
        <Skeleton className="h-3 w-[48%]" variant="text" style={delay(400)} />
      </div>

      <div className="flex justify-end">
        <Skeleton
          className="chat-skeleton-bubble chat-skeleton-bubble--user h-9 w-[min(44%,16rem)]"
          style={delay(480)}
        />
      </div>

      <div className="flex w-full flex-col gap-2">
        <Skeleton className="h-3 w-[88%]" variant="text" style={delay(560)} />
        <Skeleton className="h-3 w-[72%]" variant="text" style={delay(640)} />
      </div>
    </div>
  );
}

/** @deprecated Use ConversationLoadingSkeleton for chat route hydrates. */
export function MessageSkeleton() {
  return <ConversationLoadingSkeleton />;
}
