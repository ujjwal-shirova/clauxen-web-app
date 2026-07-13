"use client";

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";
import type { Message, RecentChat } from "@/frontend/lib/types";

/** Stable empty references — never allocate new [] in selectors (prevents infinite loops). */
const EMPTY_IDS: readonly string[] = [];
const EMPTY_MESSAGES: readonly Message[] = [];

/** Active RAM window — only this many messages stay in heap per chat. */
export const ACTIVE_RAM_MESSAGE_WINDOW = 24;

/** Max messages retained when scrolling up before older turns are dropped from RAM. */
export const MAX_ACTIVE_CHAT_MESSAGES = 48;

export type QueuedChatMessage = {
  id: string;
  content: string;
  createdAt: number;
};

export type ChatStoreState = {
  messagesById: Record<string, Message>;
  messageIdsByChatId: Record<string, string[]>;
  recentChats: RecentChat[];
  activeChatId: string | null;
  isGenerating: boolean;
  /** Chat IDs currently streaming an assistant reply (multitask-safe). */
  generatingChatIds: Record<string, true>;
  streaming: { chatId: string; messageId: string } | null;
  queuedMessagesByChatId: Record<string, QueuedChatMessage[]>;
  branchDataset: Record<
    string,
    Record<
      string,
      { activeIndex: number; totalVersions: number; updatedAt: number }
    >
  >;
};

type ChatStoreActions = {
  getMessagesForChat: (chatId: string) => Message[];
  setChatMessages: (chatId: string, messages: Message[]) => void;
  upsertMessage: (chatId: string, message: Message) => void;
  patchMessage: (
    chatId: string,
    messageId: string,
    updater: (message: Message) => Message,
  ) => void;
  appendMessageField: (
    chatId: string,
    messageId: string,
    field: "content" | "thinkingContent",
    delta: string,
  ) => void;
  removeChat: (chatId: string) => void;
  setRecentChats: (
    updater: RecentChat[] | ((prev: RecentChat[]) => RecentChat[]),
  ) => void;
  setActiveChatId: (chatId: string | null) => void;
  setIsGenerating: (value: boolean) => void;
  setChatGenerating: (chatId: string, generating: boolean) => void;
  setStreaming: (value: { chatId: string; messageId: string } | null) => void;
  enqueueQueuedMessage: (chatId: string, content: string) => QueuedChatMessage;
  updateQueuedMessage: (chatId: string, id: string, content: string) => void;
  removeQueuedMessage: (chatId: string, id: string) => void;
  shiftQueuedMessage: (chatId: string) => QueuedChatMessage | null;
  promoteQueuedMessage: (chatId: string, id: string) => QueuedChatMessage | null;
  setBranchDataset: (
    updater:
      | ChatStoreState["branchDataset"]
      | ((prev: ChatStoreState["branchDataset"]) => ChatStoreState["branchDataset"]),
  ) => void;
  evictMessagesExcept: (chatId: string, keepIds: Set<string>) => void;
  /** Drop message bodies for every chat except `keepChatId` (re-fetched on open). */
  clearInactiveChatMessages: (keepChatId: string | null) => void;
  /** Keep the newest `limit` messages for a chat (always retains streaming rows). */
  trimChatMessagesToWindow: (chatId: string, limit?: number) => void;
  hydrateFromLegacy: (payload: {
    allChats?: Record<string, Message[]>;
    recentChats?: RecentChat[];
    activeChatId?: string | null;
    branchDataset?: ChatStoreState["branchDataset"];
  }) => void;
  exportLegacyAllChats: () => Record<string, Message[]>;
};

export type ChatStore = ChatStoreState & ChatStoreActions;

function indexMessages(messages: Message[]): {
  byId: Record<string, Message>;
  ids: string[];
} {
  const byId: Record<string, Message> = {};
  const ids: string[] = [];
  for (const message of messages) {
    if (!message?.id) continue;
    byId[message.id] = message;
    ids.push(message.id);
  }
  return { byId, ids };
}

