import { chrome } from "@/lib/app-chrome";

export default function ConnectorAboutLoading() {
  return (
    <div className={chrome.page.surface}>
      <div className="sticky top-0 z-30 w-full shrink-0 border-b border-[var(--ui-border-subtle)] bg-[var(--app-panel-bg)]">
        <div className="mx-auto flex min-h-12 w-full max-w-[880px] items-center gap-2 px-3 sm:min-h-14 sm:px-6">
          <div className="size-8 animate-pulse rounded-lg bg-[var(--ui-hover-wash)]" />
          <div className="h-4 w-40 animate-pulse rounded bg-[var(--ui-hover-wash)]" />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        <main className="mx-auto flex w-full max-w-[880px] flex-col gap-6 px-3 pb-28 pt-5 sm:px-6 sm:pt-8">
          <div className="flex gap-4 sm:gap-5">
            <div className="size-14 shrink-0 animate-pulse rounded-xl bg-[var(--ui-hover-wash)]" />
            <div className="min-w-0 flex-1 space-y-2 pt-1">
              <div className="h-3 w-24 animate-pulse rounded bg-[var(--ui-hover-wash)]" />
              <div className="h-6 w-48 animate-pulse rounded bg-[var(--ui-hover-wash)]" />
              <div className="h-4 w-full max-w-md animate-pulse rounded bg-[var(--ui-hover-wash)]" />
              <div className="mt-3 h-9 w-36 animate-pulse rounded-lg bg-[var(--ui-hover-wash)]" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="h-4 w-28 animate-pulse rounded bg-[var(--ui-hover-wash)]" />
            <div className="h-20 w-full animate-pulse rounded-[var(--radius-md)] bg-[var(--ui-hover-wash)]" />
          </div>
        </main>
      </div>
    </div>
  );
}
