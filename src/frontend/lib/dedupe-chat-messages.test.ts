/**
 * Tests for chat message dedupe (optimistic + realtime races).
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dedupeChatMessages } from "@/frontend/lib/dedupe-chat-messages";
import type { Message } from "@/frontend/lib/types";

function msg(
  partial: Partial<Message> & Pick<Message, "id" | "role" | "content">,
): Message {
  return { ...partial };
}

describe("dedupeChatMessages", () => {
  it("collapses temp user + durable user with same content", () => {
    const result = dedupeChatMessages([
      msg({
        id: "temp-1",
        role: "user",
        content: "hi, who are you?",
      }),
      msg({
        id: "msg-real",
        role: "user",
        content: "hi, who are you?",
      }),
      msg({
        id: "asst-1",
        role: "assistant",
        content: "Hello!",
      }),
    ]);
    assert.equal(result.filter((m) => m.role === "user").length, 1);
    assert.equal(result[0]?.id, "msg-real");
    assert.equal(result.length, 2);
  });

  it("collapses consecutive duplicate user bubbles", () => {
    const result = dedupeChatMessages([
      msg({ id: "a", role: "user", content: "same" }),
      msg({ id: "b", role: "user", content: "same" }),
    ]);
    assert.equal(result.length, 1);
  });
});
