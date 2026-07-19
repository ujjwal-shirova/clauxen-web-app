import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEMO_RAZORPAY_MESSAGE_LIMIT,
  DEMO_RAZORPAY_QUOTA_EMAIL,
  DEMO_RAZORPAY_QUOTA_USER_ID,
  formatDemoMessagesRemainingLabel,
  isDemoRazorpayQuotaUser,
} from "./demo-razorpay-quota";

describe("demo-razorpay-quota", () => {
  it("matches email and known user id only", () => {
    assert.equal(
      isDemoRazorpayQuotaUser({ email: DEMO_RAZORPAY_QUOTA_EMAIL }),
      true,
    );
    assert.equal(
      isDemoRazorpayQuotaUser({
        email: "TEST-RAZORPAY@CLAUXEN.COM",
        id: "other",
      }),
      true,
    );
    assert.equal(
      isDemoRazorpayQuotaUser({ id: DEMO_RAZORPAY_QUOTA_USER_ID }),
      true,
    );
    assert.equal(
      isDemoRazorpayQuotaUser({ email: "someone@clauxen.com" }),
      false,
    );
    assert.equal(DEMO_RAZORPAY_MESSAGE_LIMIT, 10);
  });

  it("formats remaining label", () => {
    assert.equal(formatDemoMessagesRemainingLabel(0), "You have 0 messages left");
    assert.equal(formatDemoMessagesRemainingLabel(1), "You have 1 message left");
    assert.equal(formatDemoMessagesRemainingLabel(7), "You have 7 messages left");
  });
});
