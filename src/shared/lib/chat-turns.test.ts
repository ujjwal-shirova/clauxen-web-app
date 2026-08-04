/**
 * End-to-end transcript flow: optimistic paint → SSE id remap → realtime rows
 * → hydrate, across a follow-up send and a queue flush.
 *
 * These replay the pipeline that produced the "follow-up answer renders under
 * the previous user message and the previous answer disappears" bug.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { groupMessagesIntoTurns } from "@/lib/chat-turns";
import {
  dedupeChatMessages,
  sealCompletedAssistantMessages,
} from "@/lib/dedupe-chat-messages";
import {
  assistantClientIdForTurn,
  deriveTurnIdFromClientId,
  userClientIdForTurn,
} from "@/lib/chat-turn-id";
import type { Message } from "@/lib/types";

/** Mirrors `setAllChatsNormalized` — every store write normalizes the list. */
function commit(list: readonly Message[]): Message[] {
  return dedupeChatMessages(list);
}

function turnShape(messages: readonly Message[]) {
  return groupMessagesIntoTurns(messages).map((group) => ({
    user: group.userMessage?.content ?? null,
    answers: group.assistantMessages.map((m) => m.content),
  }));
}

function optimisticTurn(
  turnId: string,
  prompt: string,
  stamp: number,
): [Message, Message] {
  return [
    {
      id: `temp-${userClientIdForTurn(turnId)}`,
      clientId: userClientIdForTurn(turnId),
      turnId,
      role: "user",
      content: prompt,
      createdAt: stamp,
    },
    {
      id: assistantClientIdForTurn(turnId),
      clientId: assistantClientIdForTurn(turnId),
      turnId,
      role: "assistant",
      content: "",
      createdAt: stamp + 1,
      isStreaming: true,
      agentMode: true,
      agentFrameComplete: false,
    },
  ];
}

/** Mirrors `mapApiMessage` for a persisted row. */
function dbRow(
  dbId: string,
  clientId: string,
  role: Message["role"],
  content: string,
  createdAt: number,
  streaming = false,
): Message {
  return {
    id: dbId,
    clientId,
    turnId: deriveTurnIdFromClientId(clientId),
    role,
    content,
    createdAt,
    isStreaming: streaming,
  };
}

