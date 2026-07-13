import { MessageSkeleton } from "@/frontend/components/message-skeleton";

/**
 * Lightweight first-paint shell for /new and /c/[chatId] while ChatView hydrates.
 * Avoids blank Suspense fallbacks that tank LCP / perceived speed.
 */
export function ChatRouteSkeleton() {
  return (
    <div
      className="flex h-full min-h-0 w-full flex-1 flex-col"
      aria-busy="true"
      aria-label="Loading chat"
    >
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 pt-10 sm:px-6">
        <MessageSkeleton />
        <MessageSkeleton />
      </div>
      <div className="mx-auto w-full max-w-3xl px-4 pb-6 sm:px-6">
        <div className="h-14 w-full rounded-[18px] bg-zinc-100 shimmer-bg" />
      </div>
    </div>
  );
}

/**
 * Auth-gate placeholder shown before identity resolves — matches app shell bg
 * so FCP is not a pure white void.
 */
export function MainShellSkeleton() {
  return (
    <div
      className="flex min-h-[100dvh] w-full bg-[var(--app-shell-bg)]"
      aria-busy="true"
      aria-label="Loading app"
    >
      <aside className="hidden w-[260px] shrink-0 border-r border-zinc-200/80 bg-white p-3 md:block">
        <div className="mb-4 h-8 w-28 rounded-md bg-zinc-100 shimmer-bg" />
        <div className="space-y-2">
          <div className="h-9 w-full rounded-md bg-zinc-100 shimmer-bg" />
          <div className="h-9 w-full rounded-md bg-zinc-100 shimmer-bg" />
          <div className="h-9 w-5/6 rounded-md bg-zinc-100 shimmer-bg" />
        </div>
      </aside>
      <main className="min-w-0 flex-1 bg-white">
        <ChatRouteSkeleton />
      </main>
    </div>
  );
}
