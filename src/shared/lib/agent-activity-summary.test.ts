import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildActivitySummaryParts,
  countActivitySteps,
  countContentLineDiff,
  deriveLiveActivityLabel,
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
  it("builds multi-tool activity summaries", () => {
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

describe("deriveLiveActivityLabel", () => {
  it("labels the running search with its query", () => {
    const search = tool("a", "web_search", "running");
    search.args = { query: "latest chip news" };
    search.searchQuery = "latest chip news";
    assert.equal(
      deriveLiveActivityLabel([search]),
      'Searching "latest chip news"',
    );
  });

  it("labels a running file read with the file name", () => {
    const read = tool("a", "file_read", "running");
    read.args = { path: "brain/MEMORY.md" };
    assert.equal(deriveLiveActivityLabel([read]), "Reading MEMORY.md");
  });

  it("labels MCP connectors in plain language", () => {
    const mcp = tool("a", "mcp__supabase__execute_sql", "running");
    assert.equal(deriveLiveActivityLabel([mcp]), "Calling Execute Sql");
  });

  it("falls back to Thinking, then Working", () => {
    const live = thinking("t1");
    live.isStreaming = true;
    assert.equal(deriveLiveActivityLabel([live]), "Thinking");
    assert.equal(deriveLiveActivityLabel([]), "Working");
  });
});

describe("countActivitySteps", () => {
  it("counts thinking and tools, skipping present_files", () => {
    assert.equal(
      countActivitySteps([
        thinking("t1"),
        tool("a", "file_read"),
        tool("b", "web_search"),
        tool("c", "present_files"),
      ]),
      3,
    );
  });
});

describe("countContentLineDiff", () => {
  it("counts the lines of the new and previous revisions", () => {
    const diff = countContentLineDiff("a\nc\nd", "a\nb");
    assert.deepEqual(diff, { insertions: 3, deletions: 2 });
  });

  it("reports only insertions for a first write", () => {
    const diff = countContentLineDiff("a\nb");
    assert.deepEqual(diff, { insertions: 2, deletions: 0 });
  });
});
