export default function PluginsLoading() {
  return (
    <div className="app-page-surface flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden">
      <div className="flex h-14 shrink-0 items-center justify-center border-b border-[var(--ui-border-subtle)] bg-[var(--app-panel-bg)]">
        <div className="h-8 w-44 rounded-full bg-[var(--skeleton-base)]" />
      </div>
      <main className="mx-auto flex w-full max-w-[1120px] flex-1 flex-col gap-5 px-5 py-7 sm:px-8">
        <div className="rounded-[24px] border border-[var(--ui-border-subtle)] bg-[var(--app-panel-bg)] p-5 sm:p-6">
          <div className="h-6 w-36 rounded-md bg-[var(--skeleton-base)]" />
          <div className="mt-2 h-4 w-72 max-w-full rounded bg-[var(--skeleton-base)]" />
          <div className="mt-5 h-11 w-full rounded-xl bg-[var(--skeleton-base)] sm:w-[360px]" />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, index) => (
            <div
              key={index}
              className="h-[92px] rounded-2xl border border-[var(--ui-border-subtle)] bg-[var(--app-panel-bg)]"
            />
          ))}
        </div>
      </main>
    </div>
  );
}
