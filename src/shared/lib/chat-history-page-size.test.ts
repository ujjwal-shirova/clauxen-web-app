import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FULL_CHAT_HYDRATE_LIMIT } from "./chat-history-page-size";
import {
  DEFAULT_CLIENT_HYDRATE_LIMIT,
  HYDRATE_LIMITS,
  hydrateLimitForPlanId,
} from "@/lib/chat-hydrate-limits";

describe("chat-history-page-size", () => {
  it("uses the plan-aware default window for the first edge fetch", () => {
    assert.equal(FULL_CHAT_HYDRATE_LIMIT, DEFAULT_CLIENT_HYDRATE_LIMIT);
    assert.ok(FULL_CHAT_HYDRATE_LIMIT >= 50);
  });

  it("hydrates deeper windows for paid plans", () => {
    assert.equal(hydrateLimitForPlanId("free"), HYDRATE_LIMITS.free);
    assert.ok(hydrateLimitForPlanId("go") >= 200);
    assert.ok(hydrateLimitForPlanId("pro") >= 500);
    assert.ok(hydrateLimitForPlanId(undefined) === HYDRATE_LIMITS.free);
  });
});
