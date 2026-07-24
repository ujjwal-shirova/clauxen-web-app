/**
 * Tests for merging legacy multi-frame events into one chronological trace.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  mergeAgentFramesForDisplay,
  resolveOrchestrationBlocks,
  type AgentFrame,
} from "@/lib/agent-frames";
import type { Message } from "@/lib/types";

describe("mergeAgentFramesForDisplay", () => {
  it("merges multiple work frames into one activity panel", () => {
    const frames: AgentFrame[] = [
      {
        id: "f1",
        complete: true,
        startedAtMs: 1000,
        completedAtMs: 4000,
        segments: [
          {
            kind: "thinking",
            id: "t1",
            content: "planning",
            isStreaming: false,
            durationSeconds: 1,
          },
        ],
      },
      {
        id: "f2",
        complete: true,
        startedAtMs: 4000,
        completedAtMs: 25000,
        segments: [
          {
            kind: "tool",
            id: "tool-1",
            toolCallId: "tc1",
            name: "web_search",
            status: "done",
            args: { query: "Moonshot AI" },
            searchQuery: "Moonshot AI",
          },
        ],
      },
    ];

    const merged = mergeAgentFramesForDisplay(frames);
    assert.equal(merged.length, 1);
    assert.equal(merged[0]?.segments.length, 2);
    assert.equal(merged[0]?.startedAtMs, 1000);
    assert.equal(merged[0]?.completedAtMs, 25000);
  });

  it("resolveOrchestrationBlocks emits a single timeline block", () => {
    const message: Message = {
      id: "m1",
      role: "assistant",
      content: "Final answer about Moonshot.",
      agentFrames: [
        {
          id: "f1",
          complete: true,
          startedAtMs: 1,
          completedAtMs: 3,
          introNarrative: "Let me search.",
          segments: [
            {
              kind: "tool",
              id: "t1",
              toolCallId: "tc1",
              name: "web_search",
              status: "done",
              args: {},
            },
          ],
        },
        {
          id: "f2",
          complete: true,
          startedAtMs: 3,
          completedAtMs: 21,
          segments: [
            {
              kind: "thinking",
              id: "th1",
              content: "notes",
              isStreaming: false,
            },
          ],
        },
      ],
    };

    const blocks = resolveOrchestrationBlocks(message);
    const timelines = blocks.filter((b) => b.kind === "timeline");
    assert.equal(timelines.length, 1);
    assert.ok(blocks.some((b) => b.kind === "markdown" && b.content.includes("Final answer")));
  });

  it("suppresses trailing answer that duplicates narration (ask_user_input)", () => {
    const intro =
      "To give you the most relevant research topics, let me ask a couple quick questions:";
    const message: Message = {
      id: "m-ask",
      role: "assistant",
      content: intro,
      agentFrames: [
        {
          id: "f1",
          complete: true,
          startedAtMs: 1,
          completedAtMs: 3,
          segments: [
            {
              kind: "narration",
              id: "n1",
              content: intro,
              isStreaming: false,
            },
            {
              kind: "tool",
              id: "t1",
              toolCallId: "tc1",
              name: "ask_user_input_v0",
              status: "done",
              args: {
                questions: [
                  {
                    question: "What are you hoping to achieve?",
                    options: ["Inform", "Persuade"],
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const blocks = resolveOrchestrationBlocks(message);
    const markdown = blocks.filter((b) => b.kind === "markdown");
    assert.equal(markdown.length, 0);
    assert.equal(blocks.filter((b) => b.kind === "timeline").length, 1);
  });
});
