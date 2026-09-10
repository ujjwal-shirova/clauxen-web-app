"use client";

import { useEffect } from "react";
import {
  markScrollHostPrepared,
  resolveWheelScrollTarget,
  scrollHostAxes,
  wheelDeltaInPixels,
} from "@/lib/nested-scroll";

/**
 * App-wide nested scrolling under html/body { overflow: hidden }.
 *
 * Routes wheel/trackpad deltas to the nearest ancestor that can actually
 * consume them **on that axis, in that direction**. Horizontal-only hosts
 * (code blocks, tables) therefore never swallow a vertical page scroll, which
 * is what produced the stalls and jumps when the cursor sat inside a block.
 *
 * Chat transcript vertical scrolling is owned solely by the Radix viewport
 * (`[data-scroll-region]`). Agent tool panes marked
 * `[data-chat-scroll-passthrough]` force vertical deltas through to that
 * viewport.
 */

function prepareScrollHost(el: HTMLElement) {
  // Idempotent: preparation only depends on static overflow style, so hosts
  // are prepared once. Without this guard every wheel tick re-resolved
  // computed style and rewrote the same overscroll values, invalidating style
  // on the scroll hot path.
  if (el.dataset.scrollReady === "1") return;
  const axes = scrollHostAxes(el, window.getComputedStyle(el));
  markScrollHostPrepared(el);
  el.style.setProperty("-webkit-overflow-scrolling", "touch");
  el.style.setProperty("outline", "none");
  // Only trap the axis this host actually scrolls. Trapping both axes on an
  // x-only host blocks vertical chaining to the transcript viewport. Never
  // write an explicit `auto` — that would override stylesheet containment
  // (e.g. overscroll-x-contain on code/table scrollers) with nothing.
  if (axes.x) el.style.setProperty("overscroll-behavior-x", "contain");
  if (el.hasAttribute("data-chat-scroll-passthrough")) {
    el.style.setProperty("overscroll-behavior-y", "auto");
  } else if (axes.y) {
    el.style.setProperty("overscroll-behavior-y", "contain");
  }
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

      const { host, axis, mustTakeOver } = resolved;
      prepareScrollHost(host);

      // Native scrolling keeps trackpad inertia, so only intervene when an
      // intermediate scroller would trap the delta.
      if (!mustTakeOver) return;

      const delta = wheelDeltaInPixels(
        resolved.delta,
        event.deltaMode,
        axis === "y" ? host.clientHeight : host.clientWidth,
      );

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
