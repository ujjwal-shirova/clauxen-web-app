/**
 * Keyboard navigation primitives shared by the global keyboard controller:
 *
 * - editable-target detection (never hijack typing)
 * - scroll target resolution + page/line scrolling
 * - list focus movement across `[data-keynav-list]` / `[data-keynav-item]`
 *
 * Client-only helpers (call from `"use client"` modules).
 */

/** True when the event target is a text-entry surface. */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return Boolean(target.closest("[contenteditable='true']"));
}

/** Keys reserved for app navigation — never typed into the composer. */
export const RESERVED_NAV_KEYS = new Set(["j", "k", "g", "/", "?"]);

/**
 * True for the single keys the keyboard engine claims (j/k/g//?) so the
 * composer's type-to-compose passthrough leaves them alone.
 */
export function isReservedNavKeyEvent(
  event: KeyboardEvent | React.KeyboardEvent,
): boolean {
  if (event.metaKey || event.ctrlKey || event.altKey) return false;
  return RESERVED_NAV_KEYS.has(event.key.toLowerCase());
}

/** True when a modal dialog / overlay owns the keyboard. */
export function isModalOpen(): boolean {
  if (typeof document === "undefined") return false;
  return Boolean(
    document.querySelector(
      '[role="dialog"][aria-modal="true"], [data-app-overlay-surface]',
    ),
  );
}

function isVisibleItem(el: HTMLElement): boolean {
  const withCheck = el as HTMLElement & {
    checkVisibility?: (options?: {
      checkOpacity?: boolean;
      checkVisibilityCSS?: boolean;
    }) => boolean;
  };
  if (typeof withCheck.checkVisibility === "function") {
    return withCheck.checkVisibility({
      checkOpacity: true,
      checkVisibilityCSS: true,
    });
  }
  return el.offsetParent !== null;
}

function canScrollVertically(el: HTMLElement): boolean {
  const style = window.getComputedStyle(el);
  const overflowY = style.overflowY;
  const scrollable =
    overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay";
  return scrollable && el.scrollHeight - el.clientHeight > 4;
}

/** The topmost modal / overlay container, when one owns the screen. */
function topmostModalRoot(): HTMLElement | null {
  const surfaces = document.querySelectorAll<HTMLElement>(
    '[role="dialog"][aria-modal="true"], [data-app-overlay-surface]',
  );
  return surfaces[surfaces.length - 1] ?? null;
}

/**
 * Resolve the element keyboard scrolling should act on: the nearest scrollable
 * ancestor of the focused element, the active overlay's scroll region, the
 * chat viewport, or the document as a last resort.
 */
export function resolveScrollTarget(): HTMLElement {
  const active = document.activeElement;
  const modalRoot = topmostModalRoot();

  if (active instanceof HTMLElement && !isEditableTarget(active)) {
    let node: HTMLElement | null = active;
    while (node) {
      if (canScrollVertically(node)) return node;
      node = node.parentElement;
    }
  }

  const searchRoot: ParentNode = modalRoot ?? document;
  const candidates = [
    ...searchRoot.querySelectorAll<HTMLElement>(
      "[data-keynav-scroll], [data-radix-scroll-area-viewport], [data-app-main-surface], main",
    ),
  ];
  for (const el of candidates) {
    if (canScrollVertically(el)) return el;
  }

  return (document.scrollingElement as HTMLElement) ?? document.body;
}

export function scrollByLines(lines: number): void {
  const target = resolveScrollTarget();
  target.scrollBy({ top: lines * 48, behavior: "smooth" });
}

export function scrollByPage(direction: 1 | -1): void {
  const target = resolveScrollTarget();
  const delta = Math.max(120, target.clientHeight * 0.86) * direction;
  target.scrollBy({ top: delta, behavior: "smooth" });
}

export function scrollToEdge(edge: "top" | "bottom"): void {
  const target = resolveScrollTarget();
  target.scrollTo({
    top: edge === "top" ? 0 : target.scrollHeight,
    behavior: "smooth",
  });
}

/* ------------------------------------------------------------------ */
/* List focus movement                                                  */
/* ------------------------------------------------------------------ */

function visibleItems(list: HTMLElement): HTMLElement[] {
  return Array.from(
    list.querySelectorAll<HTMLElement>("[data-keynav-item]"),
  ).filter((el) => isVisibleItem(el) || el === document.activeElement);
}

function nearestList(): HTMLElement | null {
  const active = document.activeElement;
  if (active instanceof HTMLElement) {
    const list = active.closest<HTMLElement>("[data-keynav-list]");
    if (list) return list;
  }
  return null;
}

/** The list that should receive j/k when nothing else is focused. */
function defaultList(): HTMLElement | null {
  return document.querySelector<HTMLElement>(
    "[data-keynav-list][data-keynav-default]",
  );
}

/**
 * Move keyboard focus within a list of `[data-keynav-item]` elements.
 * Returns true when the event was handled.
 */
export function moveListFocus(direction: 1 | -1): boolean {
  const list = nearestList() ?? defaultList();
  if (!list) return false;
  const items = visibleItems(list);
  if (items.length === 0) return false;

  const active = document.activeElement;
  const currentIndex = items.findIndex(
    (el) => el === active || el.contains(active),
  );
  let nextIndex: number;
  if (currentIndex === -1) {
    nextIndex = direction === 1 ? 0 : items.length - 1;
  } else {
    nextIndex = Math.min(items.length - 1, Math.max(0, currentIndex + direction));
    if (nextIndex === currentIndex) return true; // already at the edge
  }
  const next = items[nextIndex];
  next.focus({ preventScroll: true });
  next.scrollIntoView({ block: "nearest" });
  return true;
}

/** Focus the first item of the default list (used by `j` / `k` from the top). */
export function focusDefaultList(): boolean {
  const list = defaultList();
  if (!list) return false;
  const items = visibleItems(list);
  if (items.length === 0) return false;
  const first = items[0];
  first.focus({ preventScroll: true });
  first.scrollIntoView({ block: "nearest" });
  return true;
}

/** Click the copy button of the most recent code block, if any. */
export function copyLastCodeBlock(): boolean {
  const buttons = Array.from(
    document.querySelectorAll<HTMLButtonElement>("[data-code-copy-button]"),
  );
  const button = buttons[buttons.length - 1];
  if (!button) return false;
  button.click();
  return true;
}
