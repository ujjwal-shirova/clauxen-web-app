import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildAssistantTranscriptRecord,
  buildToolResultUserRecord,
  buildUserTranscriptRecord,
  messagesToTranscriptRecords,
  recordsToJsonl,
} from "@/backend/training/transcript-format";

describe("transcript-format", () => {
  it("builds Anthropic-shaped user and assistant records", () => {
    const user = buildUserTranscriptRecord("hello");
    assert.equal(user.role, "user");
    assert.deepEqual(user.message.content, [{ type: "text", text: "hello" }]);

    const tools = [
      {
        id: "call_1",
        name: "web_search",
        input: { query: "clauxen" },
        result: '{"ok":true}',
      },
    ];

    const assistant = buildAssistantTranscriptRecord({
      answer: "world",
      thinking: "reason",
      tools,
    });

    assert.equal(assistant.role, "assistant");
    assert.equal(assistant.message.content[0]?.type, "thinking");
    assert.equal(assistant.message.content[1]?.type, "tool_use");
    assert.equal(assistant.message.content[2]?.type, "text");
    assert.equal(
      assistant.message.content.some((part) => part.type === "tool_result"),
      false,
    );

    const toolUser = buildToolResultUserRecord(tools);
    assert.ok(toolUser);
    assert.equal(toolUser!.role, "user");
    assert.equal(toolUser!.message.content[0]?.type, "tool_result");
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

  it("preserves durable agent action timing and results", () => {
    const assistant = buildAssistantTranscriptRecord({
      answer: "Found it.",
      tools: [
        {
          id: "search-1",
          name: "web_search",
          input: { query: "Clauxen" },
          result: '{"results":[]}',
          description: "Searching the web",
          startedAtMs: 1_000,
          completedAtMs: 2_500,
        },
      ],
      agentUi: {
        startedAtMs: 800,
        completedAtMs: 3_000,
        actions: [
          {
            id: "search-1",
            name: "web_search",
            input: { query: "Clauxen" },
            result: '{"results":[]}',
            description: "Searching the web",
            startedAtMs: 1_000,
            completedAtMs: 2_500,
          },
        ],
      },
    });

    assert.equal(assistant.agent_ui?.actions?.[0]?.id, "search-1");
    assert.equal(assistant.agent_ui?.actions?.[0]?.completedAtMs, 2_500);
  });

  it("converts UI messages into Anthropic lines + tool_result user + turn_ended", () => {
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
    assert.equal(lines.length, 4);
    assert.equal(lines[0]!.role, "user");
    assert.equal(lines[1]!.role, "assistant");
    assert.equal(lines[2]!.role, "user");
    assert.equal(
      (lines[2]!.record as { message: { content: Array<{ type: string }> } })
        .message.content[0]?.type,
      "tool_result",
    );
    assert.equal(lines[3]!.role, "meta");
    assert.equal(
      (lines[3]!.record as { type: string }).type,
      "turn_ended",
    );
  });
});
