"use client";

import { Skeleton } from "@/components/ui/skeleton";

/** Static nav chrome — no shimmer (keeps the popup shell calm while content loads). */
function SettingsNavStaticShell() {
  return (
    <aside className="hidden min-h-0 w-[192px] shrink-0 flex-col gap-1 border-r border-[var(--ui-border)] bg-[var(--app-shell-bg)] p-3 md:flex dark:border-white/10">
      <div className="mb-2 h-7 w-full rounded-md bg-[color-mix(in_oklab,#18181b_6%,transparent)]" />
      <div className="mx-2 mb-1 mt-2 h-3 w-14 rounded bg-[color-mix(in_oklab,#18181b_5%,transparent)]" />
      {Array.from({ length: 8 }).map((_, index) => (
        <div
          key={index}
          className="h-7 w-full rounded-md bg-[color-mix(in_oklab,#18181b_4%,transparent)]"
        />
      ))}
    </aside>
  );
}

/**
 * Full modal shell for chunk-load only.
 * Shimmer is limited to the content pane field placeholders — not the whole dialog/nav.
 */
export function SettingsPageSkeleton() {
  return (
    <div
      className="flex h-full min-h-0 flex-1 flex-col md:flex-row md:items-stretch"
      aria-hidden
    >
      <SettingsNavStaticShell />
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-[var(--settings-canvas-bg)]">
        <div className="min-h-0 flex-1 overflow-hidden px-4 pb-4 pt-3 sm:px-6 md:pt-10">
          <SettingsContentSkeleton />
        </div>
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
    <div className="relative flex flex-col gap-2.5 px-4 py-3 first:before:hidden before:absolute before:left-4 before:right-4 before:top-0 before:h-px before:bg-[var(--settings-hairline)] sm:flex-row sm:items-center sm:justify-between sm:gap-5">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Skeleton className="h-3.5 w-36 max-w-[55%]" variant="text" />
        <Skeleton className="h-3 w-48 max-w-[70%]" variant="text" />
      </div>
      {control === "segment" ? (
        <Skeleton className="h-7 w-[120px] rounded-md" />
      ) : control === "toggle" ? (
        <Skeleton className="h-5 w-[34px] rounded-full" variant="pill" />
      ) : control === "button" ? (
        <Skeleton className="h-7 w-[100px] rounded-md" />
      ) : (
        <Skeleton className="h-7 w-full rounded-md sm:w-44" />
      )}
    </div>
  );
}

/** Content-pane only — never includes the settings nav sidebar. */
export function SettingsContentSkeleton() {
  return (
    <div
      className="mx-auto flex w-full max-w-[720px] min-h-0 flex-1 flex-col gap-4"
      aria-busy="true"
      aria-live="polite"
    >
      <Skeleton className="h-4 w-24" variant="text" />

      <section className="flex flex-col gap-2">
        <Skeleton className="h-3.5 w-16" variant="text" />
        <div className="settings-card">
          <div className="flex items-center justify-between gap-5 px-4 py-3">
            <Skeleton className="h-3.5 w-16" variant="text" />
            <Skeleton className="h-10 w-10 rounded-full" variant="circle" />
          </div>
          <SettingsSkeletonRow control="field" />
          <SettingsSkeletonRow control="field" />
          <SettingsSkeletonRow control="field" />
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <Skeleton className="h-3.5 w-24" variant="text" />
        <div className="settings-card">
          <SettingsSkeletonRow control="segment" />
          <SettingsSkeletonRow control="field" />
          <SettingsSkeletonRow control="segment" />
          <SettingsSkeletonRow control="toggle" />
        </div>
      </section>
    </div>
  );
}

/** Billing / account-style section skeleton (plan card + rows). */
export function SettingsBillingSkeleton() {
  return (
    <div
      className="mx-auto flex w-full max-w-[720px] flex-col gap-4"
      aria-busy="true"
      aria-hidden
    >
      <Skeleton className="h-4 w-20" variant="text" />
      <div className="settings-card p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <Skeleton className="h-9 w-9 rounded-xl" />
            <div className="flex min-w-0 flex-col gap-2">
              <Skeleton className="h-4 w-36" variant="text" />
              <Skeleton className="h-3.5 w-52 max-w-full" variant="text" />
            </div>
          </div>
          <Skeleton className="h-7 w-[120px] rounded-md" />
        </div>
        <div className="mt-4 space-y-2.5 border-t border-[var(--settings-hairline)] pt-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="flex items-start gap-2.5">
              <Skeleton className="mt-0.5 h-3.5 w-3.5 rounded" />
              <Skeleton className="h-3.5 w-[70%] max-w-xs" variant="text" />
            </div>
          ))}
        </div>
      </div>
      <section className="flex flex-col gap-2">
        <Skeleton className="h-3.5 w-28" variant="text" />
        <div className="settings-card">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="relative grid grid-cols-1 gap-2 px-4 py-3 before:absolute before:left-4 before:right-4 before:top-0 before:h-px before:bg-[var(--settings-hairline)] first:before:hidden sm:grid-cols-[1fr_5rem_5rem_auto] sm:items-center"
            >
              <Skeleton className="h-3.5 w-28" variant="text" />
              <Skeleton className="h-3.5 w-14" variant="text" />
              <Skeleton className="h-5 w-14 rounded-md" />
              <Skeleton className="h-3.5 w-10" variant="text" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
