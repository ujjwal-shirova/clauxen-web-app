import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEVICE_CHAT_MESSAGE_LIMIT,
  buildDeviceChatMeta,
} from "@/lib/device-chat-cache";

describe("device-chat-cache", () => {
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

  it("does not persist message bodies on device (edge-first)", () => {
    assert.equal(DEVICE_CHAT_MESSAGE_LIMIT, 0);
  });
});
