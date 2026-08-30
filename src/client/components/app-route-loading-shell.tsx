export function AppRouteLoadingShell({
  label,
  title,
  rows = 5,
}: {
  label: string;
  title: string;
  rows?: number;
}) {
  return (
    <div
      className="app-page-surface flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-[var(--app-panel-bg)]"
      aria-busy="true"
      aria-label={label}
    >
      <header className="shrink-0 border-b border-[var(--ui-border-subtle)] px-5 py-5 sm:px-8">
        <div className="mx-auto w-full max-w-[1120px]">
          <h1 className="text-[20px] font-semibold tracking-[-0.02em] text-[var(--ui-fg)]">
            {title}
          </h1>
          <div className="mt-2 h-3.5 w-64 max-w-full rounded bg-[var(--skeleton-base)]" />
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1120px] flex-1 px-5 py-5 sm:px-8">
        <div className="grid gap-2.5">
          {Array.from({ length: rows }).map((_, index) => (
            <div
              key={index}
              className="h-[68px] rounded-2xl border border-[var(--ui-border-subtle)] bg-[var(--app-frame-bg)]"
            />
          ))}
        </div>
      </main>
    </div>
  );
}
