"use client";

import { useEffect } from "react";

/**
 * App-wide: make overflow containers scroll on hover/wheel without requiring
 * a prior click to "activate" them. Body/html are overflow:hidden, so all
 * scrolling is nested — macOS/Electron often won't wheel-scroll an unfocused
 * nested scroller.
 */

const SCROLL_HOST_SELECTOR = [
  "[data-scroll-region]",
  "[data-radix-scroll-area-viewport]",
  ".overflow-y-auto",
  ".overflow-x-auto",
  ".overflow-auto",
].join(",");

function overflowAllowsScroll(value: string): boolean {
  return value === "auto" || value === "scroll" || value === "overlay";
}

function isScrollableHost(el: HTMLElement): boolean {
  const style = window.getComputedStyle(el);
  const canY =
    overflowAllowsScroll(style.overflowY) &&
    el.scrollHeight > el.clientHeight + 1;
  const canX =
    overflowAllowsScroll(style.overflowX) &&
    el.scrollWidth > el.clientWidth + 1;
  return canY || canX;
}

function findScrollHost(start: EventTarget | null): HTMLElement | null {
  if (!(start instanceof Element)) return null;
  let node: Element | null = start;
  while (node && node !== document.documentElement) {
    if (node instanceof HTMLElement) {
      if (node.matches(SCROLL_HOST_SELECTOR) && isScrollableHost(node)) {
        return node;
      }
      // Radix ScrollArea root → prefer its viewport child.
      const viewport = node.querySelector<HTMLElement>(
        "[data-radix-scroll-area-viewport]",
      );
      if (viewport && isScrollableHost(viewport)) {
        return viewport;
      }
    }
    node = node.parentElement;
  }
  return null;
}

function isEditableTarget(el: Element | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (el.isContentEditable) return true;
  return Boolean(el.closest("input, textarea, select, [contenteditable='true']"));
}

export function HoverScrollEnabler() {
  useEffect(() => {
    const activate = (event: Event) => {
      const host = findScrollHost(event.target);
      if (!host) return;
      if (host.tabIndex < 0) {
        host.tabIndex = -1;
      }
      if (document.activeElement === host) return;
      if (isEditableTarget(document.activeElement)) return;
      host.focus({ preventScroll: true });
    };

    const onWheel = (event: WheelEvent) => {
      if (event.defaultPrevented || event.ctrlKey) return;
      const host = findScrollHost(event.target);
      if (!host) return;

      // Prefer native scrolling when the host (or a descendant) already has focus.
      if (
        document.activeElement === host ||
        (document.activeElement instanceof Node &&
          host.contains(document.activeElement) &&
          !isEditableTarget(document.activeElement))
      ) {
        return;
      }

      const { deltaX, deltaY } = event;
      if (deltaX === 0 && deltaY === 0) return;

      let applied = false;
      if (Math.abs(deltaY) >= Math.abs(deltaX)) {
        const before = host.scrollTop;
        host.scrollTop = before + deltaY;
        applied = host.scrollTop !== before;
      } else {
        const before = host.scrollLeft;
        host.scrollLeft = before + deltaX;
        applied = host.scrollLeft !== before;
      }

      if (applied) {
        event.preventDefault();
        // Keep this host active for subsequent wheel inertia.
        if (host.tabIndex < 0) host.tabIndex = -1;
        if (!isEditableTarget(document.activeElement)) {
          host.focus({ preventScroll: true });
        }
      }
    };

    document.addEventListener("pointerover", activate, true);
    document.addEventListener("wheel", onWheel, {
      capture: true,
      passive: false,
    });

    return () => {
      document.removeEventListener("pointerover", activate, true);
      document.removeEventListener("wheel", onWheel, true);
    };
  }, []);

  return null;
}
