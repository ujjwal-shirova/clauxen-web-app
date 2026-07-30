/**
 * While set, chat ResizeObserver must not pin-follow to bottom — used when the
 * user expands/collapses agent folds so content grows downward instead of
 * yanking the user message upward.
 */
export const CHAT_SCROLL_ANCHOR_LOCK_ATTR = "data-chat-scroll-anchor-lock";

/** Keep the lock through the CSS expand/collapse transition (~200ms). */
const ANCHOR_LOCK_MS = 240;

export function isChatScrollAnchorLockActive(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.hasAttribute(CHAT_SCROLL_ANCHOR_LOCK_ATTR);
}

function resolveScrollViewport(from: HTMLElement): HTMLElement | null {
  return from.closest(
    "[data-radix-scroll-area-viewport]",
  ) as HTMLElement | null;
}

/**
 * Run a layout-changing toggle while keeping `anchor` visually fixed so the
 * expanded body grows downward (and collapse doesn't jump the thread up).
 * Re-corrects through the CSS grid-row transition, not only one frame.
 */
export function preserveScrollAnchorOnToggle(
  anchor: HTMLElement | null,
  apply: () => void,
): void {
  if (!anchor) {
    apply();
    return;
  }

  const viewport = resolveScrollViewport(anchor);
  const beforeTop = anchor.getBoundingClientRect().top;
  document.documentElement.setAttribute(CHAT_SCROLL_ANCHOR_LOCK_ATTR, "1");
  apply();

  const unlock = () => {
    document.documentElement.removeAttribute(CHAT_SCROLL_ANCHOR_LOCK_ATTR);
  };

  const correct = () => {
    if (!viewport || !anchor.isConnected) return;
    const afterTop = anchor.getBoundingClientRect().top;
    const delta = afterTop - beforeTop;
    if (Math.abs(delta) > 0.5) {
      viewport.scrollTop += delta;
    }
  };

  // Immediate + double-rAF for React commit, then keep correcting while
  // grid-template-rows animates so expansion always grows toward the bottom.
  correct();
  const startedAt = performance.now();
  const tick = () => {
    correct();
    if (performance.now() - startedAt < ANCHOR_LOCK_MS) {
      requestAnimationFrame(tick);
      return;
    }
    unlock();
  };
  requestAnimationFrame(() => {
    requestAnimationFrame(tick);
  });
}