export const useChatStore = create<ChatStore>()(
  subscribeWithSelector((set, get) => ({
    messagesById: {},
    messageIdsByChatId: {},
    recentChats: [],
    activeChatId: null,
    isGenerating: false,
    generatingChatIds: {},
    streaming: null,
    queuedMessagesByChatId: {},
    branchDataset: {},

    getMessagesForChat: (chatId) => {
      const ids = get().messageIdsByChatId[chatId] ?? [];
      const { messagesById } = get();
      return ids
        .map((id) => messagesById[id])
        .filter((m): m is Message => m !== undefined);
    },

    setChatMessages: (chatId, messages) => {
      const { byId, ids } = indexMessages(messages);
      set((state) => {
        const nextById = { ...state.messagesById };
        const prevIds = state.messageIdsByChatId[chatId] ?? [];
        for (const oldId of prevIds) {
          if (!byId[oldId]) delete nextById[oldId];
        }
        Object.assign(nextById, byId);
        return {
          messagesById: nextById,
          messageIdsByChatId: {
            ...state.messageIdsByChatId,
            [chatId]: ids,
          },
        };
      });
    },

    upsertMessage: (chatId, message) => {
      set((state) => {
        const ids = state.messageIdsByChatId[chatId] ?? [];
        const hasId = ids.includes(message.id);
        return {
          messagesById: { ...state.messagesById, [message.id]: message },
          messageIdsByChatId: {
            ...state.messageIdsByChatId,
            [chatId]: hasId ? ids : [...ids, message.id],
          },
        };
      });
    },

    patchMessage: (chatId, messageId, updater) => {
      set((state) => {
        const existing = state.messagesById[messageId];
        if (!existing) return state;
        const ids = state.messageIdsByChatId[chatId];
        if (!ids?.includes(messageId)) return state;
        return {
          messagesById: {
            ...state.messagesById,
            [messageId]: updater(existing),
          },
        };
      });
    },

    appendMessageField: (chatId, messageId, field, delta) => {
      if (!delta) return;
      set((state) => {
        const existing = state.messagesById[messageId];
        if (!existing) return state;
        const ids = state.messageIdsByChatId[chatId];
        if (!ids?.includes(messageId)) return state;
        return {
          messagesById: {
            ...state.messagesById,
            [messageId]: {
              ...existing,
              [field]: `${existing[field] ?? ""}${delta}`,
              isStreaming: true,
              ...(field === "content" ? { isThinkingStreaming: false } : {}),
            },
          },
        };
      });
    },

    removeChat: (chatId) => {
      set((state) => {
        const ids = state.messageIdsByChatId[chatId] ?? [];
        const nextById = { ...state.messagesById };
        for (const id of ids) delete nextById[id];
        const nextChats = { ...state.messageIdsByChatId };
        delete nextChats[chatId];
        const nextBranch = { ...state.branchDataset };
        delete nextBranch[chatId];
        return {
          messagesById: nextById,
          messageIdsByChatId: nextChats,
          branchDataset: nextBranch,
        };
      });
    },

    setRecentChats: (updater) => {
      set((state) => ({
        recentChats:
          typeof updater === "function" ? updater(state.recentChats) : updater,
      }));
    },

    setActiveChatId: (chatId) =>
      set((state) => ({
        activeChatId: chatId,
        isGenerating: Boolean(chatId && state.generatingChatIds[chatId]),
      })),

    setIsGenerating: (value) => set({ isGenerating: value }),

    setChatGenerating: (chatId, generating) => {
      set((state) => {
        const next = { ...state.generatingChatIds };
        if (generating) next[chatId] = true;
        else delete next[chatId];
        const activeGenerating = Boolean(
          state.activeChatId && next[state.activeChatId],
        );
        return {
          generatingChatIds: next,
          isGenerating: activeGenerating,
          streaming: generating
            ? state.streaming?.chatId === chatId
              ? state.streaming
              : state.streaming
            : state.streaming?.chatId === chatId
              ? null
              : state.streaming,
        };
      });
    },

    setStreaming: (value) => set({ streaming: value }),

    enqueueQueuedMessage: (chatId, content) => {
      const item: QueuedChatMessage = {
        id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        content: content.trim(),
        createdAt: Date.now(),
      };
      set((state) => ({
        queuedMessagesByChatId: {
          ...state.queuedMessagesByChatId,
          [chatId]: [...(state.queuedMessagesByChatId[chatId] ?? []), item],
        },
      }));
      return item;
    },

    updateQueuedMessage: (chatId, id, content) => {
      const trimmed = content.trim();
      if (!trimmed) return;
      set((state) => ({
        queuedMessagesByChatId: {
          ...state.queuedMessagesByChatId,
          [chatId]: (state.queuedMessagesByChatId[chatId] ?? []).map((item) =>
            item.id === id ? { ...item, content: trimmed } : item,
          ),
        },
      }));
    },

    removeQueuedMessage: (chatId, id) => {
      set((state) => ({
        queuedMessagesByChatId: {
          ...state.queuedMessagesByChatId,
          [chatId]: (state.queuedMessagesByChatId[chatId] ?? []).filter(
            (item) => item.id !== id,
          ),
        },
      }));
    },

    shiftQueuedMessage: (chatId) => {
      const list = get().queuedMessagesByChatId[chatId] ?? [];
      if (list.length === 0) return null;
      const [first, ...rest] = list;
      set((state) => ({
        queuedMessagesByChatId: {
          ...state.queuedMessagesByChatId,
          [chatId]: rest,
        },
      }));
      return first ?? null;
    },

    promoteQueuedMessage: (chatId, id) => {
      const list = get().queuedMessagesByChatId[chatId] ?? [];
      const index = list.findIndex((item) => item.id === id);
      if (index < 0) return null;
      const item = list[index]!;
      const next = [item, ...list.filter((_, i) => i !== index)];
      set((state) => ({
        queuedMessagesByChatId: {
          ...state.queuedMessagesByChatId,
          [chatId]: next,
        },
      }));
      return item;
    },

    setBranchDataset: (updater) => {
      set((state) => ({
        branchDataset:
          typeof updater === "function"
            ? updater(state.branchDataset)
            : updater,
      }));
    },

    evictMessagesExcept: (chatId, keepIds) => {
      set((state) => {
        const ids = state.messageIdsByChatId[chatId] ?? [];
        const nextById = { ...state.messagesById };
        const nextIds: string[] = [];
        for (const id of ids) {
          if (keepIds.has(id)) {
            nextIds.push(id);
          } else {
            delete nextById[id];
          }
        }
        return {
          messagesById: nextById,
          messageIdsByChatId: {
            ...state.messageIdsByChatId,
            [chatId]: nextIds,
          },
        };
      });
    },

    clearInactiveChatMessages: (keepChatId) => {
      set((state) => {
        const nextById = { ...state.messagesById };
        const nextIdsByChat: Record<string, string[]> = {};
        for (const [chatId, ids] of Object.entries(state.messageIdsByChatId)) {
          if (keepChatId && chatId === keepChatId) {
            nextIdsByChat[chatId] = ids;
            continue;
          }
          for (const id of ids) {
            delete nextById[id];
          }
          nextIdsByChat[chatId] = [];
        }
        return {
          messagesById: nextById,
          messageIdsByChatId: nextIdsByChat,
        };
      });
    },

    trimChatMessagesToWindow: (chatId, limit = ACTIVE_RAM_MESSAGE_WINDOW) => {
      set((state) => {
        const ids = state.messageIdsByChatId[chatId] ?? [];
        if (ids.length <= limit) return state;

        const streamingIds = new Set<string>();
        for (const id of ids) {
          const message = state.messagesById[id];
          if (message?.isStreaming || message?.isThinkingStreaming) {
            streamingIds.add(id);
          }
        }

        const keep = new Set<string>(streamingIds);
        for (let i = ids.length - 1; i >= 0 && keep.size < limit; i -= 1) {
          keep.add(ids[i]!);
        }

        const nextById = { ...state.messagesById };
        const nextIds: string[] = [];
        for (const id of ids) {
          if (keep.has(id)) {
            nextIds.push(id);
          } else {
            delete nextById[id];
          }
        }
        return {
          messagesById: nextById,
          messageIdsByChatId: {
            ...state.messageIdsByChatId,
            [chatId]: nextIds,
          },
        };
      });
    },

    hydrateFromLegacy: (payload) => {
      const allChats = payload.allChats ?? {};
      const nextById: Record<string, Message> = {};
      const nextIdsByChat: Record<string, string[]> = {};
      for (const [chatId, messages] of Object.entries(allChats)) {
        const { byId, ids } = indexMessages(messages);
        Object.assign(nextById, byId);
        nextIdsByChat[chatId] = ids;
      }
      set({
        messagesById: nextById,
        messageIdsByChatId: nextIdsByChat,
        recentChats: payload.recentChats ?? [],
        activeChatId: payload.activeChatId ?? null,
        branchDataset: payload.branchDataset ?? {},
      });
    },

    exportLegacyAllChats: () => {
      const state = get();
      const result: Record<string, Message[]> = {};
      for (const [chatId, ids] of Object.entries(state.messageIdsByChatId)) {
        result[chatId] = ids
          .map((id) => state.messagesById[id])
          .filter((m): m is Message => m !== undefined);
      }
      return result;
    },
  })),
);

