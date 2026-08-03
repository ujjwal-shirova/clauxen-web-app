/**
 * Route hydrate fallback for rare overlay redirects.
 * Matches real composer chrome — never a gray skeleton pill.
 */

/** Lightweight composer chrome — matches the real prompt bar silhouette. */
function ComposerChrome() {
  return (
    <div className="mx-auto w-full max-w-[768px] px-4 pb-6 sm:px-5">
      <div
        className="flex h-14 w-full items-center gap-2 rounded-[22px] border border-zinc-900/10 bg-white px-2.5 shadow-[0_8px_26px_-18px_rgba(24,24,27,0.22)] sm:h-[56px] sm:px-3"
        aria-hidden
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-zinc-200/80 text-zinc-400">
          <span className="text-[18px] leading-none">+</span>
        </div>
        <div className="min-w-0 flex-1 text-[14px] text-zinc-400">Ask anything</div>
        <div className="flex shrink-0 items-center gap-1">
          <div className="h-8 w-8 rounded-full border border-zinc-200/80" />
          <div className="h-8 w-8 rounded-full bg-zinc-900/40" />
        </div>
      </div>
    </div>
  );
}

/**
 * Route hydrate shell for rare redirects.
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
 * @deprecated Auth gate no longer uses a shell skeleton — real MainLayout paints immediately.
 * Kept for any leftover imports.
 */
export function MainShellSkeleton() {
  return <ChatRouteSkeleton />;
}
