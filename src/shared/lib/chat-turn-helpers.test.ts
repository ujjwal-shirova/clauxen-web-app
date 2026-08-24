import assert from "node:assert/strict";
import test from "node:test";
import type { Message } from "@/lib/types";
import { unionChatTranscript } from "@/lib/chat-turn-helpers";
import { groupMessagesIntoTurns } from "@/lib/chat-turns";

function msg(
  partial: Pick<Message, "id" | "role"> & Partial<Message>,
): Message {
  return {
    content: "",
    ...partial,
  };
}

test("idle hydrate keeps a local assistant the snapshot omitted", () => {
  const local = [
    msg({
      id: "u1",
      role: "user",
      turnId: "t1",
      content: "first",
      createdAt: 1,
    }),
    msg({
      id: "a1",
      role: "assistant",
      turnId: "t1",
      content: "hello",
      createdAt: 2,
    }),
    msg({
      id: "u2",
      role: "user",
      turnId: "t2",
      content: "follow up",
      createdAt: 3,
    }),
  ];
  const remote = [
    msg({
      id: "u1",
      role: "user",
      turnId: "t1",
      content: "first",
      createdAt: 1,
    }),
    msg({
      id: "u2",
      role: "user",
      turnId: "t2",
      content: "follow up",
      createdAt: 3,
    }),
    msg({
      id: "a2",
      role: "assistant",
      turnId: "t2",
      content: "next",
      createdAt: 4,
    }),
  ];

  const merged = unionChatTranscript(local, remote, { live: false });
  const assistantIds = merged
    .filter((message) => message.role === "assistant")
    .map((message) => message.id);

  assert.deepEqual(assistantIds, ["a2", "a1"]);
});

test("live hydrate never drops a filled local assistant", () => {
  const local = [
    msg({
      id: "u1",
      role: "user",
      turnId: "t1",
      content: "q",
      createdAt: 1,
    }),
    msg({
      id: "a1",
      role: "assistant",
      turnId: "t1",
      content: "answer",
      createdAt: 2,
    }),
    msg({
      id: "u2",
      role: "user",
      turnId: "t2",
      content: "again",
      createdAt: 3,
    }),
    msg({
      id: "a2",
      role: "assistant",
      turnId: "t2",
      content: "",
      isStreaming: true,
      createdAt: 4,
    }),
  ];
  const remote = [
    msg({
      id: "u1",
      role: "user",
      turnId: "t1",
      content: "q",
      createdAt: 1,
    }),
    msg({
      id: "u2",
      role: "user",
      turnId: "t2",
      content: "again",
      createdAt: 3,
    }),
  ];

  const merged = unionChatTranscript(local, remote, { live: true });
  assert.equal(
    merged.some((message) => message.id === "a1" && message.content === "answer"),
    true,
  );
  assert.equal(
    merged.some((message) => message.id === "a2" && message.isStreaming),
    true,
  );
});

test("grouping reattaches an assistant that arrives after a later user", () => {
  const messages = [
    msg({ id: "u1", role: "user", turnId: "t1", content: "one" }),
    msg({ id: "u2", role: "user", turnId: "t2", content: "two" }),
    msg({
      id: "a1",
      role: "assistant",
      turnId: "t1",
      content: "first answer",
    }),
    msg({
      id: "a2",
      role: "assistant",
      turnId: "t2",
      content: "second answer",
    }),
  ];

  const groups = groupMessagesIntoTurns(messages);
  assert.equal(groups.length, 2);
  assert.equal(groups[0]?.userMessage?.id, "u1");
  assert.deepEqual(
    groups[0]?.assistantMessages.map((message) => message.id),
    ["a1"],
  );
  assert.equal(groups[1]?.userMessage?.id, "u2");
  assert.deepEqual(
    groups[1]?.assistantMessages.map((message) => message.id),
    ["a2"],
  );
});
