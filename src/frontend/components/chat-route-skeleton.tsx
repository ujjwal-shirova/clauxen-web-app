/**
 * First-paint shells for auth gate / route hydrate.
 * Show real chrome (sidebar + composer) immediately — never a full-window shimmer.
 */

/** Lightweight composer chrome — matches the real prompt bar silhouette. */
function ComposerChrome() {
  return (
    <div className="mx-auto w-full max-w-[768px] px-4 pb-6 sm:px-5">
      <div
        className="flex h-14 w-full items-center rounded-[20px] border border-zinc-200/90 bg-white px-4 shadow-[0_1px_2px_rgba(24,24,27,0.04)] sm:h-[56px]"
        aria-hidden
      >
        <div className="h-2.5 w-28 rounded-full bg-zinc-100" />
      </div>
    </div>
  );
}

/** Static sidebar chrome — real labels, no shimmer bars. */
function SidebarChrome() {
  return (
    <aside
      className="hidden w-[256px] shrink-0 flex-col border-r border-zinc-200/80 bg-[var(--app-shell-bg)] px-3 py-3.5 md:flex"
      aria-hidden
    >
      <div className="mb-3 px-2.5 text-[15px] font-semibold tracking-[-0.02em] text-zinc-900">
        Clauxen
      </div>
      <div className="mb-4 rounded-[10px] px-2.5 py-2 text-[13px] font-medium text-zinc-700">
        New chat
      </div>
      <div className="flex flex-col gap-0.5 px-1 text-[13px] text-zinc-500">
        <div className="rounded-[8px] px-2.5 py-2">Library</div>
        <div className="rounded-[8px] px-2.5 py-2">My Clauxen</div>
        <div className="rounded-[8px] px-2.5 py-2">More</div>
      </div>
      <div className="mt-auto px-2.5 pt-4 text-[12px] text-zinc-400">Account</div>
    </aside>
  );
}

/**
 * Route hydrate shell for /new and /c/[chatId].
 * Empty transcript area + real composer silhouette (no message shimmer).
 */
export function ChatRouteSkeleton() {
  return (
    <div
      className="flex h-full min-h-0 w-full flex-1 flex-col bg-white"
      aria-busy="true"
      aria-label="Loading chat"
    >
      <div className="min-h-0 flex-1" />
      <ComposerChrome />
    </div>
  );
}

/**
 * Auth-gate shell — real sidebar + composer chrome while identity resolves.
 * Content area stays empty (no shimmer blocks).
 */
export function MainShellSkeleton() {
  return (
    <div
      className="flex min-h-[100dvh] w-full bg-[var(--app-shell-bg)]"
      aria-busy="true"
      aria-label="Loading app"
    >
      <SidebarChrome />
      <main className="flex min-w-0 flex-1 flex-col bg-white">
        <div className="min-h-0 flex-1" />
        <ComposerChrome />
      </main>
    </div>
  );
}