/** Subscribe to ordered message IDs for one chat. */
export function useChatMessageIds(chatId: string | null): readonly string[] {
  return useChatStore((state) => {
    if (!chatId) return EMPTY_IDS;
    return state.messageIdsByChatId[chatId] ?? EMPTY_IDS;
  });
}

export function useChatMessage(messageId: string | null): Message | undefined {
  return useChatStore((state) =>
    messageId ? state.messagesById[messageId] : undefined,
  );
}

/** Active chat ID — single source of truth for sidebar selection and message feed. */
export function useActiveChatId(): string | null {
  return useChatStore((s) => s.activeChatId);
}

export function setActiveChatId(chatId: string | null): void {
  useChatStore.getState().setActiveChatId(chatId);
}

/** Ordered messages for the active chat — shallow-compared to avoid re-render storms. */
export function useActiveChatMessages(): Message[] {
  return useChatStore(
    useShallow((state) => {
      const chatId = state.activeChatId;
      if (!chatId) return EMPTY_MESSAGES as Message[];

      const ids = state.messageIdsByChatId[chatId];
      if (!ids || ids.length === 0) return EMPTY_MESSAGES as Message[];

      const result: Message[] = [];
      for (const id of ids) {
        const message = state.messagesById[id];
        if (message) result.push(message);
      }
      return result;
    }),
  );
}

export function useGeneratingChatIds(): ReadonlySet<string> {
  return useChatStore(
    useShallow((state) => new Set(Object.keys(state.generatingChatIds))),
  );
}

export function useQueuedMessagesForChat(
  chatId: string | null,
): QueuedChatMessage[] {
  return useChatStore(
    useShallow((state) => {
      if (!chatId) return [];
      return state.queuedMessagesByChatId[chatId] ?? [];
    }),
  );
}