describe("chat transcript flow", () => {
  const t1 = "t-turn-one";
  const t2 = "t-turn-two";

  it("keeps each answer under its own prompt through a full follow-up", () => {
    const base = 1_700_000_000_000;

    // Turn 1 finishes and is persisted.
    let list = commit([
      dbRow("db-u1", userClientIdForTurn(t1), "user", "hi what's up", base),
      dbRow(
        "db-a1",
        assistantClientIdForTurn(t1),
        "assistant",
        "Hey! How can I help?",
        base + 1,
      ),
    ]);
    assert.deepEqual(turnShape(list), [
      { user: "hi what's up", answers: ["Hey! How can I help?"] },
    ]);

    // Follow-up: optimistic user + blank orb paint together.
    list = commit([
      ...list,
      ...optimisticTurn(t2, "what things you can do for me", base + 60_000),
    ]);
    assert.deepEqual(turnShape(list), [
      { user: "hi what's up", answers: ["Hey! How can I help?"] },
      { user: "what things you can do for me", answers: [""] },
    ]);

    // SSE remaps optimistic ids to durable DB ids (client ids are unchanged).
    list = commit(
      list.map((message) => {
        if (message.turnId !== t2) return message;
        return {
          ...message,
          id: message.role === "user" ? "db-u2" : "db-a2",
        };
      }),
    );

    // Realtime INSERT echoes the same durable rows while tokens stream.
    list = commit([
      ...list,
      dbRow("db-u2", userClientIdForTurn(t2), "user", "what things you can do for me", base + 60_000),
      dbRow("db-a2", assistantClientIdForTurn(t2), "assistant", "", base + 60_001, true),
    ]);

    // Tokens arrive for turn 2 only.
    list = commit(
      list.map((message) =>
        message.id === "db-a2"
          ? { ...message, content: "I can help with quite a lot." }
          : message,
      ),
    );

    assert.deepEqual(turnShape(list), [
      { user: "hi what's up", answers: ["Hey! How can I help?"] },
      {
        user: "what things you can do for me",
        answers: ["I can help with quite a lot."],
      },
    ]);
  });

  it("survives a hydrate snapshot landing mid-stream", () => {
    const base = 1_700_000_000_000;

    let list = commit([
      dbRow("db-u1", userClientIdForTurn(t1), "user", "hi what's up", base),
      dbRow("db-a1", assistantClientIdForTurn(t1), "assistant", "Hey!", base + 1),
      ...optimisticTurn(t2, "what things you can do for me", base + 60_000),
    ]);

    // A stale server snapshot arrives: turn 2's assistant row is still empty.
    const hydrateSnapshot = [
      dbRow("db-u1", userClientIdForTurn(t1), "user", "hi what's up", base),
      dbRow("db-a1", assistantClientIdForTurn(t1), "assistant", "Hey!", base + 1),
      dbRow("db-u2", userClientIdForTurn(t2), "user", "what things you can do for me", base + 60_000),
      dbRow("db-a2", assistantClientIdForTurn(t2), "assistant", "", base + 60_001, true),
    ];
    list = commit([...list, ...hydrateSnapshot]);

    const shape = turnShape(list);
    assert.equal(shape.length, 2);
    assert.equal(shape[0]?.user, "hi what's up");
    assert.deepEqual(shape[0]?.answers, ["Hey!"]);
    assert.equal(shape[1]?.user, "what things you can do for me");
    assert.equal(shape[1]?.answers.length, 1);
  });

  it("does not let a queue flush steal the previous answer", () => {
    const base = 1_700_000_000_000;

    // Turn 1 just finished streaming; the queued prompt sends immediately.
    const sealed = sealCompletedAssistantMessages([
      dbRow("db-u1", userClientIdForTurn(t1), "user", "hi what's up", base),
      {
        ...dbRow(
          "db-a1",
          assistantClientIdForTurn(t1),
          "assistant",
          "Hey! How can I help?",
          base + 1,
        ),
        // Stale live flag at the exact moment the queue drains.
        isStreaming: true,
      },
    ]);

    const list = commit([
      ...sealed,
      ...optimisticTurn(t2, "queued follow up", base + 2),
    ]);

    assert.deepEqual(turnShape(list), [
      { user: "hi what's up", answers: ["Hey! How can I help?"] },
      { user: "queued follow up", answers: [""] },
    ]);
  });

  it("keeps answers paired when the previous row is timestamped later", () => {
    const base = 1_700_000_000_000;

    // Clock skew: turn 1's answer is stamped after turn 2's prompt.
    const list = commit([
      dbRow("db-u1", userClientIdForTurn(t1), "user", "first", base),
      dbRow("db-a1", assistantClientIdForTurn(t1), "assistant", "first answer", base + 5_000),
      dbRow("db-u2", userClientIdForTurn(t2), "user", "second", base + 1_000),
      dbRow("db-a2", assistantClientIdForTurn(t2), "assistant", "", base + 1_001, true),
    ]);

    assert.deepEqual(turnShape(list), [
      { user: "first", answers: ["first answer"] },
      { user: "second", answers: [""] },
    ]);
  });

  it("folds a duplicate blank orb into the live answer of the same turn", () => {
    const base = 1_700_000_000_000;
    const [user, orb] = optimisticTurn(t1, "hello", base);

    const list = commit([
      user,
      { ...orb, id: "db-a1", content: "streaming text" },
      orb,
    ]);

    assert.deepEqual(turnShape(list), [
      { user: "hello", answers: ["streaming text"] },
    ]);
  });

  it("keeps a regenerated answer under the turn it belongs to", () => {
    const base = 1_700_000_000_000;

    // Regenerate/edit creates an untagged assistant for an existing turn.
    const list = commit([
      dbRow("db-u1", userClientIdForTurn(t1), "user", "first", base),
      dbRow("db-u2", userClientIdForTurn(t2), "user", "second", base + 10),
      {
        id: "regen-1",
        role: "assistant",
        content: "regenerated answer",
        createdAt: base + 11,
      },
    ]);

    assert.deepEqual(turnShape(list), [
      { user: "first", answers: [] },
      { user: "second", answers: ["regenerated answer"] },
    ]);
  });

  it("still pairs legacy transcripts that have no turn ids", () => {
    const base = 1_700_000_000_000;
    const list = commit([
      { id: "u1", role: "user", content: "first", createdAt: base },
      { id: "a1", role: "assistant", content: "first answer", createdAt: base + 1 },
      { id: "u2", role: "user", content: "second", createdAt: base + 2 },
      { id: "a2", role: "assistant", content: "second answer", createdAt: base + 3 },
    ]);

    assert.deepEqual(turnShape(list), [
      { user: "first", answers: ["first answer"] },
      { user: "second", answers: ["second answer"] },
    ]);
  });
});

describe("chat turn ids", () => {
  it("round-trips through client ids", () => {
    const turnId = "t-abc-123";
    assert.equal(
      deriveTurnIdFromClientId(userClientIdForTurn(turnId)),
      turnId,
    );
    assert.equal(
      deriveTurnIdFromClientId(assistantClientIdForTurn(turnId)),
      turnId,
    );
  });

  it("ignores unrelated client ids", () => {
    assert.equal(deriveTurnIdFromClientId("some-uuid"), undefined);
    assert.equal(deriveTurnIdFromClientId(undefined), undefined);
    assert.equal(deriveTurnIdFromClientId("t-"), undefined);
  });
});
