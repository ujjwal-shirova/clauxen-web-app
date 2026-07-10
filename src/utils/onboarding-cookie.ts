/** Shared cookie that caches onboarding completion for Edge middleware. */
export const ONBOARDING_DONE_COOKIE = "clx_ob_done";

export function onboardingDoneCookieValue(
  userId: string,
  completed: boolean,
): string {
  return `${userId}.${completed ? "1" : "0"}`;
}

export function onboardingDoneCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  };
}
