import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEVICE_CHAT_MESSAGE_LIMIT,
  buildDeviceChatMeta,
  clearSyncDeviceChatList,
  readSyncDeviceChatList,
  writeSyncDeviceChatList,
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

  it("sync localStorage list is scoped to userId", () => {
    const store = new Map<string, string>();
    const g = globalThis as typeof globalThis & {
      window?: unknown;
      localStorage?: Storage;
    };
    const prevWindow = g.window;
    const prevStorage = g.localStorage;
    g.window = g;
    g.localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
      clear: () => store.clear(),
      key: () => null,
      get length() {
        return store.size;
      },
    };

    try {
      writeSyncDeviceChatList("user-1", [
        { id: "c1", name: "Alpha", updatedAt: 1, pinned: true },
      ]);
      assert.equal(readSyncDeviceChatList("user-2"), null);
      const rows = readSyncDeviceChatList("user-1");
      assert.equal(rows?.length, 1);
      assert.equal(rows?.[0]?.id, "c1");
      clearSyncDeviceChatList();
      assert.equal(readSyncDeviceChatList("user-1"), null);
    } finally {
      g.window = prevWindow;
      g.localStorage = prevStorage;
    }
  });
});
