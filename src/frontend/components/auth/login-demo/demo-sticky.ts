/**
 * Demo-only sticky pin sync for the login product animation.
 * Mirrors main-app chat-sticky docking without importing chat hooks —
 * keeps the animation isolated.
 */

function readDemoHeaderHeightPx(viewport: HTMLElement): number {
  const scope =
    viewport.closest(".login-demo-stage") ?? document.documentElement;
  const parsed = parseFloat(
    getComputedStyle(scope).getPropertyValue("--header-height"),
  );
  return Number.isFinite(parsed) ? parsed : 0;
}

function resolveActiveDemoTurnIndex(viewport: HTMLElement): number {
  const turns = viewport.querySelectorAll<HTMLElement>(
    "[data-conversation-turn]",
  );
  if (turns.length === 0) return 0;

  const stickyY =
    viewport.getBoundingClientRect().top + readDemoHeaderHeightPx(viewport);

  const maxTop = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
  const nearBottom = maxTop > 48 && maxTop - viewport.scrollTop <= 220;
  if (nearBottom) {
    return Math.max(0, turns.length - 1);
  }

  for (let i = turns.length - 1; i >= 0; i--) {
    const el = turns[i]!;
    const index = Number(el.dataset.turnIndex);
    if (Number.isNaN(index)) continue;
    const rect = el.getBoundingClientRect();
    if (rect.top <= stickyY + 1 && rect.bottom > stickyY + 1) {
      return index;
    }
  }

  for (let i = 0; i < turns.length; i++) {
    const el = turns[i]!;
    const index = Number(el.dataset.turnIndex);
    if (Number.isNaN(index)) continue;
    if (el.getBoundingClientRect().bottom > stickyY + 1) {
      return index;
    }
  }

  return Math.max(0, turns.length - 1);
}

/** Pin the active user bubble. Code/table headers dock via CSS turn vars. */
export function syncDemoStickyPins(viewport: HTMLElement | null | undefined) {
  if (!viewport) return;

  const activeIndex = resolveActiveDemoTurnIndex(viewport);
  const stickyLineY =
    viewport.getBoundingClientRect().top + readDemoHeaderHeightPx(viewport);

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

      if (index !== activeIndex) {
        el.classList.remove("sticky-user-msg--stuck");
        return;
      }

      const sentinel = turn?.querySelector<HTMLElement>(
        ".sticky-user-msg-sentinel",
      );
      if (!sentinel) {
        el.classList.remove("sticky-user-msg--stuck");
        return;
      }

      const sentinelBottom = sentinel.getBoundingClientRect().bottom;
      const userTop = el.getBoundingClientRect().top;
      const isPinned = Math.abs(userTop - stickyLineY) < 2;
      const shouldStuck = isPinned && sentinelBottom < stickyLineY;
      el.classList.toggle("sticky-user-msg--stuck", shouldStuck);
    });
}
