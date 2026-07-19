/**
 * Hard-capped demo account for Razorpay / billing checkout testing.
 * Shared constants + label copy (safe for client + server).
 */
export const DEMO_RAZORPAY_QUOTA_EMAIL = "test-razorpay@clauxen.com";
export const DEMO_RAZORPAY_QUOTA_USER_ID =
  "396021a9-ba81-4e17-adad-cae2514136df";
export const DEMO_RAZORPAY_MESSAGE_LIMIT = 10;

export function isDemoRazorpayQuotaUser(user: {
  id?: string | null;
  email?: string | null;
}): boolean {
  const id = user.id?.trim().toLowerCase();
  if (id && id === DEMO_RAZORPAY_QUOTA_USER_ID) return true;
  const email = user.email?.trim().toLowerCase();
  return email === DEMO_RAZORPAY_QUOTA_EMAIL;
}

export function formatDemoMessagesRemainingLabel(remaining: number): string {
  const n = Math.max(0, Math.floor(remaining));
  return n === 1
    ? "You have 1 message left"
    : `You have ${n} messages left`;
}
