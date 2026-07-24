import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildPromptMessagesFromDbRows,
  mergePromptHistories,
} from "@/server/inference/build-chat-prompt-messages";
import type { MessageRow } from "@/server/repositories/messages.repository";

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

  it("flattens prior modelTurns to text (no thinking/tool_use replay)", () => {
    const { structured, plain } = buildPromptMessagesFromDbRows([
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
            actions: [
              {
                id: "tool-1",
                name: "create_file",
                input: { path: "demo.md" },
              },
            ],
          },
        },
      }),
      row({ id: "u2", role: "user", content: "Now present it" }),
    ]);

    assert.equal(structured.length, 3);
    assert.equal(structured[0]?.role, "user");
    assert.equal(structured[1]?.role, "assistant");
    assert.equal(typeof structured[1]?.content, "string");
    assert.match(String(structured[1]?.content), /Created the demo/);
    assert.match(String(structured[1]?.content), /create_file/);
    assert.equal(structured[2]?.role, "user");
    assert.equal(plain[1]?.role, "assistant");
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

  it("keeps alternating roles when a completed assistant answer exists", () => {
    const { plain } = buildPromptMessagesFromDbRows([
      row({ id: "u1", role: "user", content: "hi what's up and who are you?" }),
      row({
        id: "a1",
        role: "assistant",
        content:
          "Hey! I'm clauxen, an AI assistant made by shirova. What's up with you?",
      }),
      row({
        id: "u2",
        role: "user",
        content: "search the web for the latest news",
      }),
      row({
        id: "a2",
        role: "assistant",
        content: "",
        status: "streaming",
      }),
    ]);

    assert.equal(plain.length, 3);
    assert.equal(plain[0]?.role, "user");
    assert.equal(plain[1]?.role, "assistant");
    assert.match(String(plain[1]?.content), /I'm clauxen/i);
    assert.equal(plain[2]?.role, "user");
    assert.match(String(plain[2]?.content), /search the web/i);
  });
});

describe("ask_user_input prompt context", () => {
  it("keeps questionnaire tool detail when assistant answer is empty", () => {
    const { plain } = buildPromptMessagesFromDbRows([
      row({ id: "u1", role: "user", content: "Research topics for my writing" }),
      row({
        id: "a1",
        role: "assistant",
        content: "",
        content_json: {
          agent_ui: {
            modelTurns: [
              {
                stopReason: "tool_use",
                assistant: [
                  {
                    type: "text",
                    text: "To give you the most relevant research topics, let me ask a couple quick questions:",
                  },
                  {
                    type: "tool_use",
                    id: "ask-1",
                    name: "ask_user_input_v0",
                    input: {
                      questions: [
                        {
                          question: "What are you hoping to achieve with this piece?",
                          options: ["Inform or educate readers", "Tell a story"],
                        },
                      ],
                    },
                  },
                ],
                toolResults: [
                  {
                    type: "tool_result",
                    tool_use_id: "ask-1",
                    content: '{"status":"pending_user_input"}',
                  },
                ],
              },
            ],
            actions: [
              {
                id: "ask-1",
                name: "ask_user_input_v0",
                input: {
                  questions: [
                    {
                      question: "What are you hoping to achieve with this piece?",
                      options: ["Inform or educate readers", "Tell a story"],
                    },
                  ],
                },
                result: '{"status":"pending_user_input"}',
              },
            ],
          },
        },
      }),
      row({
        id: "u2",
        role: "user",
        content:
          '[Answers to your questions]\n1. Q: What are you hoping to achieve with this piece?\n   A: Inform or educate readers',
      }),
    ]);

    assert.equal(plain.length, 3);
    assert.match(String(plain[1]?.content), /ask_user_input_v0 asked/i);
    assert.match(
      String(plain[1]?.content),
      /What are you hoping to achieve with this piece/,
    );
    assert.match(String(plain[1]?.content), /relevant research topics/i);
    assert.match(String(plain[2]?.content), /Answers to your questions/);
  });
});

describe("mergePromptHistories", () => {
  it("fills empty DB assistant slots from client history", () => {
    const merged = mergePromptHistories(
      [
        { role: "user", content: "hi" },
        { role: "assistant", content: "" },
        { role: "user", content: "search news" },
      ],
      [
        { role: "user", content: "hi" },
        { role: "assistant", content: "I am clauxen." },
        { role: "user", content: "search news" },
      ],
    );
    assert.equal(merged.length, 3);
    assert.equal(merged[1]?.content, "I am clauxen.");
  });
});
