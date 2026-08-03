/**
 * Nested scroll routing (pure helpers).
 *
 * The chat transcript lives in a scroll viewport that contains horizontally
 * scrollable code blocks and tables. A wheel gesture must reach the nearest
 * ancestor that can consume it **on the wheel's dominant axis and in its
 * direction** — otherwise an x-only code block eats a vertical page scroll and
 * the transcript stalls or jumps.
 *
 * We only take the gesture over when native chaining would get trapped by an
 * intermediate scroller that is already pinned at its end. Everything else is
 * left to the browser so trackpad inertia stays smooth.
 */

export type ScrollAxis = "x" | "y";

export type ScrollHostAxes = { x: boolean; y: boolean };

export type WheelScrollTarget = {
  host: HTMLElement;
  axis: ScrollAxis;
  /** Signed pixels to apply on `axis`. */
  delta: number;
  /**
   * True when an intermediate scroller on the same axis was skipped because it
   * is pinned at its end. Native chaining is unreliable there (the trapped
   * host keeps the delta), so the caller should apply + preventDefault.
   */
  mustTakeOver: boolean;
};

/** DOM_DELTA_* values used by WheelEvent.deltaMode. */
const DOM_DELTA_PIXEL = 0;
const DOM_DELTA_LINE = 1;
const DOM_DELTA_PAGE = 2;
const DEFAULT_LINE_HEIGHT_PX = 16;

/**
 * Convert a wheel delta to pixels before we manually route it. Native wheel
 * scrolling performs this conversion for us; takeover paths must do it too or
 * a mouse wheel reporting line units moves only a few pixels at a time.
 */
export function wheelDeltaInPixels(
  delta: number,
  deltaMode: number,
  pageSize: number,
): number {
  if (deltaMode === DOM_DELTA_LINE) return delta * DEFAULT_LINE_HEIGHT_PX;
  if (deltaMode === DOM_DELTA_PAGE) return delta * Math.max(1, pageSize);
  return delta;
}

export type OverflowStyle = Pick<CSSStyleDeclaration, "overflowX" | "overflowY">;

/** Overflow values that permit scrolling. */
export function overflowAllowsScroll(value: string): boolean {
  return value === "auto" || value === "scroll" || value === "overlay";
}

/** Which axes this element can actually scroll right now. */
export function scrollHostAxes(
  el: HTMLElement,
  style: OverflowStyle,
): ScrollHostAxes {
  return {
    x:
      overflowAllowsScroll(style.overflowX) &&
      el.scrollWidth > el.clientWidth + 1,
    y:
      overflowAllowsScroll(style.overflowY) &&
      el.scrollHeight > el.clientHeight + 1,
  };
}

/** True when `host` has room left to move `delta` pixels along `axis`. */
export function hostCanConsume(
  host: HTMLElement,
  axis: ScrollAxis,
  delta: number,
): boolean {
  if (delta === 0) return false;
  if (axis === "y") {
    const max = host.scrollHeight - host.clientHeight;
    if (max <= 0) return false;
    return delta > 0 ? host.scrollTop < max - 0.5 : host.scrollTop > 0.5;
  }
  const max = host.scrollWidth - host.clientWidth;
  if (max <= 0) return false;
  return delta > 0 ? host.scrollLeft < max - 0.5 : host.scrollLeft > 0.5;
}

export function markScrollHostPrepared(el: HTMLElement) {
  el.dataset.scrollReady = "1";
}

/** Resolve the axis + signed delta a wheel event is asking for. */
export function resolveWheelIntent(input: {
  deltaX: number;
  deltaY: number;
  shiftKey?: boolean;
}): { axis: ScrollAxis; delta: number } | null {
  const { deltaX, deltaY, shiftKey } = input;
  if (deltaX === 0 && deltaY === 0) return null;

  // Shift+wheel is the conventional horizontal gesture. Some browsers already
  // move the delta into deltaX; others keep it on deltaY.
  if (shiftKey) {
    const delta = deltaX !== 0 ? deltaX : deltaY;
    return delta === 0 ? null : { axis: "x", delta };
  }
  if (Math.abs(deltaX) > Math.abs(deltaY)) {
    return { axis: "x", delta: deltaX };
  }
  return { axis: "y", delta: deltaY };
}

/** Radix viewports are the real scroller; prefer them over their wrapper. */
function viewportFor(node: HTMLElement): HTMLElement | null {
  if (node.matches?.("[data-radix-scroll-area-viewport]")) return node;
  return (
    node.querySelector?.<HTMLElement>(
      ":scope > [data-radix-scroll-area-viewport]",
    ) ?? null
  );
}

/**
 * Walk from the wheel target up to the document root, returning the first host
 * that can consume the gesture on the intended axis.
 */
export function resolveWheelScrollTarget(
  start: EventTarget | null,
  input: {
    deltaX: number;
    deltaY: number;
    shiftKey?: boolean;
    getStyle: (el: HTMLElement) => OverflowStyle;
    /** Stops the walk (defaults to documentElement). */
    root?: Element | null;
  },
): WheelScrollTarget | null {
  if (!(start instanceof Element)) return null;

  const intent = resolveWheelIntent(input);
  if (!intent) return null;
  const { axis, delta } = intent;
  const { getStyle } = input;
  const root =
    input.root ?? (typeof document === "undefined" ? null : document.documentElement);

  let node: Element | null = start;
  let skippedPinnedHost = false;
  let skippedCrossAxisHost = false;
  let axisHostAtEnd: HTMLElement | null = null;

  while (node && node !== root) {
    if (node instanceof HTMLElement) {
      // Agent tool chrome that must never own vertical chat scrolling.
      // Only force a takeover when the marked node is actually a scroll host
      // on some axis — overflow-hidden wrappers (ToolBody) must not kill
      // trackpad inertia on the transcript.
      if (
        axis === "y" &&
        (node.hasAttribute("data-chat-scroll-passthrough") ||
          node.hasAttribute("data-source-chip") ||
          node.hasAttribute("data-source-preview") ||
          node.classList.contains("agent-terminal-pane"))
      ) {
        const axes = scrollHostAxes(node, getStyle(node));
        if (axes.x || axes.y) {
          skippedCrossAxisHost = true;
        }
        node = node.parentElement;
        continue;
      }
      const candidate = viewportFor(node) ?? node;
      const axes = scrollHostAxes(candidate, getStyle(candidate));
      if (axes[axis]) {
        if (hostCanConsume(candidate, axis, delta)) {
          return {
            host: candidate,
            axis,
            delta,
            // Explicitly route a vertical gesture that started over an x-only
            // code/table host. WebKit and Chromium can otherwise retain the
            // gesture on that inner overflow node instead of chaining it.
            mustTakeOver: skippedPinnedHost || skippedCrossAxisHost,
          };
        }
        // Pinned at its end — native chaining out of it is unreliable.
        skippedPinnedHost = true;
        axisHostAtEnd ??= candidate;
      } else if (axes.x || axes.y) {
        skippedCrossAxisHost = true;
      }
    }
    node = node.parentElement;
  }

  if (!axisHostAtEnd) return null;
  return { host: axisHostAtEnd, axis, delta, mustTakeOver: false };
}
