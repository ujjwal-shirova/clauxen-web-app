import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isAssistantGenerationError,
  toUserFacingChatError,
  USER_FACING_CHAT_ERROR,
} from "@/lib/assistant-generation-error";

describe("toUserFacingChatError", () => {
  it("hides technical lease and status details", () => {
    const out = toUserFacingChatError(
      "Generation failed: This chat is already generating a response.",
    );
    assert.match(out, /try again/i);
    assert.equal(out.includes("already generating"), false);
    assert.equal(out.includes("Generation failed"), false);
  });

  it("hides provider and HTTP status details", () => {
    assert.equal(
      toUserFacingChatError("Novita 403 Forbidden: invalid api key"),
      USER_FACING_CHAT_ERROR,
    );
    assert.equal(
      toUserFacingChatError("Request failed with status 502"),
      USER_FACING_CHAT_ERROR,
    );
  });

  it("keeps a calm busy message for rate limits", () => {
    const out = toUserFacingChatError("429 Too Many Requests");
    assert.match(out, /busy|try again/i);
    assert.equal(out.includes("429"), false);
  });
});

describe("isAssistantGenerationError", () => {
  it("detects flagged and sanitized failure copy", () => {
    assert.equal(
      isAssistantGenerationError({
        role: "assistant",
        content: USER_FACING_CHAT_ERROR,
        generationFailed: false,
      }),
      true,
    );
    assert.equal(
      isAssistantGenerationError({
        role: "assistant",
        content: "Hello there",
        generationFailed: true,
      }),
      true,
    );
  });
});
