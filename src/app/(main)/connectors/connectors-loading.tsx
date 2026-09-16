import { chrome } from "@/lib/app-chrome";

function CardSkeleton() {
  return (
    <div className="flex h-full animate-pulse flex-col rounded-[var(--radius-md)] border border-[var(--settings-hairline)] bg-[var(--settings-card-bg)] p-3.5">
      <div className="flex min-w-0 items-start gap-3">
        <div className="size-10 shrink-0 rounded-[10px] bg-[var(--ui-hover-wash)]" />
        <div className="min-w-0 flex-1 space-y-2 pt-0.5">
          <div className="h-3.5 w-1/2 rounded bg-[var(--ui-hover-wash)]" />
          <div className="h-3 w-full rounded bg-[var(--ui-hover-wash)]" />
        </div>
      </div>
      <div className="mt-3 flex justify-end">
        <div className="h-7 w-16 rounded-lg bg-[var(--ui-hover-wash)]" />
      </div>
    </div>
  );
}

export function ConnectorsDirectoryLoading() {
  return (
    <div className={chrome.page.surface}>
      <div className="sticky top-0 z-30 w-full shrink-0 border-b border-[var(--ui-border-subtle)] bg-[var(--app-panel-bg)]">
        <div className="mx-auto flex min-h-12 w-full max-w-[1120px] items-center px-3 sm:min-h-14 sm:px-6">
          <div className="h-4 w-24 animate-pulse rounded bg-[var(--ui-hover-wash)]" />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        <main className="mx-auto flex w-full max-w-[1120px] flex-col gap-4 px-3 pb-24 pt-4 sm:gap-5 sm:px-6 sm:pt-6">
          <div className="h-9 animate-pulse rounded-lg bg-[var(--ui-hover-wash)]" />
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-8 w-16 animate-pulse rounded-lg bg-[var(--ui-hover-wash)]"
              />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
