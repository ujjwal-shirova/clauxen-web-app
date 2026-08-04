/**
 * Tests for chat message dedupe (optimistic + realtime races).
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  dedupeChatMessages,
  healChatMessageOrder,
  mergeMessagePreferRich,
} from "@/lib/dedupe-chat-messages";
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

  it("collapses non-consecutive duplicate user bubbles across an assistant row", () => {
    const stamp = Date.now();
    const result = dedupeChatMessages([
      msg({ id: "u-temp", role: "user", content: "tell me about Thinking" }),
      msg({
        id: "a-1",
        role: "assistant",
        content: "Working…",
        isStreaming: true,
      }),
      msg({
        id: "u-durable",
        role: "user",
        content: "tell me about Thinking",
        createdAt: stamp,
      }),
    ]);
    assert.equal(result.filter((m) => m.role === "user").length, 1);
    // Durable id wins so React keys stabilize on the server row.
    assert.equal(result[0]?.id, "u-durable");
  });

  it("keeps a genuine re-send of identical text minutes later", () => {
    const t0 = 1_700_000_000_000;
    const result = dedupeChatMessages([
      msg({ id: "u1", role: "user", content: "yes", createdAt: t0 }),
      msg({
        id: "a1",
        role: "assistant",
        content: "Great!",
        createdAt: t0,
      }),
      msg({
        id: "u2",
        role: "user",
        content: "yes",
        createdAt: t0 + 10 * 60 * 1000,
      }),
    ]);
    assert.equal(result.filter((m) => m.role === "user").length, 2);
  });

  it("heals a durable user row appended after its assistant pair", () => {
    const stamp = 1_700_000_000_000;
    const healed = healChatMessageOrder([
      msg({ id: "a1", role: "assistant", content: "Answer", createdAt: stamp }),
      msg({ id: "u1", role: "user", content: "Question", createdAt: stamp }),
    ]);
    assert.deepEqual(
      healed.map((m) => m.id),
      ["u1", "a1"],
    );
  });

  it("keeps dated rows before undated optimistic rows", () => {
    const stamp = 1_700_000_000_000;
    const healed = healChatMessageOrder([
      msg({ id: "a-old", role: "assistant", content: "Old", createdAt: stamp }),
      msg({ id: "temp-u", role: "user", content: "New question" }),
      msg({ id: "temp-a", role: "assistant", content: "", isStreaming: true }),
    ]);
    assert.deepEqual(
      healed.map((m) => m.id),
      ["a-old", "temp-u", "temp-a"],
    );
  });

  it("orders full broken transcripts: user below assistant moves back up", () => {
    const stamp = 1_700_000_000_000;
    const result = dedupeChatMessages([
      msg({
        id: "a1",
        role: "assistant",
        content: "Here you go",
        createdAt: stamp,
      }),
      msg({ id: "u1", role: "user", content: "first", createdAt: stamp }),
      msg({
        id: "a2",
        role: "assistant",
        content: "Next answer",
        createdAt: stamp + 60_000,
      }),
      msg({ id: "u2", role: "user", content: "second", createdAt: stamp + 60_000 }),
    ]);
    assert.deepEqual(
      result.map((m) => m.id),
      ["u1", "a1", "u2", "a2"],
    );
  });

  it("heals user appended after assistant when timestamps differ slightly", () => {
    const stamp = 1_700_000_000_000;
    const result = dedupeChatMessages([
      msg({
        id: "a1",
        role: "assistant",
        content: "I was built by Shirova AI…",
        createdAt: stamp + 40,
      }),
      msg({
        id: "u1",
        role: "user",
        content: "so who made you and what makes you different than chatgpt",
        createdAt: stamp + 120,
      }),
    ]);
    assert.deepEqual(
      result.map((m) => m.id),
      ["u1", "a1"],
    );
  });

  it("moves a live follow-up assistant out from under the previous user", () => {
    const stamp = 1_700_000_000_000;
    // Dated streaming A2 + undated U2 sorts as U1,A2,U2 — heal must swap
    // even though A2 already has a leading user (the previous turn).
    const result = dedupeChatMessages([
      msg({ id: "u1", role: "user", content: "first", createdAt: stamp }),
      msg({
        id: "a2",
        role: "assistant",
        content: "",
        createdAt: stamp + 60_001,
        isStreaming: true,
      }),
      msg({
        id: "u2",
        role: "user",
        content: "follow up",
      }),
    ]);
    assert.deepEqual(
      result.map((m) => m.id),
      ["u1", "u2", "a2"],
    );
  });

  it("keeps a completed previous answer with its user when a follow-up arrives", () => {
    const stamp = 1_700_000_000_000;
    const result = dedupeChatMessages([
      msg({ id: "u1", role: "user", content: "first", createdAt: stamp }),
      msg({
        id: "a1",
        role: "assistant",
        content: "first answer",
        createdAt: stamp + 1,
      }),
      msg({
        id: "u2",
        role: "user",
        content: "follow up",
        createdAt: stamp + 60_000,
      }),
      msg({
        id: "a2",
        role: "assistant",
        content: "",
        createdAt: stamp + 60_001,
        isStreaming: true,
      }),
    ]);
    assert.deepEqual(
      result.map((m) => m.id),
      ["u1", "a1", "u2", "a2"],
    );
  });
});
