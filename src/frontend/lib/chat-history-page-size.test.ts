import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  INITIAL_CHAT_MESSAGE_PAGE_SIZE,
  OLDER_CHAT_MESSAGE_PAGE_SIZE,
} from "./chat-history-page-size";

describe("chat-history-page-size", () => {
  it("uses generous edge-friendly page sizes for instant hydrate", () => {
    assert.ok(INITIAL_CHAT_MESSAGE_PAGE_SIZE >= 20);
    assert.ok(OLDER_CHAT_MESSAGE_PAGE_SIZE >= 20);
  });
});
