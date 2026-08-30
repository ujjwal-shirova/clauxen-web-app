"use client";

import { Skeleton as BaseSkeleton } from "@/components/ui/skeleton";

/**
 * Static skeleton placeholder for settings shells.
 * The base Skeleton shimmers by default; the plan/billing view must open calm,
 * so every placeholder here renders the same layout without any animation.
 */
function Skeleton(props: React.ComponentProps<typeof BaseSkeleton>) {
  return <BaseSkeleton {...props} animation="none" />;
}

/** Static nav chrome — no shimmer (keeps the popup shell calm while content loads). */
function SettingsNavStaticShell() {
  return (
    <aside className="hidden min-h-0 w-[256px] shrink-0 flex-col gap-1 border-r border-[var(--settings-modal-border)] bg-[var(--settings-sidebar-bg)] p-4 md:flex">
      <div className="mb-4 h-9 w-28 rounded-lg bg-[var(--settings-icon-bg)]" />
      <div className="mb-3 h-9 w-full rounded-[10px] bg-[var(--settings-nav-active-bg)]" />
      <div className="mx-2 mb-1 mt-2 h-3 w-14 rounded bg-[var(--settings-icon-bg)]" />
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="h-9 w-full rounded-lg bg-[var(--settings-icon-bg)]"
        />
      ))}
    </aside>
  );
}

/**
 * Full modal shell for chunk-load only.
 * Static placeholders only — no shimmer anywhere (calm open, per plan-view polish).
 */
export function SettingsPageSkeleton() {
  return (
    <div
      className="flex h-full min-h-0 flex-1 flex-col md:flex-row md:items-stretch"
      aria-hidden
    >
      <SettingsNavStaticShell />
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-[var(--settings-canvas-bg)]">
        <div className="min-h-0 flex-1 overflow-hidden px-4 pb-6 pt-4 sm:px-7 md:px-8 md:pt-7">
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
    <div className="relative flex flex-col gap-3 px-[var(--settings-row-pad-x)] py-[var(--settings-row-pad-y)] first:before:hidden before:absolute before:left-[var(--settings-row-pad-x)] before:right-[var(--settings-row-pad-x)] before:top-0 before:h-px before:bg-[var(--settings-hairline)] sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Skeleton className="h-3.5 w-36 max-w-[55%]" variant="text" />
        <Skeleton className="h-3 w-48 max-w-[70%]" variant="text" />
      </div>
      {control === "segment" ? (
        <Skeleton className="h-9 w-[120px] rounded-[10px]" />
      ) : control === "toggle" ? (
        <Skeleton className="h-[22px] w-[38px] rounded-full" variant="pill" />
      ) : control === "button" ? (
        <Skeleton className="h-9 w-[100px] rounded-[10px]" />
      ) : (
        <Skeleton className="h-9 w-full rounded-[10px] sm:w-44" />
      )}
    </div>
  );
}

/** Content-pane only — never includes the settings nav sidebar. */
export function SettingsContentSkeleton() {
  return (
    <div
      className="mx-auto flex min-h-0 w-full max-w-[720px] flex-1 flex-col gap-5"
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
      className="mx-auto flex w-full max-w-[720px] flex-col gap-5"
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
