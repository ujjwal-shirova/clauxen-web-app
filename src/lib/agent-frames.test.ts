/**
 * Tests for merging legacy multi-frame events into one chronological trace
 * and for the answer/narration dedupe guard.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  agentAnswerDuplicatesInterim,
  mergeAgentFramesForDisplay,
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
});

describe("agentAnswerDuplicatesInterim", () => {
  it("suppresses trailing content that duplicates progress narration", () => {
    const note =
      "To give you the most relevant research topics, let me ask a couple quick questions:";
    const message: Message = {
      id: "m-ask",
      role: "assistant",
      content: note,
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
              content: note,
              isStreaming: false,
            },
            {
              kind: "tool",
              id: "t1",
              toolCallId: "tc1",
              name: "ask_user_input_v0",
              status: "done",
              args: {},
            },
          ],
        },
      ],
    };

    assert.equal(agentAnswerDuplicatesInterim(message), true);
  });

  it("never suppresses the promoted final answer (isFinal segment)", () => {
    const answer = "Here is the full report on Moonshot AI.";
    const message: Message = {
      id: "m-final",
      role: "assistant",
      content: answer,
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
              content: "Searching the web for Moonshot AI…",
              isStreaming: false,
            },
            {
              kind: "tool",
              id: "t1",
              toolCallId: "tc1",
              name: "web_search",
              status: "done",
              args: { query: "Moonshot AI" },
            },
            {
              kind: "narration",
              id: "n2",
              content: answer,
              isStreaming: false,
              isFinal: true,
            },
          ],
        },
      ],
    };

    assert.equal(agentAnswerDuplicatesInterim(message), false);
  });
});
