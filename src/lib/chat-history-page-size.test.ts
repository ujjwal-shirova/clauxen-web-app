import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FULL_CHAT_HYDRATE_LIMIT } from "./chat-history-page-size";

describe("chat-history-page-size", () => {
  it("hydrates a large full-thread window in one shot", () => {
    assert.ok(FULL_CHAT_HYDRATE_LIMIT >= 200);
  });
});
