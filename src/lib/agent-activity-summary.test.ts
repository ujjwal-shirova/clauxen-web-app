import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildActivitySummaryParts,
  summarizeActivityPlain,
} from "@/lib/agent-activity-summary";
import type { AgentSegment } from "@/lib/agent-segments";

function tool(
  toolCallId: string,
  name: string,
  status: "running" | "done" | "error" = "done",
): Extract<AgentSegment, { kind: "tool" }> {
  return {
    kind: "tool",
    id: `tool-${toolCallId}`,
    toolCallId,
    name,
    status,
    args: {},
  };
}

function thinking(
  id: string,
): Extract<AgentSegment, { kind: "thinking" }> {
  return { kind: "thinking", id, content: "…", isStreaming: false };
}

describe("summarizeActivityPlain", () => {
  it("builds Cursor-style multi-tool summaries", () => {
    const plain = summarizeActivityPlain(
      [
        tool("a", "create_file"),
        tool("b", "create_file"),
        tool("c", "file_read"),
        tool("d", "web_search"),
        tool("e", "bash_tool"),
      ],
      "done",
    );
    assert.equal(
      plain,
      "Edited 2 files, explored 1 file, 1 search, ran 1 command",
    );
  });

  it("uses present-tense while active", () => {
    const plain = summarizeActivityPlain(
      [tool("a", "web_search", "running")],
      "active",
    );
    assert.match(plain, /^Searching 1 search/);
  });

  it("summarizes thinking alone", () => {
    assert.equal(summarizeActivityPlain([thinking("t1")], "done"), "Thought");
  });
});

describe("buildActivitySummaryParts", () => {
  it("marks counts as emphasis and verbs as muted", () => {
    const parts = buildActivitySummaryParts(
      [tool("a", "create_file"), tool("b", "web_search")],
      "done",
    );
    const emph = parts.filter(
      (p) => p.kind === "text" && p.tone === "emphasis",
    );
    assert.ok(emph.some((p) => p.kind === "text" && p.text === "1"));
  });
});
