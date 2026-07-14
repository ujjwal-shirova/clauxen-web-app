import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  peekPendingChatRouteSeed,
  setPendingChatRouteSeed,
  takePendingChatRouteSeed,
} from "./chat-route-seed";

describe("chat-route-seed", () => {
  it("takes a matching pending seed once", () => {
    setPendingChatRouteSeed({
      chatId: "chat_a",
      messages: [],
      hasMore: false,
      nextCursor: null,
      branchMessages: null,
    });
    assert.equal(peekPendingChatRouteSeed("chat_a")?.chatId, "chat_a");
    assert.equal(takePendingChatRouteSeed("chat_b"), null);
    assert.equal(takePendingChatRouteSeed("chat_a")?.chatId, "chat_a");
    assert.equal(takePendingChatRouteSeed("chat_a"), null);
  });
});
