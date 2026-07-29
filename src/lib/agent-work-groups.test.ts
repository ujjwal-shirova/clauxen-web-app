import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  countContentLineDiff,
  groupAgentWorkItems,
} from "@/lib/agent-work-groups";
import type { AgentSegment } from "@/lib/agent-segments";

function narration(
  id: string,
  content: string,
  extra?: Partial<Extract<AgentSegment, { kind: "narration" }>>,
): AgentSegment {
  return { kind: "narration", id, content, isStreaming: false, ...extra };
}

function tool(
  toolCallId: string,
  name: string,
  status: "running" | "done" | "error" = "done",
): AgentSegment {
  return {
    kind: "tool",
    id: `tool-${toolCallId}`,
    toolCallId,
    name,
    status,
    args: {},
  };
}

describe("groupAgentWorkItems", () => {
  it("anchors a group on narration and derives its header", () => {
    const items = groupAgentWorkItems([
      narration("n1", "I'll check the latest pricing."),
      tool("t1", "web_search"),
    ]);

    assert.equal(items.length, 1);
    const item = items[0];
    assert.equal(item.kind, "group");
    if (item.kind !== "group") return;
    assert.equal(item.group.label, "Checked the latest pricing");
    assert.equal(item.group.isActive, false);
    assert.equal(item.group.narration?.id, "n1");
    assert.deepEqual(
      item.group.segments.map((segment) => segment.id),
      ["tool-t1"],
    );
  });

  it("keeps groups open while a member runs", () => {
    const items = groupAgentWorkItems([
      narration("n1", "I'll run the tests."),
      tool("t1", "bash_tool", "running"),
    ]);

    const item = items[0];
    assert.equal(item.kind, "group");
    if (item.kind !== "group") return;
    assert.equal(item.group.isActive, true);
    assert.equal(item.group.label, "Running the tests…");
  });

  it("renders trailing standalone narration outside groups", () => {
    const items = groupAgentWorkItems([
      tool("t1", "web_search"),
      narration("n1", "The results are in — summarising next."),
    ]);

    assert.deepEqual(
      items.map((item) => item.kind),
      ["group", "narration"],
    );
  });

  it("excludes the promoted final segment from the trace", () => {
    const items = groupAgentWorkItems([
      narration("n1", "I'll check the docs."),
      tool("t1", "web_search"),
      narration("n2", "Here is the full answer.", { isFinal: true }),
    ]);

    assert.equal(items.length, 1);
    const item = items[0];
    assert.equal(item.kind, "group");
    if (item.kind !== "group") return;
    assert.ok(
      item.group.segments.every((segment) => segment.id !== "n2"),
      "final segment must not leak into the activity trace",
    );
  });

  it("falls back to a tool-mix label without narration", () => {
    const items = groupAgentWorkItems([tool("t1", "bash_tool")]);
    const item = items[0];
    assert.equal(item.kind, "group");
    if (item.kind !== "group") return;
    assert.equal(item.group.label, "Ran 1 command");
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
