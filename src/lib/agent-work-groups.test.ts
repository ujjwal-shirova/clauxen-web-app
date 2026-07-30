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
  it("keeps narration outside and labels the following tool group", () => {
    const items = groupAgentWorkItems([
      narration("n1", "I'll check the latest pricing."),
      tool("t1", "web_search"),
    ]);

    assert.deepEqual(
      items.map((item) => item.kind),
      ["narration", "group"],
    );
    const [narrationItem, groupItem] = items;
    assert.equal(narrationItem?.kind, "narration");
    if (narrationItem?.kind !== "narration") return;
    assert.equal(narrationItem.segment.id, "n1");

    assert.equal(groupItem?.kind, "group");
    if (groupItem?.kind !== "group") return;
    assert.equal(groupItem.group.label, "Checked the latest pricing");
    assert.equal(groupItem.group.isActive, false);
    assert.equal(groupItem.group.narration, undefined);
    assert.deepEqual(
      groupItem.group.segments.map((segment) => segment.id),
      ["tool-t1"],
    );
  });

  it("keeps groups open while a member runs", () => {
    const items = groupAgentWorkItems([
      narration("n1", "I'll run the tests."),
      tool("t1", "bash_tool", "running"),
    ]);

    assert.deepEqual(
      items.map((item) => item.kind),
      ["narration", "group"],
    );
    const groupItem = items[1];
    assert.equal(groupItem?.kind, "group");
    if (groupItem?.kind !== "group") return;
    assert.equal(groupItem.group.isActive, true);
    assert.equal(groupItem.group.label, "Running the tests…");
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

    assert.deepEqual(
      items.map((item) => item.kind),
      ["narration", "group"],
    );
    assert.ok(
      items.every(
        (item) =>
          item.kind !== "narration" || item.segment.id !== "n2",
      ),
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
  it("seals completed tools so a later running tool does not keep shimmering", () => {
    const items = groupAgentWorkItems([
      narration("n1", "I'll search the web."),
      tool("t1", "web_search", "done"),
      narration("n2", "Found some sources — checking one more."),
      tool("t2", "web_search", "running"),
    ]);

    assert.deepEqual(
      items.map((item) => item.kind),
      ["narration", "group", "narration", "group"],
    );
    const firstGroup = items[1];
    const secondGroup = items[3];
    assert.equal(firstGroup?.kind, "group");
    assert.equal(secondGroup?.kind, "group");
    if (firstGroup?.kind !== "group" || secondGroup?.kind !== "group") return;
    assert.equal(firstGroup.group.isActive, false);
    assert.equal(secondGroup.group.isActive, true);
  });

  it("splits done + running tools in the same buffer without narration", () => {
    const items = groupAgentWorkItems([
      tool("t1", "web_search", "done"),
      tool("t2", "web_search", "running"),
    ]);

    assert.equal(items.length, 2);
    assert.equal(items[0]?.kind, "group");
    assert.equal(items[1]?.kind, "group");
    if (items[0]?.kind !== "group" || items[1]?.kind !== "group") return;
    assert.equal(items[0].group.isActive, false);
    assert.equal(items[1].group.isActive, true);
    assert.deepEqual(
      items[0].group.segments.map((segment) => segment.id),
      ["tool-t1"],
    );
    assert.deepEqual(
      items[1].group.segments.map((segment) => segment.id),
      ["tool-t2"],
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
