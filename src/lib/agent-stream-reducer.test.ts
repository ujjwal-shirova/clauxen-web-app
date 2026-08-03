import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyAgentStreamEvent } from "@/lib/agent-stream-reducer";
import type { Message } from "@/lib/types";

function assistant(): Message {
  return {
    id: "assistant-1",
    role: "assistant",
    content: "",
    isStreaming: true,
  };
}

describe("agent stream reducer transcript channels", () => {
  it("keeps thinking and narration in distinct ordered segments", () => {
    let message = applyAgentStreamEvent(assistant(), {
      type: "agent_frame_start",
      frameId: "frame-1",
    });
    message = applyAgentStreamEvent(message, {
      type: "segment_start",
      segmentId: "thinking-1",
      kind: "thinking",
    });
    message = applyAgentStreamEvent(message, {
      type: "thinking_delta",
      segmentId: "thinking-1",
      delta: "The two contracts differ.",
    });
    message = applyAgentStreamEvent(message, {
      type: "segment_start",
      segmentId: "narration-1",
      kind: "narration",
    });
    message = applyAgentStreamEvent(message, {
      type: "narration_delta",
      segmentId: "narration-1",
      delta: "I’ll verify the newer contract.",
    });

    const segments = message.agentFrames?.[0]?.segments ?? [];
    assert.deepEqual(
      segments.map((segment) => segment.kind),
      ["thinking", "narration"],
    );
    assert.equal(
      segments[0]?.kind === "thinking" ? segments[0].content : undefined,
      "The two contracts differ.",
    );
    assert.equal(
      segments[1]?.kind === "narration" ? segments[1].content : undefined,
      "I’ll verify the newer contract.",
    );
  });

  it("promotes the final-round narration to the durable answer in place", () => {
    let message = applyAgentStreamEvent(assistant(), {
      type: "segment_start",
      segmentId: "narration-1",
      kind: "narration",
    });
    message = applyAgentStreamEvent(message, {
      type: "narration_delta",
      segmentId: "narration-1",
      delta: "This became the final answer.",
    });
    // Tokens mirror into content while streaming so the answer body paints live.
    assert.equal(message.content, "This became the final answer.");
    message = applyAgentStreamEvent(message, {
      type: "answer_finalize",
      segmentId: "narration-1",
      text: "This became the final answer.",
    });

    const segments = message.agentFrames?.[0]?.segments ?? [];
    const promoted = segments.find((segment) => segment.id === "narration-1");
    assert.equal(promoted?.kind, "narration");
    if (promoted?.kind !== "narration") return;
    assert.equal(promoted.isFinal, true);
    assert.equal(promoted.isStreaming, false);
    assert.equal(message.content, "This became the final answer.");
  });

  it("records tool failures without dropping the narration", () => {
    let message = applyAgentStreamEvent(assistant(), {
      type: "segment_start",
      segmentId: "narration-1",
      kind: "narration",
    });
    message = applyAgentStreamEvent(message, {
      type: "narration_delta",
      segmentId: "narration-1",
      delta: "Fetching the docs.",
    });
    assert.equal(message.content, "Fetching the docs.");
    message = applyAgentStreamEvent(message, {
      type: "tool_start",
      toolCallId: "tool-1",
      name: "web_fetch",
      args: { url: "https://example.com" },
    });
    // Pre-tool mirror cleared so interim prose is not the final answer.
    assert.equal(message.content, "");
    message = applyAgentStreamEvent(message, {
      type: "tool_end",
      toolCallId: "tool-1",
      name: "web_fetch",
      result: '{"error":"timeout"}',
      isError: true,
    });

    const segments = message.agentFrames?.[0]?.segments ?? [];
    assert.equal(
      segments.some((segment) => segment.id === "narration-1"),
      true,
    );
    const tool = segments.find((segment) => segment.kind === "tool");
    assert.equal(tool?.kind === "tool" ? tool.status : undefined, "error");
  });
});
