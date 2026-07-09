import { findSendButton, pointInStage, waitForSendButton } from "./prompt-dom";

type Point = { x: number; y: number };

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Magnet: glide the cursor to the live Send button with a smooth ease-in-out
 * path (not a hard lerp snap). Re-measures mid-flight so layout shifts still
 * land on the button center.
 */
export async function magnetCursorToSend(opts: {
  stage: HTMLElement | null;
  root: HTMLElement | null;
  getCursor: () => Point;
  setCursor: (p: Point & { visible?: boolean; clicking?: boolean }) => void;
  signal?: { cancelled: boolean };
  /** Settle distance in px */
  settlePx?: number;
  /** Max time to chase (ms) */
  timeoutMs?: number;
}): Promise<HTMLButtonElement | null> {
  const {
    stage,
    root,
    getCursor,
    setCursor,
    signal,
    settlePx = 2.5,
    timeoutMs = 4200,
  } = opts;

  const btn = await waitForSendButton(root, { signal, timeoutMs: 2500 });
  if (!btn || signal?.cancelled) return btn;

  const measure = (): Point | null => {
    const live = findSendButton(root) ?? btn;
    if (!live || !stage?.isConnected) return null;
    return pointInStage(stage, live, 0.5, 0.5);
  };

  const from = { ...getCursor() };
  const firstTarget = measure();
  if (!firstTarget) return btn;

  const dist0 = Math.hypot(firstTarget.x - from.x, firstTarget.y - from.y);
  // Distance-scaled duration — short hops stay quick, long ones glide.
  const duration = Math.min(1600, Math.max(780, 520 + dist0 * 1.35));
  const start = performance.now();

  return new Promise((resolve) => {
    let raf = 0;

    const stop = (result: HTMLButtonElement | null) => {
      cancelAnimationFrame(raf);
      resolve(result);
    };

    const tick = (now: number) => {
      if (signal?.cancelled) {
        stop(null);
        return;
      }
      if (now - start > timeoutMs) {
        const final = measure();
        if (final) setCursor({ ...final, visible: true, clicking: false });
        stop(findSendButton(root) ?? btn);
        return;
      }

      const target = measure() ?? firstTarget;
      const t = Math.min(1, (now - start) / duration);
      const e = easeInOutCubic(t);
      const next = {
        x: from.x + (target.x - from.x) * e,
        y: from.y + (target.y - from.y) * e,
        visible: true as const,
        clicking: false as const,
      };
      setCursor(next);

      const remaining = Math.hypot(target.x - next.x, target.y - next.y);
      if (t >= 1 || remaining <= settlePx) {
        setCursor({ ...target, visible: true, clicking: false });
        stop(findSendButton(root) ?? btn);
        return;
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
  });
}
