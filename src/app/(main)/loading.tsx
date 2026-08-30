/**
 * Soft loading fallback inside the main panel during RSC transitions.
 * Does not render outer shell or sidebar chrome (MainLayout already provides those).
 */
export default function MainLoading() {
  return (
    <div className="app-page-surface flex h-full w-full min-h-0 flex-1 flex-col overflow-hidden">
      <div className="h-14 shrink-0 border-b border-[var(--ui-border-subtle)] bg-[var(--app-panel-bg)]" />
      <div className="mx-auto flex w-full max-w-[1120px] flex-1 flex-col gap-4 px-5 py-7 sm:px-8">
        <div className="h-8 w-48 rounded-lg bg-[var(--skeleton-base)]" />
        <div className="h-4 w-72 max-w-full rounded bg-[var(--skeleton-base)]" />
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="h-24 rounded-2xl border border-[var(--ui-border-subtle)] bg-[var(--app-panel-bg)]"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
