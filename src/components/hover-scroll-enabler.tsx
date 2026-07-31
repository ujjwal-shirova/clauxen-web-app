"use client";

import { useEffect } from "react";
import {
  markScrollHostPrepared,
  resolveWheelScrollTarget,
  scrollHostAxes,
} from "@/lib/nested-scroll";

/**
 * App-wide nested scrolling under html/body { overflow: hidden }.
 *
 * Routes wheel/trackpad deltas to the nearest ancestor that can actually
 * consume them **on that axis, in that direction**. Horizontal-only hosts
 * (code blocks, tables) therefore never swallow a vertical page scroll, which
 * is what produced the stalls and jumps when the cursor sat inside a block.
 */

function prepareScrollHost(el: HTMLElement) {
  if (el.dataset.scrollReady === "1") return;
  const axes = scrollHostAxes(el, window.getComputedStyle(el));
  markScrollHostPrepared(el);
  el.style.setProperty("-webkit-overflow-scrolling", "touch");
  el.style.setProperty("outline", "none");
  // Only trap the axis this host actually scrolls. Trapping both axes on an
  // x-only host blocks vertical chaining to the transcript viewport.
  el.style.setProperty("overscroll-behavior-x", axes.x ? "contain" : "auto");
  el.style.setProperty("overscroll-behavior-y", axes.y ? "contain" : "auto");
}

const HOST_SELECTOR = [
  "[data-scroll-region]",
  "[data-radix-scroll-area-viewport]",
  ".overflow-y-auto",
  ".overflow-x-auto",
  ".overflow-auto",
  ".app-scrollbar",
  ".sidebar-scrollable",
  ".markdown-code-scroll",
  ".markdown-table-scroll",
].join(",");

function scanAndPrepareScrollHosts(root: ParentNode = document) {
  for (const el of root.querySelectorAll<HTMLElement>(HOST_SELECTOR)) {
    prepareScrollHost(el);
  }
}

export function HoverScrollEnabler() {
  useEffect(() => {
    scanAndPrepareScrollHosts();

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (!(node instanceof HTMLElement)) continue;
          if (node.matches?.(HOST_SELECTOR)) prepareScrollHost(node);
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

      const resolved = resolveWheelScrollTarget(event.target, {
        deltaX: event.deltaX,
        deltaY: event.deltaY,
        shiftKey: event.shiftKey,
        getStyle: (el) => window.getComputedStyle(el),
      });
      if (!resolved) return;

      const { host, axis, delta, mustTakeOver } = resolved;
      prepareScrollHost(host);

      // Native scrolling keeps trackpad inertia, so only intervene when an
      // intermediate scroller would trap the delta.
      if (!mustTakeOver) return;

      if (axis === "y") {
        const max = host.scrollHeight - host.clientHeight;
        const next = Math.max(0, Math.min(max, host.scrollTop + delta));
        if (next === host.scrollTop) return;
        host.scrollTop = next;
      } else {
        const max = host.scrollWidth - host.clientWidth;
        const next = Math.max(0, Math.min(max, host.scrollLeft + delta));
        if (next === host.scrollLeft) return;
        host.scrollLeft = next;
      }

      // We own this gesture now — stop native chaining so the transcript
      // cannot double-apply the delta (that was the visible "jump").
      event.preventDefault();
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
