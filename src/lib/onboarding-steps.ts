/**
 * Shared onboarding wizard steps + URL hash helpers.
 * Hash format mirrors ChatGPT/Claude: /onboarding#plan-selection
 */

export const ONBOARDING_STEPS = [
  "create-account",
  "plan-selection",
  "desktop",
  "before-chat",
  "name",
  "role",
] as const;

export type OnboardingStepId = (typeof ONBOARDING_STEPS)[number];

const STEP_SET = new Set<string>(ONBOARDING_STEPS);

export function isOnboardingStep(
  value: string | null | undefined,
): value is OnboardingStepId {
  return Boolean(value && STEP_SET.has(value));
}

export function parseOnboardingHash(
  hash: string | null | undefined,
): OnboardingStepId | null {
  if (!hash) return null;
  // Browsers can stack fragments — only honor the first segment.
  const raw = hash.replace(/^#/, "").split("#")[0]?.split("?")[0]?.trim() ?? "";
  if (!raw) return null;
  // Accept both "#plan-selection" and "#/plan-selection"
  const step = raw.replace(/^\//, "");
  return isOnboardingStep(step) ? step : null;
}

export function onboardingHashForStep(step: OnboardingStepId): string {
  return `#${step}`;
}

/** Update the address bar without a Next.js navigation (keeps SPA state). */
export function replaceOnboardingStepHash(step: OnboardingStepId) {
  if (typeof window === "undefined") return;
  const next = `/onboarding${onboardingHashForStep(step)}`;
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (current === next) return;
  window.history.replaceState(window.history.state, "", next);
}

export function pushOnboardingStepHash(step: OnboardingStepId) {
  if (typeof window === "undefined") return;
  const next = `/onboarding${onboardingHashForStep(step)}`;
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (current === next) return;
  window.history.pushState(window.history.state, "", next);
}
