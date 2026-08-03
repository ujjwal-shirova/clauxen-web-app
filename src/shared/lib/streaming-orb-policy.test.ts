import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { shouldShowAssistantStreamingOrb } from "./streaming-orb-policy";

describe("shouldShowAssistantStreamingOrb", () => {
  it("shows while streaming before answer tokens", () => {
    assert.equal(
      shouldShowAssistantStreamingOrb({
        isStreaming: true,
        answerStreaming: false,
      }),
      true,
    );
  });

  it("shows during timeline / tools (answer not streaming yet)", () => {
    assert.equal(
      shouldShowAssistantStreamingOrb({
        isStreaming: true,
        answerStreaming: false,
      }),
      true,
    );
  });

  it("hides once answer markdown is streaming", () => {
    assert.equal(
      shouldShowAssistantStreamingOrb({
        isStreaming: true,
        answerStreaming: true,
      }),
      false,
    );
  });

  it("hides when the turn is finished", () => {
    assert.equal(
      shouldShowAssistantStreamingOrb({
        isStreaming: false,
        answerStreaming: false,
      }),
      false,
    );
  });
});
