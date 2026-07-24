/**
 * Tests for chat message dedupe (optimistic + realtime races).
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dedupeChatMessages, mergeMessagePreferRich } from "@/lib/dedupe-chat-messages";
import type { Message } from "@/lib/types";

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

  it("keeps live streaming orb over empty completed snapshot", () => {
    const result = dedupeChatMessages([
      msg({
        id: "temp-asst",
        clientId: "temp-asst",
        role: "assistant",
        content: "",
        isStreaming: true,
      }),
      msg({
        id: "server-asst",
        clientId: "temp-asst",
        role: "assistant",
        content: "",
        isStreaming: false,
      }),
    ]);
    assert.equal(result.length, 1);
    assert.equal(result[0]?.isStreaming, true);
    assert.equal(result[0]?.id, "server-asst");
  });

  it("does not let empty cold row beat partial live content", () => {
    const merged = mergeMessagePreferRich(
      msg({
        id: "live",
        role: "assistant",
        content: "Hello",
        isStreaming: true,
      }),
      msg({
        id: "cold",
        role: "assistant",
        content: "",
        isStreaming: false,
      }),
    );
    assert.equal(merged.isStreaming, true);
    assert.equal(merged.content, "Hello");
  });
});
