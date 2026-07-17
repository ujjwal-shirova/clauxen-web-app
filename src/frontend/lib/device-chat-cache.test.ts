import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEVICE_CHAT_MESSAGE_LIMIT,
  buildDeviceChatMeta,
  messagesForDeviceCache,
} from "@/frontend/lib/device-chat-cache";
import type { Message } from "@/frontend/lib/types";

describe("device-chat-cache", () => {
  it("strips streaming flags before device persist", () => {
    const input: Message[] = [
      {
        id: "m1",
        role: "assistant",
        content: "hello",
        isStreaming: true,
        isThinkingStreaming: true,
      },
    ];
    const out = messagesForDeviceCache(input);
    assert.equal(out[0]?.isStreaming, false);
    assert.equal(out[0]?.isThinkingStreaming, false);
    assert.equal(out[0]?.content, "hello");
  });

  it("scopes meta to user and drops pending chat ids", () => {
    const meta = buildDeviceChatMeta({
      userId: "user-1",
      activeChatId: "pending-abc",
      recentChats: [
        { id: "pending-abc", name: "New chat", updatedAt: 2 },
        { id: "real-chat", name: "Hello", updatedAt: 1, pinned: true },
      ],
    });
    assert.equal(meta.userId, "user-1");
    assert.equal(meta.recentChats.length, 1);
    assert.equal(meta.recentChats[0]?.id, "real-chat");
    assert.ok(typeof meta.savedAt === "number");
  });

  it("keeps a bounded message cache budget", () => {
    assert.equal(DEVICE_CHAT_MESSAGE_LIMIT, 40);
  });
});
