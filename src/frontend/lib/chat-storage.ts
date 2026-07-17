"use client";

import { get, set, del, keys, clear, createStore } from "idb-keyval";
import type { Message, RecentChat } from "@/frontend/lib/types";
import { compactMessageBranchData } from "@/frontend/lib/chat-branch";

/**
 * Single object store — v2 after fixing multi-store NotFoundError on v1.
 * Used by both local/offline (`useLocalChat`) and signed-in device cache
 * (`device-chat-cache` → `useChatApi`).
 */
const CHAT_DB = createStore("clauxen-chat-v2", "kv");

export const CHAT_STORAGE_KEY = "clauxen-chat-state-v1";
export const BRANCH_DATASET_KEY = "clauxen-branch-dataset-v1";

export type PersistedChatMeta = {
  /** Owner of this device cache — ignore/clear when auth user changes. */
  userId?: string;
  savedAt?: number;
  recentChats: RecentChat[];
  activeChatId: string | null;
  branchDataset: Record<
    string,
    Record<
      string,
      { activeIndex: number; totalVersions: number; updatedAt: number }
    >
  >;
};

export type ChatSliceKey = `chat:${string}:slice:${number}`;

function sliceKey(chatId: string, sliceIndex: number): ChatSliceKey {
  return `chat:${chatId}:slice:${sliceIndex}`;
}

const SLICE_SIZE = 50;

function compactMessages(messages: Message[]): Message[] {
  return messages.map(compactMessageBranchData);
}

/** Serialize and write chat messages in slices to IndexedDB (off-heap). */
export async function persistChatToIndexedDB(
  chatId: string,
  messages: Message[],
): Promise<void> {
  const compacted = compactMessages(messages);
  const sliceCount = Math.ceil(compacted.length / SLICE_SIZE) || 1;

  for (let i = 0; i < sliceCount; i++) {
    const slice = compacted.slice(i * SLICE_SIZE, (i + 1) * SLICE_SIZE);
    await set(sliceKey(chatId, i), JSON.stringify(slice), CHAT_DB);
  }

  await set(`chat:${chatId}:slice-count`, sliceCount, CHAT_DB);

  const allKeys = await keys(CHAT_DB);
  for (const key of allKeys) {
    const keyStr = String(key);
    if (
      keyStr.startsWith(`chat:${chatId}:slice:`) &&
      !keyStr.endsWith(":slice-count")
    ) {
      const match = keyStr.match(/slice:(\d+)$/);
      if (match && Number(match[1]) >= sliceCount) {
        await del(key, CHAT_DB);
      }
    }
  }
}

/** Load a paginated slice of messages from IndexedDB. */
export async function loadChatSliceFromIndexedDB(
  chatId: string,
  sliceIndex: number,
): Promise<Message[] | null> {
  const raw = await get<string>(sliceKey(chatId, sliceIndex), CHAT_DB);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Message[];
  } catch {
    return null;
  }
}

export async function loadFullChatFromIndexedDB(
  chatId: string,
): Promise<Message[]> {
  const sliceCount =
    (await get<number>(`chat:${chatId}:slice-count`, CHAT_DB)) ?? 0;
  if (sliceCount === 0) return [];

  const all: Message[] = [];
  for (let i = 0; i < sliceCount; i++) {
    const slice = await loadChatSliceFromIndexedDB(chatId, i);
    if (slice) all.push(...slice);
  }
  return all;
}

export async function deleteChatFromIndexedDB(chatId: string): Promise<void> {
  const sliceCount =
    (await get<number>(`chat:${chatId}:slice-count`, CHAT_DB)) ?? 0;
  for (let i = 0; i < sliceCount; i++) {
    await del(sliceKey(chatId, i), CHAT_DB);
  }
  await del(`chat:${chatId}:slice-count`, CHAT_DB);
}

/** Chat ids that have at least one persisted message slice. */
export async function listIndexedDBChatIds(): Promise<string[]> {
  const allKeys = await keys(CHAT_DB);
  const ids = new Set<string>();
  for (const key of allKeys) {
    const match = String(key).match(/^chat:([^:]+):slice-count$/);
    if (match?.[1]) ids.add(match[1]);
  }
  return [...ids];
}

export async function clearAllChatIndexedDB(): Promise<void> {
  await clear(CHAT_DB);
}

export async function persistChatMeta(
  meta: PersistedChatMeta,
): Promise<void> {
  await set("meta", JSON.stringify(meta), CHAT_DB);
}

export async function loadChatMeta(): Promise<PersistedChatMeta | null> {
  const raw = await get<string>("meta", CHAT_DB);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PersistedChatMeta;
  } catch {
    return null;
  }
}

/** Migrate legacy localStorage blob into IndexedDB on first load. */
export async function migrateLegacyLocalStorage(): Promise<{
  allChats: Record<string, Message[]>;
  meta: PersistedChatMeta | null;
} | null> {
  if (typeof window === "undefined") return null;

  try {
    const saved = window.localStorage.getItem(CHAT_STORAGE_KEY);
    if (!saved) return null;

    const parsed = JSON.parse(saved) as {
      allChats?: Record<string, Message[]>;
      recentChats?: RecentChat[];
      activeChatId?: string | null;
      branchDataset?: PersistedChatMeta["branchDataset"];
    };

    const allChats = parsed.allChats ?? {};
    for (const [chatId, messages] of Object.entries(allChats)) {
      await persistChatToIndexedDB(chatId, messages);
    }

    const meta: PersistedChatMeta = {
      recentChats: parsed.recentChats ?? [],
      activeChatId: parsed.activeChatId ?? null,
      branchDataset: parsed.branchDataset ?? {},
    };
    await persistChatMeta(meta);

    window.localStorage.removeItem(CHAT_STORAGE_KEY);
    return { allChats, meta };
  } catch (error) {
    console.error("Failed to migrate chat storage:", error);
    return null;
  }
}

/** Background sync: persist all chats + meta without blocking main thread UI. */
export function schedulePersistAllChats(
  allChats: Record<string, Message[]>,
  meta: PersistedChatMeta,
  delayMs = 200,
): () => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let cancelled = false;

  timeoutId = setTimeout(() => {
    void (async () => {
      if (cancelled) return;
      try {
        await persistChatMeta(meta);
        for (const [chatId, messages] of Object.entries(allChats)) {
          await persistChatToIndexedDB(chatId, messages);
        }
      } catch (error) {
        console.error("IndexedDB persist failed:", error);
      }
    })();
  }, delayMs);

  return () => {
    cancelled = true;
    if (timeoutId) clearTimeout(timeoutId);
  };
}
