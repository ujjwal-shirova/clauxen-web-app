/** Shared cookie that caches onboarding completion for Edge middleware. */
export const ONBOARDING_DONE_COOKIE = "clx_ob_done";

export function onboardingDoneCookieValue(
  userId: string,
  completed: boolean,
): string {
  return `${userId}.${completed ? "1" : "0"}`;
}

/**
 * Completed → long cache. Incomplete → short TTL so a user who finishes
 * onboarding in another browser is not stuck bouncing for a year.
 */
export function onboardingDoneCookieOptions(completed = true) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: completed ? 60 * 60 * 24 * 365 : 60 * 5,
  };
}
