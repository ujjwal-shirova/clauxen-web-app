import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildAssistantTranscriptRecord,
  buildUserTranscriptRecord,
  messagesToTranscriptRecords,
  recordsToJsonl,
} from "@/backend/training/transcript-format";

describe("transcript-format", () => {
  it("builds Cursor-style user and assistant records", () => {
    const user = buildUserTranscriptRecord("hello");
    assert.equal(user.role, "user");
    assert.deepEqual(user.message.content, [{ type: "text", text: "hello" }]);

    const assistant = buildAssistantTranscriptRecord({
      answer: "world",
      thinking: "reason",
      tools: [
        {
          id: "call_1",
          name: "web_search",
          input: { query: "clauxen" },
          result: '{"ok":true}',
        },
      ],
    });

    assert.equal(assistant.role, "assistant");
    assert.equal(assistant.message.content[0]?.type, "thinking");
    assert.equal(assistant.message.content[1]?.type, "text");
    assert.equal(assistant.message.content[2]?.type, "tool_use");
    assert.equal(assistant.message.content[3]?.type, "tool_result");
  });

  it("serializes to JSONL without nesting wrappers", () => {
    const jsonl = recordsToJsonl([
      buildUserTranscriptRecord("hi"),
      buildAssistantTranscriptRecord({ answer: "yo" }),
    ]);
    const lines = jsonl.split("\n");
    assert.equal(lines.length, 2);
    assert.equal(JSON.parse(lines[0]!).role, "user");
    assert.equal(JSON.parse(lines[1]!).role, "assistant");
  });

  it("converts UI messages into transcript lines + turn_ended", () => {
    const lines = messagesToTranscriptRecords([
      { id: "u1", role: "user", content: "search tokyo" },
      {
        id: "a1",
        role: "assistant",
        content: "Here you go",
        agentSegments: [
          {
            kind: "tool",
            toolCallId: "t1",
            name: "web_search",
            args: { query: "tokyo" },
            result: "[]",
            status: "done",
          },
        ],
      },
    ]);
    assert.equal(lines.length, 3);
    assert.equal(lines[0]!.role, "user");
    assert.equal(lines[1]!.role, "assistant");
    assert.equal(lines[2]!.role, "meta");
    assert.equal(
      (lines[2]!.record as { type: string }).type,
      "turn_ended",
    );
  });
});
