"use client";

import { Skeleton } from "@/components/ui/skeleton";

/** Full modal shell skeleton — only for rare full-modal loading states. */
export function SettingsPageSkeleton() {
  return (
    <div
      className="flex h-full min-h-0 flex-1 flex-col md:flex-row md:items-stretch"
      aria-hidden
    >
      <aside className="hidden min-h-0 w-[192px] shrink-0 flex-col gap-3 border-r border-[rgba(11,11,11,0.1)] bg-[var(--app-shell-bg)] p-3 md:flex dark:border-white/10">
        <Skeleton className="h-8 w-full rounded-lg" />
        <Skeleton className="mx-2 mt-3 h-3 w-14" variant="text" />
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton key={index} className="h-8 w-full rounded-lg" />
        ))}
      </aside>
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-[var(--app-panel-bg)]">
        <SettingsContentSkeleton />
      </div>
    </div>
  );
}

function SettingsSkeletonRow({
  control = "field",
}: {
  control?: "field" | "segment" | "toggle" | "button";
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-zinc-100 py-3 last:border-b-0 dark:border-white/5 sm:flex-row sm:items-center sm:justify-between sm:gap-7">
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Skeleton className="h-4 w-36 max-w-[55%]" variant="text" />
        <Skeleton className="h-3 w-48 max-w-[70%]" variant="text" />
      </div>
      {control === "segment" ? (
        <Skeleton className="h-9 w-[132px] rounded-[10px]" />
      ) : control === "toggle" ? (
        <Skeleton className="h-7 w-12 rounded-full" variant="pill" />
      ) : control === "button" ? (
        <Skeleton className="h-9 w-[140px] rounded-full" variant="pill" />
      ) : (
        <Skeleton className="h-9 w-full rounded-lg sm:w-48" />
      )}
    </div>
  );
}

/** Content-pane only — never includes the settings nav sidebar. */
export function SettingsContentSkeleton() {
  return (
    <div
      className="flex min-h-0 flex-1 flex-col gap-8"
      aria-busy="true"
      aria-live="polite"
    >
      <Skeleton className="h-5 w-24" variant="text" />

      <section className="flex flex-col gap-1">
        <Skeleton className="mb-2 h-3 w-16" variant="text" />
        <div className="flex items-center justify-between gap-7 border-b border-zinc-100 py-3 dark:border-white/5">
          <Skeleton className="h-4 w-16" variant="text" />
          <Skeleton className="h-12 w-12 rounded-full" variant="circle" />
        </div>
        <SettingsSkeletonRow control="field" />
        <SettingsSkeletonRow control="field" />
        <SettingsSkeletonRow control="field" />
        <div className="border-b border-zinc-100 py-3 dark:border-white/5">
          <Skeleton className="h-4 w-40" variant="text" />
          <Skeleton className="mt-2 h-3 w-64 max-w-full" variant="text" />
          <Skeleton className="mt-3 h-24 w-full rounded-xl" />
        </div>
      </section>

      <section className="flex flex-col gap-1">
        <Skeleton className="mb-2 h-3 w-24" variant="text" />
        <SettingsSkeletonRow control="segment" />
        <SettingsSkeletonRow control="field" />
        <SettingsSkeletonRow control="segment" />
        <SettingsSkeletonRow control="toggle" />
      </section>
    </div>
  );
}

/** Billing / account-style section skeleton (plan card + rows). */
export function SettingsBillingSkeleton() {
  return (
    <div className="flex flex-col gap-8" aria-busy="true" aria-hidden>
      <Skeleton className="h-5 w-20" variant="text" />
      <section className="border-b border-zinc-200 pb-6 dark:border-white/10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <Skeleton className="h-9 w-9 rounded-xl" />
            <div className="flex min-w-0 flex-col gap-2">
              <Skeleton className="h-5 w-36" variant="text" />
              <Skeleton className="h-4 w-52 max-w-full" variant="text" />
            </div>
          </div>
          <Skeleton className="h-9 w-[140px] rounded-full" variant="pill" />
        </div>
        <div className="mt-5 space-y-2.5 border-t border-zinc-100 pt-5 dark:border-white/5">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="flex items-start gap-2.5">
              <Skeleton className="mt-0.5 h-4 w-4 rounded" />
              <Skeleton className="h-4 w-[70%] max-w-xs" variant="text" />
            </div>
          ))}
        </div>
      </section>
      <section>
        <Skeleton className="mb-3 h-3 w-28" variant="text" />
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="grid grid-cols-1 gap-2 border-b border-zinc-100 py-3 last:border-b-0 dark:border-white/5 sm:grid-cols-[1fr_5rem_5rem_auto] sm:items-center"
          >
            <Skeleton className="h-4 w-28" variant="text" />
            <Skeleton className="h-4 w-14" variant="text" />
            <Skeleton className="h-5 w-14 rounded-md" />
            <Skeleton className="h-4 w-10" variant="text" />
          </div>
        ))}
      </section>
    </div>
  );
}
