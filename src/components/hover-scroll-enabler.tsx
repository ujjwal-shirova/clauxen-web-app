"use client";

import { useEffect } from "react";

/**
 * App-wide nested scrolling under html/body { overflow: hidden }.
 * Primes overflow hosts on mount and routes wheel/trackpad deltas to the
 * nearest scrollable ancestor — without focusing hosts (avoids blue focus rings).
 */

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

function prepareScrollHost(el: HTMLElement) {
  if (el.dataset.scrollReady === "1") return;
  el.dataset.scrollReady = "1";
  el.style.setProperty("overscroll-behavior", "contain");
  el.style.setProperty("-webkit-overflow-scrolling", "touch");
  el.style.setProperty("outline", "none");
}

function findScrollHost(start: EventTarget | null): HTMLElement | null {
  if (!(start instanceof Element)) return null;
  let node: Element | null = start;
  while (node && node !== document.documentElement) {
    if (node instanceof HTMLElement) {
      const viewport = node.matches("[data-radix-scroll-area-viewport]")
        ? node
        : node.querySelector<HTMLElement>(
            ":scope > [data-radix-scroll-area-viewport]",
          );
      if (viewport && isScrollableHost(viewport)) {
        prepareScrollHost(viewport);
        return viewport;
      }
      if (isScrollableHost(node)) {
        prepareScrollHost(node);
        return node;
      }
    }
    node = node.parentElement;
  }
  return null;
}

function scanAndPrepareScrollHosts(root: ParentNode = document) {
  const candidates = root.querySelectorAll<HTMLElement>(
    [
      "[data-scroll-region]",
      "[data-radix-scroll-area-viewport]",
      ".overflow-y-auto",
      ".overflow-x-auto",
      ".overflow-auto",
      ".app-scrollbar",
      ".sidebar-scrollable",
    ].join(","),
  );
  for (const el of candidates) {
    if (isScrollableHost(el) || el.hasAttribute("data-scroll-region")) {
      prepareScrollHost(el);
    }
  }
}

export function HoverScrollEnabler() {
  useEffect(() => {
    scanAndPrepareScrollHosts();

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (!(node instanceof HTMLElement)) continue;
          if (
            node.matches?.(
              "[data-scroll-region], .overflow-y-auto, .overflow-auto, .sidebar-scrollable, [data-radix-scroll-area-viewport]",
            )
          ) {
            prepareScrollHost(node);
          }
          scanAndPrepareScrollHosts(node);
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    const timers = [0, 120, 400, 1000].map((ms) =>
      window.setTimeout(() => scanAndPrepareScrollHosts(), ms),
    );

    const onWheel = (event: WheelEvent) => {
      if (event.defaultPrevented || event.ctrlKey) return;
      const host = findScrollHost(event.target);
      if (!host) return;

      const { deltaX, deltaY } = event;
      if (deltaX === 0 && deltaY === 0) return;

      let applied = false;
      if (Math.abs(deltaY) >= Math.abs(deltaX)) {
        const before = host.scrollTop;
        const max = host.scrollHeight - host.clientHeight;
        const next = Math.max(0, Math.min(max, before + deltaY));
        if (next !== before) {
          host.scrollTop = next;
          applied = true;
        }
      } else {
        const before = host.scrollLeft;
        const max = host.scrollWidth - host.clientWidth;
        const next = Math.max(0, Math.min(max, before + deltaX));
        if (next !== before) {
          host.scrollLeft = next;
          applied = true;
        }
      }

      if (applied) event.preventDefault();
    };

    document.addEventListener("wheel", onWheel, {
      capture: true,
      passive: false,
    });

    return () => {
      observer.disconnect();
      for (const id of timers) window.clearTimeout(id);
      document.removeEventListener("wheel", onWheel, true);
    };
  }, []);

  return null;
}
