"use client";

import { useLayoutEffect, type RefObject } from "react";

/**
 * Move keyboard / wheel “activation” onto a newly opened surface so users
 * can scroll and hover without an extra click on the previous page/trigger.
 */
export function blurActiveElement() {
  if (typeof document === "undefined") return;
  const active = document.activeElement;
  if (active instanceof HTMLElement && active !== document.body) {
    active.blur();
  }
}

export function focusSurface(
  target: HTMLElement | null | undefined,
  options?: { preventScroll?: boolean },
) {
  if (!target) return;
  if (!target.hasAttribute("tabindex")) {
    target.tabIndex = -1;
  }
  try {
    target.focus({ preventScroll: options?.preventScroll ?? true });
  } catch {
    /* ignore */
  }
}

/** Prefer overlay dialog, then main app surface / scroll host. */
export function focusAppSurface(preferred?: HTMLElement | null) {
  if (typeof document === "undefined") return;
  blurActiveElement();

  if (preferred) {
    focusSurface(preferred);
    return;
  }

  const overlay = document.querySelector<HTMLElement>(
    '[data-app-overlay-surface][aria-modal="true"], [data-app-overlay-surface]',
  );
  if (overlay) {
    focusSurface(overlay);
    return;
  }

  const main = document.querySelector<HTMLElement>(
    "[data-app-main-surface], main [data-scroll-region], [data-component='agent-panel'] [data-scroll-region]",
  );
  focusSurface(main);
}

/** Call from overlay roots so they receive focus on open. */
export function useOverlaySurfaceFocus(
  ref: RefObject<HTMLElement | null>,
  enabled = true,
) {
  useLayoutEffect(() => {
    if (!enabled) return;
    focusSurface(ref.current);
  }, [enabled, ref]);
}
