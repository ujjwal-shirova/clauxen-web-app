import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  hasUsefulAssistantProgress,
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

  it("maps security challenges without technical CF copy", () => {
    const out = toUserFacingChatError("cf-mitigated challenge Just a moment");
    assert.match(out, /security check/i);
  });
});

describe("hasUsefulAssistantProgress", () => {
  it("treats painted answer or finished tools as useful", () => {
    assert.equal(
      hasUsefulAssistantProgress({ content: "Here is the brief." }),
      true,
    );
    assert.equal(
      hasUsefulAssistantProgress({
        content: "",
        agentSegments: [
          {
            kind: "tool",
            id: "t1",
            toolCallId: "t1",
            name: "web_search",
            status: "done",
            searchResults: [
              {
                title: "Example",
                url: "https://example.com",
                snippet: "ok",
              },
            ],
          },
        ],
      }),
      true,
    );
    assert.equal(hasUsefulAssistantProgress({ content: "" }), false);
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
