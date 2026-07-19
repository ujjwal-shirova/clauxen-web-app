import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildPromptMessagesFromDbRows } from "@/backend/inference/build-chat-prompt-messages";
import type { MessageRow } from "@/backend/repositories/messages.repository";

function row(
  partial: Partial<MessageRow> & Pick<MessageRow, "id" | "role" | "content">,
): MessageRow {
  return {
    chat_id: "chat-1",
    status: "complete",
    metadata: {},
    content_json: {},
    created_at: new Date().toISOString(),
    client_id: null,
    ...partial,
  };
}

describe("buildPromptMessagesFromDbRows", () => {
  it("keeps prior assistant answers so follow-ups are not user-only", () => {
    const { plain, structured } = buildPromptMessagesFromDbRows([
      row({ id: "u1", role: "user", content: "Search Anthropic news" }),
      row({
        id: "a1",
        role: "assistant",
        content: "Here are the latest Anthropic headlines.",
      }),
      row({ id: "u2", role: "user", content: "Thanks — now summarize." }),
    ]);

    assert.equal(plain.length, 3);
    assert.equal(plain[0]?.role, "user");
    assert.equal(plain[1]?.role, "assistant");
    assert.equal(plain[2]?.role, "user");
    assert.equal(structured.length, 3);
    assert.match(String(plain[1]?.content), /Anthropic headlines/);
  });

  it("replays structured modelTurns including tool rounds", () => {
    const { structured } = buildPromptMessagesFromDbRows([
      row({ id: "u1", role: "user", content: "Create a demo file" }),
      row({
        id: "a1",
        role: "assistant",
        content: "Created the demo.",
        content_json: {
          agent_ui: {
            modelTurns: [
              {
                stopReason: "tool_use",
                assistant: [
                  { type: "thinking", thinking: "plan" },
                  {
                    type: "tool_use",
                    id: "tool-1",
                    name: "create_file",
                    input: { path: "demo.md", content: "hi" },
                  },
                ],
                toolResults: [
                  {
                    type: "tool_result",
                    tool_use_id: "tool-1",
                    content: '{"ok":true}',
                  },
                ],
              },
              {
                stopReason: "end_turn",
                assistant: [{ type: "text", text: "Created the demo." }],
              },
            ],
          },
        },
      }),
      row({ id: "u2", role: "user", content: "Now present it" }),
    ]);

    assert.ok(structured.length >= 4);
    assert.equal(structured[0]?.role, "user");
    assert.equal(structured[1]?.role, "assistant");
    assert.equal(structured[2]?.role, "user");
    assert.equal(structured[structured.length - 1]?.role, "user");
  });

  it("skips empty streaming assistant placeholders", () => {
    const { plain } = buildPromptMessagesFromDbRows([
      row({ id: "u1", role: "user", content: "Hello" }),
      row({
        id: "a-stream",
        role: "assistant",
        content: "",
        status: "streaming",
      }),
    ]);
    assert.equal(plain.length, 1);
    assert.equal(plain[0]?.role, "user");
  });
});
