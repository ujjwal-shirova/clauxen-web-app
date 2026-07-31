import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findPendingAskUserInput } from "@/lib/pending-ask-user-input";
import type { Message } from "@/lib/types";

function assistantWithAsk(
  args: Record<string, unknown>,
  status: "running" | "done" | "error" = "done",
): Message {
  return {
    id: "a1",
    role: "assistant",
    content: "",
    createdAt: Date.now(),
    agentFrames: [
      {
        id: "frame-1",
        complete: true,
        startedAtMs: 1,
        segments: [
          {
            kind: "tool",
            id: "tool-ask",
            toolCallId: "call-ask",
            name: "ask_user_input_v0",
            status,
            args,
            result:
              status === "done"
                ? JSON.stringify({
                    status: "pending_user_input",
                    questionsCount: 1,
                  })
                : undefined,
          },
        ],
      },
    ],
  };
}

describe("findPendingAskUserInput", () => {
  it("returns questions from tool args for a pending ask", () => {
    const questions = findPendingAskUserInput([
      {
        id: "u1",
        role: "user",
        content: "help me write",
        createdAt: 1,
      },
      assistantWithAsk({
        questions: [
          {
            question: "What tone?",
            options: ["Casual", "Formal"],
          },
        ],
      }),
    ]);
    assert.deepEqual(questions, [
      { question: "What tone?", options: ["Casual", "Formal"] },
    ]);
  });

  it("accepts choices as an options alias", () => {
    const questions = findPendingAskUserInput([
      assistantWithAsk({
        questions: [
          {
            question: "Length?",
            choices: ["Short", "Long"],
          },
        ],
      }),
    ]);
    assert.deepEqual(questions, [
      { question: "Length?", options: ["Short", "Long"] },
    ]);
  });

  it("returns null once a newer user message exists", () => {
    const questions = findPendingAskUserInput([
      assistantWithAsk({
        questions: [
          { question: "Tone?", options: ["A", "B"] },
        ],
      }),
      {
        id: "u2",
        role: "user",
        content: "Casual",
        createdAt: 2,
      },
    ]);
    assert.equal(questions, null);
  });

  it("accepts running status while args are already present", () => {
    const questions = findPendingAskUserInput([
      assistantWithAsk(
        {
          questions: [
            { question: "Topic?", options: ["Tech", "Life"] },
          ],
        },
        "running",
      ),
    ]);
    assert.deepEqual(questions, [
      { question: "Topic?", options: ["Tech", "Life"] },
    ]);
  });
});
