import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hasCompletedAssistantOutput } from "@/lib/assistant-output-state";
import type { Message } from "@/lib/types";

const assistant = (partial: Partial<Message>): Message => ({
  id: "assistant-1",
  role: "assistant",
  content: "Final answer",
  ...partial,
});

describe("hasCompletedAssistantOutput", () => {
  it("accepts a completed legacy answer", () => {
    assert.equal(hasCompletedAssistantOutput(assistant({})), true);
  });

  it("hides final-answer chrome during answer or thinking streams", () => {
    assert.equal(hasCompletedAssistantOutput(assistant({ isStreaming: true })), false);
    assert.equal(
      hasCompletedAssistantOutput(assistant({ isThinkingStreaming: true })),
      false,
    );
  });

  it("waits for an agent frame to complete", () => {
    assert.equal(
      hasCompletedAssistantOutput(
        assistant({ agentMode: true, agentFrameComplete: false }),
      ),
      false,
    );
    assert.equal(
      hasCompletedAssistantOutput(
        assistant({ agentMode: true, agentFrameComplete: true }),
      ),
      true,
    );
  });

  it("requires actual answer text", () => {
    assert.equal(hasCompletedAssistantOutput(assistant({ content: "  " })), false);
  });
});
