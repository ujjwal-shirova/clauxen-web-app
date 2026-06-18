"use client";

import { Skeleton } from "@/frontend/components/ui/skeleton";

export function SettingsPageSkeleton() {
  return (
    <div
      className="flex h-full min-h-0 flex-1 flex-col md:flex-row md:items-stretch"
      aria-hidden
    >
      <div className="shrink-0 border-b border-[rgba(11,11,11,0.1)] bg-[var(--app-shell-bg)] px-4 py-3 md:hidden">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="space-y-1">
            <Skeleton className="h-3 w-14" variant="text" />
            <Skeleton className="h-5 w-28" variant="text" />
          </div>
          <Skeleton className="h-9 w-9 rounded-lg" variant="block" />
        </div>
        <Skeleton className="mb-2 h-9 w-full rounded-lg" />
        <Skeleton className="h-9 w-full rounded-lg" />
      </div>

      <aside className="hidden min-h-0 w-[192px] shrink-0 flex-col gap-3 border-r border-[rgba(11,11,11,0.1)] bg-[var(--app-shell-bg)] p-3 md:flex">
        <Skeleton className="h-8 w-full rounded-lg" />
        <Skeleton className="mx-2 mt-3 h-3 w-14" variant="text" />
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton key={index} className="h-8 w-full rounded-lg" />
        ))}
      </aside>

      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-[var(--app-panel-bg)]">
        <Skeleton className="absolute right-3 top-3 hidden h-8 w-8 rounded-lg md:block" variant="block" />
        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4 pb-6 pt-3 sm:px-6 md:px-6 md:pb-4 md:pt-12">
          <Skeleton className="h-5 w-28" variant="text" />
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className="flex flex-col gap-3 border-b border-[rgba(11,11,11,0.05)] py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-7"
            >
              <Skeleton className="h-4 w-36" variant="text" />
              <Skeleton className="h-9 w-full rounded-lg sm:w-28" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
