export default function PluginsLoading() {
  return (
    <div
      className="app-page-surface flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-[var(--app-panel-bg)]"
      aria-busy="true"
      aria-label="Loading plugins"
    >
      <div className="h-12 shrink-0 border-b border-zinc-200/70 px-4" />
      <div className="mx-auto grid w-full max-w-[1120px] grid-cols-1 gap-3 px-4 pt-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="h-40 rounded-2xl bg-[var(--ui-hover-wash)]"
          />
        ))}
      </div>
    </div>
  );
}