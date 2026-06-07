"use client";

import { Skeleton } from "@/frontend/components/ui/skeleton";

export function MessageSkeleton() {
  return (
    <div
      className="flex animate-in fade-in items-start gap-4"
      aria-busy="true"
      aria-label="Loading message"
    >
      <div className="flex flex-1 flex-col gap-2">
        <Skeleton className="w-full" variant="text" />
        <Skeleton className="w-5/6" variant="text" style={{ ["--skeleton-delay" as string]: "80ms" }} />
        <Skeleton className="w-3/4" variant="text" style={{ ["--skeleton-delay" as string]: "160ms" }} />
      </div>
    </div>
  );
}
