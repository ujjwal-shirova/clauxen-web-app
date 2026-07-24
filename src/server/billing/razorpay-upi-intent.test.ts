import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { constructRazorpayUpiIntent } from "@/server/billing/razorpay";

describe("constructRazorpayUpiIntent", () => {
  it("builds byte-identical Razorpay UPI payloads from qr id + amount", () => {
    const intent = constructRazorpayUpiIntent({
      qrId: "qr_TFnX6QfX8H4Pb1",
      amountPaise: 100,
    });
    assert.equal(
      intent,
      "upi://pay?am=1.00&cu=INR&mc=5817&mode=22&pa=shirovaaiprivat478370.rzp@rxairtel&pn=Shirova%20AI&tn=Payment%20To%20SHIROVA%20AI%20PRIVATE%20LIMITED&tr=TFnX6QfX8H4Pb1qrv2",
    );
  });

  it("formats rupees with two decimals for larger amounts", () => {
    const intent = constructRazorpayUpiIntent({
      qrId: "qr_TFnXFxYgeTyJQA",
      amountPaise: 19900,
    });
    assert.ok(intent?.startsWith("upi://pay?am=199.00&"));
    assert.ok(intent?.includes("&tr=TFnXFxYgeTyJQAqrv2"));
  });

  it("rejects invalid qr ids", () => {
    assert.equal(
      constructRazorpayUpiIntent({ qrId: "plink_abc", amountPaise: 100 }),
      null,
    );
  });
});
