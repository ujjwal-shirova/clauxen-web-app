/** DOM helpers for the login demo — scoped to DemoComposer only. */

export function findPromptTextarea(root: HTMLElement | null) {
  return root?.querySelector(
    "textarea.prompt-textarea",
  ) as HTMLTextAreaElement | null;
}

export function findPromptShell(root: HTMLElement | null) {
  return (
    (root?.querySelector("[data-prompt-shell]") as HTMLElement | null) ??
    findPromptTextarea(root)
  );
}

/** Enabled send control — appears only once the draft is non-empty. */
export function findSendButton(root: HTMLElement | null) {
  const buttons = root?.querySelectorAll("button") ?? [];
  for (const btn of buttons) {
    if (btn.getAttribute("aria-label") !== "Send") continue;
    if (btn.disabled) continue;
    return btn as HTMLButtonElement;
  }
  return root?.querySelector(
    'button[aria-label="Send"]:not([disabled])',
  ) as HTMLButtonElement | null;
}

/** Wait until the enabled Send button exists. */
export async function waitForSendButton(
  root: HTMLElement | null,
  opts: {
    timeoutMs?: number;
    signal?: { cancelled: boolean };
  } = {},
): Promise<HTMLButtonElement | null> {
  const timeoutMs = opts.timeoutMs ?? 2500;
  const start = performance.now();
  while (performance.now() - start < timeoutMs) {
    if (opts.signal?.cancelled) return null;
    const btn = findSendButton(root);
    if (btn && !btn.disabled) return btn;
    await new Promise((r) => requestAnimationFrame(() => r(undefined)));
  }
  return findSendButton(root);
}

export function pointInStage(
  stage: HTMLElement | null,
  el: HTMLElement | null,
  biasX = 0.5,
  biasY = 0.5,
): { x: number; y: number } {
  if (!stage || !el) return { x: 200, y: 320 };
  const s = stage.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  return {
    x: r.left - s.left + r.width * biasX,
    y: r.top - s.top + r.height * biasY,
  };
}
