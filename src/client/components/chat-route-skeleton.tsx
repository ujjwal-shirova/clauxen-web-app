import { ConversationLoadingSkeleton } from "./message-skeleton";

/** Composer silhouette that matches the real prompt bar. */
function ComposerChrome() {
  return (
    <div className="mx-auto w-full max-w-[var(--chat-column-max-width,720px)] px-4 pb-6 sm:px-5">
      <div
        className="flex h-10 w-full items-center gap-1.5 rounded-[var(--prompt-radius,16px)] bg-[var(--chat-user-card-bg)] px-1.5 shadow-[var(--prompt-shadow)]"
        aria-hidden
      >
        <div className="flex size-7 shrink-0 items-center justify-center rounded-full text-[var(--ui-fg-placeholder)]">
          <span className="text-[16px] leading-none">+</span>
        </div>
        <div className="min-w-0 flex-1 text-[14px] text-[var(--ui-fg-placeholder)]">
          Ask anything
        </div>
        <div className="size-7 shrink-0 rounded-full bg-[var(--ui-fg)] opacity-25" />
      </div>
    </div>
  );
}

/** Chat route hydrate shell — shimmering transcript + composer silhouette. */
export function ChatRouteSkeleton() {
  return (
    <div
      className="flex h-full min-h-0 w-full flex-1 flex-col bg-[var(--chat-canvas-bg)]"
      aria-busy="true"
      aria-label="Loading chat"
    >
      <div className="min-h-0 flex-1 overflow-hidden">
        <ConversationLoadingSkeleton />
      </div>
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
