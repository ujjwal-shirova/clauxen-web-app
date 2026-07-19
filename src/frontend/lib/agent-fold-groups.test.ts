import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  countContentLineDiff,
  groupAgentTraceItems,
  resolveFoldLivePreview,
  shouldUseFoldChrome,
  summarizeFoldSegments,
} from "@/frontend/lib/agent-fold-groups";
import type { AgentSegment } from "@/frontend/lib/agent-segments";

describe("agent-fold-groups", () => {
  it("groups thinking+tools into folds and keeps narration between them", () => {
    const segments: AgentSegment[] = [
      {
        kind: "thinking",
        id: "t1",
        content: "plan",
        isStreaming: false,
        durationSeconds: 2,
      },
      {
        kind: "tool",
        id: "s1",
        toolCallId: "s1",
        name: "web_search",
        status: "done",
        searchResults: [],
      },
      {
        kind: "tool",
        id: "f1",
        toolCallId: "f1",
        name: "create_file",
        status: "done",
        filePath: "a.md",
      },
      {
        kind: "narration",
        id: "n1",
        content: "Next I will summarize.",
      },
      {
        kind: "thinking",
        id: "t2",
        content: "more",
        isStreaming: false,
      },
      {
        kind: "tool",
        id: "s2",
        toolCallId: "s2",
        name: "web_search",
        status: "done",
      },
    ];

    const items = groupAgentTraceItems(segments);
    assert.equal(items.length, 3);
    assert.equal(items[0]?.kind, "fold");
    assert.equal(items[1]?.kind, "narration");
    assert.equal(items[2]?.kind, "fold");
    if (items[0]?.kind === "fold") {
      assert.equal(items[0].useChrome, true);
      assert.equal(items[0].summary.label, "Worked across 1 file, 1 search");
      assert.equal(items[0].segments.length, 3);
    }
    if (items[2]?.kind === "fold") {
      assert.equal(items[2].useChrome, true);
      assert.equal(items[2].summary.label, "Searched 1 search");
    }
  });

  it("keeps lone tools bare (no chrome) including live search", () => {
    assert.equal(
      shouldUseFoldChrome([{ kind: "thinking", id: "t", content: "x" }], {
        isActive: true,
      }),
      false,
    );
    assert.equal(
      shouldUseFoldChrome(
        [
          {
            kind: "tool",
            id: "s",
            toolCallId: "s",
            name: "web_search",
            status: "running",
          },
        ],
        { isActive: true },
      ),
      false,
    );
    assert.equal(
      shouldUseFoldChrome(
        [
          {
            kind: "tool",
            id: "f",
            toolCallId: "f",
            name: "create_file",
            status: "done",
            filePath: "a.md",
          },
        ],
      ),
      false,
    );

    const live = summarizeFoldSegments(
      [
        {
          kind: "tool",
          id: "s",
          toolCallId: "s",
          name: "web_search",
          status: "running",
          searchQuery: "Anthropic news",
        },
      ],
      { isActive: true },
    );
    assert.match(live.label, /^Searching/);

    const preview = resolveFoldLivePreview([
      {
        kind: "tool",
        id: "s",
        toolCallId: "s",
        name: "web_search",
        status: "running",
        searchQuery: "Anthropic news",
      },
    ]);
    assert.equal(preview, "Searching · Anthropic news");
  });

  it("summarizes tools without thought duration", () => {
    const summary = summarizeFoldSegments([
      {
        kind: "thinking",
        id: "t",
        content: "x",
        durationSeconds: 99,
      },
      {
        kind: "tool",
        id: "b",
        toolCallId: "b",
        name: "bash_tool",
        status: "done",
      },
      {
        kind: "tool",
        id: "m",
        toolCallId: "m",
        name: "weather_fetch",
        status: "done",
      },
    ]);
    assert.equal(summary.label, "Used 2 tools");
    assert.equal(summary.toolCount, 2);
  });

  it("counts create_file line diffs", () => {
    assert.deepEqual(countContentLineDiff("a\nb\nc"), {
      insertions: 3,
      deletions: 0,
    });
    assert.deepEqual(countContentLineDiff("a\nb", "x\ny\nz"), {
      insertions: 2,
      deletions: 3,
    });
  });
});
