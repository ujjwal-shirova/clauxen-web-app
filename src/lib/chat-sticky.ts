/**
 * Chat sticky docking — ChatGPT/Claude-style.
 *
 * Rules:
 * - Only one turn elevates its sticky user bubble at a time.
 * - Code/table headers stick via CSS using each turn's `--turn-user-msg-height`
 *   (no JS pin attributes required for docking offsets).
 * - While generating and near the bottom, always prefer the latest turn so
 *   streamed code/table headers dock under the current user bubble immediately.
 */

export function readHeaderHeightPx(from?: Element | null): number {
  const scope =
    from?.closest(
      "[data-chat-active], [data-chat-streaming]",
    ) ?? document.documentElement;
  const raw = getComputedStyle(scope).getPropertyValue("--header-height");
  const parsed = parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : 35;
}

/** Distance-from-bottom under which we force the latest turn as sticky. */
export const STICKY_NEAR_BOTTOM_PX = 220;
/** Wider while streaming — eased follow often lags the true bottom. */
export const STICKY_NEAR_BOTTOM_STREAMING_PX = 360;

/** Pure helper — unit-tested without a DOM. */
export function shouldPinLatestStickyTurn(
  scrollTop: number,
  scrollHeight: number,
  clientHeight: number,
  isGenerating: boolean,
): boolean {
  const maxTop = Math.max(0, scrollHeight - clientHeight);
  const threshold = isGenerating
    ? STICKY_NEAR_BOTTOM_STREAMING_PX
    : STICKY_NEAR_BOTTOM_PX;
  return maxTop > 48 && maxTop - scrollTop <= threshold;
}

export function resolveActiveStickyTurnIndex(
  viewport: HTMLElement,
  turnCount: number,
  isGenerating: boolean,
): number {
  if (turnCount <= 0) return 0;

  const stickyY =
    viewport.getBoundingClientRect().top + readHeaderHeightPx(viewport);
  const turns = viewport.querySelectorAll<HTMLElement>(
    "[data-conversation-turn]",
  );

  // Stream-follow + resting at bottom: always pin the latest turn so code/table
  // headers dock under the current user bubble as soon as they mount.
  // While generating with the user scrolled up, nearBottom is false and we
  // fall through to spanning resolution below.
  if (
    shouldPinLatestStickyTurn(
      viewport.scrollTop,
      viewport.scrollHeight,
      viewport.clientHeight,
      isGenerating,
    )
  ) {
    return Math.max(0, turnCount - 1);
  }
  let next = Math.max(0, turnCount - 1);
  let foundSpanning = false;

  for (let i = turns.length - 1; i >= 0; i--) {
    const el = turns[i];
    const index = Number(el.dataset.turnIndex);
    if (Number.isNaN(index)) continue;

    const rect = el.getBoundingClientRect();
    if (rect.top <= stickyY + 1 && rect.bottom > stickyY + 1) {
      next = index;
      foundSpanning = true;
      break;
    }
  }

  if (!foundSpanning) {
    for (let i = 0; i < turns.length; i++) {
      const el = turns[i];
      const index = Number(el.dataset.turnIndex);
      if (Number.isNaN(index)) continue;

      if (el.getBoundingClientRect().bottom > stickyY + 1) {
        next = index;
        break;
      }
    }
  }

  return next;
}

/** Imperative sticky sync — never triggers React re-renders during scroll. */
export function syncStickyUserMessages(
  viewport: HTMLElement,
  turnCount: number,
  isGenerating: boolean,
) {
  const activeIndex = resolveActiveStickyTurnIndex(
    viewport,
    turnCount,
    isGenerating,
  );
  const stickyLineY =
    viewport.getBoundingClientRect().top + readHeaderHeightPx(viewport);

  viewport
    .querySelectorAll<HTMLElement>("[data-conversation-turn]")
    .forEach((turn) => {
      const index = Number(turn.dataset.turnIndex);
      if (Number.isNaN(index)) return;

      const nextAttr = index === activeIndex ? "true" : "false";
      if (turn.dataset.stickyActive !== nextAttr) {
        turn.dataset.stickyActive = nextAttr;
      }
    });

  viewport
    .querySelectorAll<HTMLElement>("[data-sticky-user-msg]")
    .forEach((el) => {
      const turn = el.closest<HTMLElement>("[data-conversation-turn]");
      const index = Number(turn?.dataset.turnIndex);
      if (Number.isNaN(index)) return;

      const isActive = index === activeIndex;

      if (!isActive) {
        if (el.classList.contains("sticky-user-msg--stuck")) {
          el.classList.remove("sticky-user-msg--stuck");
        }
        return;
      }

      const sentinel = turn?.querySelector<HTMLElement>(
        ".sticky-user-msg-sentinel",
      );
      if (!sentinel) {
        if (el.classList.contains("sticky-user-msg--stuck")) {
          el.classList.remove("sticky-user-msg--stuck");
        }
        return;
      }

      const sentinelBottom = sentinel.getBoundingClientRect().bottom;
      const userTop = el.getBoundingClientRect().top;
      // Slightly wider pin slop while editing — expanded host has more subpixel drift.
      const pinSlop = el.dataset.userMsgEditing === "true" ? 4 : 2;
      const isPinned = Math.abs(userTop - stickyLineY) < pinSlop;
      const shouldStuck = isPinned && sentinelBottom < stickyLineY;

      if (el.classList.contains("sticky-user-msg--stuck") !== shouldStuck) {
        el.classList.toggle("sticky-user-msg--stuck", shouldStuck);
      }
    });
}
