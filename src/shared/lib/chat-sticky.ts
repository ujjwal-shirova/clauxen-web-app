/**
 * Chat sticky docking for the live turn.
 *
 * Rules:
 * - Only one turn elevates its sticky user bubble at a time.
 * - Code/table headers stick via CSS using each turn's `--turn-user-msg-height`
 *   (no JS pin attributes required for docking offsets).
 * - While generating and near the bottom, always prefer the latest turn so
 *   streamed code/table headers dock under the current user bubble immediately.
 * - The turn being edited always wins elevation so the editor never slides
 *   under another turn's docked chrome.
 */

export const STICKY_GAP_PX = 8;

export function readHeaderHeightPx(from?: Element | null): number {
  const scope =
    from?.closest("[data-chat-active], [data-chat-streaming]") ??
    document.documentElement;
  const styles = getComputedStyle(scope);
  const candidates = [
    styles.getPropertyValue("--chat-header-height"),
    styles.getPropertyValue("--header-height"),
  ];
  for (const raw of candidates) {
    const parsed = parseFloat(raw);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return 40;
}

/** Sticky top offset shared by CSS (`top: header + gap`) and stuck detection. */
export function readStickyTopPx(from?: Element | null): number {
  return readHeaderHeightPx(from) + STICKY_GAP_PX;
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

function editingTurnIndex(viewport: HTMLElement): number | null {
  const editor = viewport.querySelector<HTMLElement>(
    "[data-user-message-editing]",
  );
  if (!editor) return null;
  const turn = editor.closest<HTMLElement>("[data-conversation-turn]");
  if (!turn) return null;
  const index = Number(turn.dataset.turnIndex);
  return Number.isNaN(index) ? null : index;
}

export function resolveActiveStickyTurnIndex(
  viewport: HTMLElement,
  turnCount: number,
  isGenerating: boolean,
): number {
  if (turnCount <= 0) return 0;

  const editingIndex = editingTurnIndex(viewport);
  if (editingIndex !== null) return editingIndex;

  const stickyY =
    viewport.getBoundingClientRect().top + readStickyTopPx(viewport);
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

/** Carries the previously elevated turn across syncs so each pass only
 * touches the turns that can actually change (previous + current). */
export type StickySyncCache = {
  activeIndex: number | null;
  turnCount: number;
};

export function createStickySyncCache(): StickySyncCache {
  return { activeIndex: null, turnCount: 0 };
}

function turnElement(
  viewport: HTMLElement,
  index: number,
): HTMLElement | null {
  return viewport.querySelector<HTMLElement>(
    `[data-conversation-turn][data-turn-index="${index}"]`,
  );
}

function setTurnStickyActive(turn: HTMLElement | null, active: boolean) {
  if (!turn) return;
  const nextAttr = active ? "true" : "false";
  if (turn.dataset.stickyActive !== nextAttr) {
    turn.dataset.stickyActive = nextAttr;
  }
}

function removeStuck(turn: HTMLElement | null) {
  const host = turn?.querySelector<HTMLElement>("[data-sticky-user-msg]");
  if (host?.classList.contains("sticky-user-msg--stuck")) {
    host.classList.remove("sticky-user-msg--stuck");
  }
}

function syncTurnStuckState(
  turn: HTMLElement | null,
  stickyLineY: number,
) {
  const host = turn?.querySelector<HTMLElement>("[data-sticky-user-msg]");
  if (!host) return;
  const sentinel = turn?.querySelector<HTMLElement>(
    ".sticky-user-msg-sentinel",
  );
  if (!sentinel) {
    removeStuck(turn);
    return;
  }

  const sentinelBottom = sentinel.getBoundingClientRect().bottom;
  const userTop = host.getBoundingClientRect().top;
  // Wider slop absorbs subpixel drift from the padded sticky host and the
  // expanded editor without flickering at the dock boundary.
  const pinSlop = host.dataset.userMsgEditing === "true" ? 6 : 3.5;
  const isPinned = Math.abs(userTop - stickyLineY) < pinSlop;
  const shouldStuck = isPinned && sentinelBottom < stickyLineY - 1;

  if (host.classList.contains("sticky-user-msg--stuck") !== shouldStuck) {
    host.classList.toggle("sticky-user-msg--stuck", shouldStuck);
  }
}

/** Imperative sticky sync — never triggers React re-renders during scroll. */
export function syncStickyUserMessages(
  viewport: HTMLElement,
  turnCount: number,
  isGenerating: boolean,
  cache?: StickySyncCache,
) {
  const activeIndex = resolveActiveStickyTurnIndex(
    viewport,
    turnCount,
    isGenerating,
  );
  const stickyLineY =
    viewport.getBoundingClientRect().top + readStickyTopPx(viewport);

  const prevIndex = cache?.activeIndex ?? null;
  const turnsChanged = !cache || cache.turnCount !== turnCount;

  if (cache) {
    cache.activeIndex = activeIndex;
    cache.turnCount = turnCount;
  }

  // Only the previously active turn can hold stale elevation — every other
  // turn is already inactive. When the turn list itself changed (new message,
  // branch switch), fall back to a full pass so late-mounted turns settle.
  if (!turnsChanged && prevIndex !== null && prevIndex !== activeIndex) {
    const prevTurn = turnElement(viewport, prevIndex);
    setTurnStickyActive(prevTurn, false);
    removeStuck(prevTurn);
  } else if (turnsChanged || prevIndex === null) {
    viewport
      .querySelectorAll<HTMLElement>("[data-conversation-turn]")
      .forEach((turn) => {
        const index = Number(turn.dataset.turnIndex);
        if (Number.isNaN(index)) return;
        setTurnStickyActive(turn, index === activeIndex);
        if (index !== activeIndex) removeStuck(turn);
      });
  }

  const activeTurn = turnElement(viewport, activeIndex);
  setTurnStickyActive(activeTurn, true);
  syncTurnStuckState(activeTurn, stickyLineY);
}
