import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  hydrateMessageFromContentJson,
  overlayBranchMessagesOnPage,
  resolveHydratedChatMessages,
} from "@/frontend/lib/hydrate-chat-messages";
import type { Message } from "@/frontend/lib/types";

describe("hydrate-chat-messages", () => {
  it("overlays branch edits only onto loaded page ids", () => {
    const apiMessages: Message[] = [
      { id: "u1", role: "user", content: "hi" },
      { id: "a1", role: "assistant", content: "hello" },
    ];
    const hydrated = overlayBranchMessagesOnPage({
      pageMessages: apiMessages,
      branchMessages: [
        {
          id: "a1",
          role: "assistant",
          content: "hello edited",
          agentMode: true,
          agentFrames: [
            {
              id: "f1",
              complete: true,
              startedAtMs: 1,
              segments: [],
            },
          ],
        },
        // Extra branch history must not expand the page.
        { id: "old-u", role: "user", content: "ancient" },
        { id: "old-a", role: "assistant", content: "ancient reply" },
      ],
    });
    assert.equal(hydrated.length, 2);
    assert.equal(hydrated[0]?.id, "u1");
    assert.equal(hydrated[1]?.content, "hello edited");
    assert.equal(hydrated[1]?.agentMode, true);
  });

  it("resolveHydratedChatMessages prefers page length over branch blob", () => {
    const apiMessages: Message[] = [
      { id: "u1", role: "user", content: "hi" },
      { id: "a1", role: "assistant", content: "hello" },
    ];
    const hydrated = resolveHydratedChatMessages({
      apiMessages,
      branchMessages: [
        { id: "u1", role: "user", content: "hi" },
        { id: "a1", role: "assistant", content: "hello" },
        { id: "a1-dup", role: "assistant", content: "hello" },
      ],
    });
    assert.equal(hydrated.length, 2);
  });

  it("hydrates thinking + tools from Cursor content_json", () => {
    const base: Message = {
      id: "a1",
      role: "assistant",
      content: "Done",
    };
    const hydrated = hydrateMessageFromContentJson(base, {
      role: "assistant",
      message: {
        content: [
          { type: "thinking", thinking: "plan" },
          { type: "text", text: "Done" },
          {
            type: "tool_use",
            id: "t1",
            name: "web_search",
            input: { query: "nvidia" },
          },
          {
            type: "tool_result",
            tool_use_id: "t1",
            content: "[]",
          },
        ],
      },
    });
    assert.equal(hydrated.thinkingContent, "plan");
    assert.equal(hydrated.agentFrames?.length, 1);
    assert.equal(
      hydrated.agentFrames?.[0]?.segments.some((s) => s.kind === "tool"),
      true,
    );
  });
});
