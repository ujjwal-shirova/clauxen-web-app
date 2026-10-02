/**
 * Streaming skeleton for /plugins/[slug] — paints the page structure while
 * the (static) plugin payload arrives, so opening a plugin never shows a
 * blank surface.
 */
export default function PluginInfoLoading() {
  return (
    <div
      className="plugin-marketplace relative flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-[var(--app-panel-bg)] font-sans"
      role="status"
      aria-label="Loading plugin details"
    >
      <div className="app-scrollbar min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[780px] px-4 pb-16 sm:px-6">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 pt-5">
            <div className="h-3 w-12 animate-pulse rounded bg-[var(--ui-muted-surface)]" />
            <div className="h-3 w-24 animate-pulse rounded bg-[var(--ui-muted-surface)]" />
          </div>

          {/* Header */}
          <header className="pt-6">
            <div className="flex items-start gap-4">
              <div className="size-16 shrink-0 animate-pulse rounded-[10px] bg-[var(--ui-muted-surface)]" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-4 w-40 animate-pulse rounded bg-[var(--ui-muted-surface)]" />
                <div className="h-3 w-full max-w-md animate-pulse rounded bg-[var(--ui-muted-surface)]" />
                <div className="h-3 w-52 animate-pulse rounded bg-[var(--ui-muted-surface)]" />
              </div>
              <div className="hidden shrink-0 items-center gap-2 sm:flex">
                <div className="h-8 w-16 animate-pulse rounded-lg bg-[var(--ui-muted-surface)]" />
                <div className="h-8 w-24 animate-pulse rounded-lg bg-[var(--ui-muted-surface)]" />
              </div>
            </div>
          </header>

          {/* Capability sections */}
          <div className="mt-8 flex flex-col gap-7">
            {[0, 1, 2].map((section) => (
              <div key={section} className="space-y-2">
                <div className="h-3 w-20 animate-pulse rounded bg-[var(--ui-muted-surface)]" />
                <div className="overflow-hidden rounded-xl border border-[var(--ui-border)] bg-white">
                  {[0, 1, 2].map((row) => (
                    <div
                      key={row}
                      className="flex items-center gap-3 border-b border-[var(--ui-border-subtle)] px-3 py-2.5 last:border-b-0"
                    >
                      <div className="size-7 shrink-0 animate-pulse rounded-lg bg-[var(--ui-muted-surface)]" />
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="h-3 w-1/3 animate-pulse rounded bg-[var(--ui-muted-surface)]" />
                        <div className="h-3 w-2/3 animate-pulse rounded bg-[var(--ui-muted-surface)]" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
