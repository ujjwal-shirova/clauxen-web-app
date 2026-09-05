export function AppRouteLoadingShell({
  label,
}: {
  label: string;
}) {
  return (
    <div
      className="app-page-surface flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-[var(--app-panel-bg)]"
      aria-busy="true"
      aria-label={label}
    >
      <div className="h-14 shrink-0 border-b border-[var(--ui-border-subtle)] px-4 sm:px-6">
        <div className="mt-5 h-7 w-40 rounded-lg bg-[var(--ui-hover-wash)]" />
      </div>
      <div className="flex-1 px-4 pt-6 sm:px-6">
        <div className="mx-auto grid max-w-[880px] grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="h-36 rounded-2xl bg-[var(--ui-hover-wash)]"
            />
          ))}
        </div>
      </div>
    </div>
  );
}