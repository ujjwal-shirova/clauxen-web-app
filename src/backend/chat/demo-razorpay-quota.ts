import { AppError } from "@/backend/db/errors";
import {
  DEMO_RAZORPAY_MESSAGE_LIMIT,
  DEMO_RAZORPAY_QUOTA_EMAIL,
  DEMO_RAZORPAY_QUOTA_USER_ID,
  formatDemoMessagesRemainingLabel,
  isDemoRazorpayQuotaUser,
} from "@/lib/demo-razorpay-quota";

export {
  DEMO_RAZORPAY_MESSAGE_LIMIT,
  DEMO_RAZORPAY_QUOTA_EMAIL,
  DEMO_RAZORPAY_QUOTA_USER_ID,
  formatDemoMessagesRemainingLabel,
  isDemoRazorpayQuotaUser,
};

export function demoRazorpayLimitReachedError() {
  return new AppError(
    `This test account is limited to ${DEMO_RAZORPAY_MESSAGE_LIMIT} messages. No messages remaining.`,
    429,
    "demo_message_limit",
  );
}
