"use client";

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";
import type { Message, RecentChat } from "@/lib/types";
import { FULL_CHAT_HYDRATE_LIMIT } from "@/lib/chat-history-page-size";
import { deriveTurnIdFromClientId } from "@/lib/chat-turn-id";

const EMPTY_IDS: readonly string[] = [];
const EMPTY_MESSAGES: readonly Message[] = [];

export const ACTIVE_RAM_MESSAGE_WINDOW = FULL_CHAT_HYDRATE_LIMIT;
export const MAX_ACTIVE_CHAT_MESSAGES = FULL_CHAT_HYDRATE_LIMIT;

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
  migrateChatId: (fromId: string, toId: string) => void;
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
  clearInactiveChatMessages: (
    keepChatId: string | null,
    opts?: { alsoKeep?: string | null },
  ) => void;
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

function isLive(message: Message): boolean {
  return message.isStreaming === true || message.isThinkingStreaming === true;
}

function hasBody(message: Message): boolean {
  if (message.content?.trim()) return true;
  if (message.agentSegments?.length) return true;
  if (message.agentFrames?.some((f) => f.segments.length > 0)) return true;
  if (message.agentArtifacts?.length) return true;
  return false;
}

/** Keep turn groups chronological; user messages precede their assistant reply. */
function turnSortKey(
  message: Message,
  index: number,
  turnStartedAt: ReadonlyMap<string, number>,
): string {
  const turnId = message.turnId ?? deriveTurnIdFromClientId(message.clientId);
  const turnStamp = turnId ? turnStartedAt.get(turnId) : undefined;
  const roleRank = message.role === "user" ? "0" : "1";
  const stamp =
    typeof turnStamp === "number"
      ? turnStamp.toString().padStart(13, "0")
      : "9999999999999";
  return `${stamp}\u0000${roleRank}\u0000${index
    .toString()
    .padStart(10, "0")}`;
}

function sortIdsByTurn(
  ids: string[],
  byId: Record<string, Message>,
): string[] {
  if (ids.length <= 1) return ids;
  const turnStartedAt = new Map<string, number>();
  for (const id of ids) {
    const message = byId[id];
    if (!message || typeof message.createdAt !== "number") continue;
    const turnId =
      message.turnId ?? deriveTurnIdFromClientId(message.clientId);
    if (!turnId) continue;
    const existing = turnStartedAt.get(turnId);
    if (existing === undefined || message.createdAt < existing) {
      turnStartedAt.set(turnId, message.createdAt);
    }
  }
  return ids
    .map((id, index) => ({ id, index }))
    .sort((a, b) => {
      const ma = byId[a.id];
      const mb = byId[b.id];
      if (!ma || !mb) return a.index - b.index;
      return turnSortKey(ma, a.index, turnStartedAt).localeCompare(
        turnSortKey(mb, b.index, turnStartedAt),
      );
    })
    .map((entry) => entry.id);
}

function resolveExistingId(
  incoming: Message,
  ids: readonly string[],
  byId: Record<string, Message>,
): string | null {
  if (byId[incoming.id]) return incoming.id;
  for (const id of ids) {
    const existing = byId[id];
    if (!existing) continue;
    if (
      (incoming.clientId && existing.clientId === incoming.clientId) ||
      (incoming.clientId && existing.id === incoming.clientId) ||
      (existing.clientId && incoming.id === existing.clientId)
    ) {
      return id;
    }
  }
  return null;
}

function mergeMessage(existing: Message, incoming: Message): Message {
  const existingLive = isLive(existing);
  const incomingLive = isLive(incoming);
  const existingLen = existing.content?.trim().length ?? 0;
  const incomingLen = incoming.content?.trim().length ?? 0;

  if (existingLive && !incomingLive && existingLen >= incomingLen) {
    return {
      ...incoming,
      ...existing,
      turnId: existing.turnId ?? incoming.turnId,
      clientId: existing.clientId ?? incoming.clientId ?? existing.id,
      isStreaming: true,
    };
  }
  if (incomingLive && !existingLive && incomingLen >= existingLen) {
    return {
      ...existing,
      ...incoming,
      turnId: incoming.turnId ?? existing.turnId,
      clientId: incoming.clientId ?? existing.clientId ?? incoming.id,
      isStreaming: true,
    };
  }

  const prefer =
    incomingLen > existingLen ||
    (incoming.agentFrames?.length ?? 0) >
      (existing.agentFrames?.length ?? 0)
      ? incoming
      : existing;
  const other = prefer === incoming ? existing : incoming;

  return {
    ...other,
    ...prefer,
    turnId: prefer.turnId ?? other.turnId,
    clientId: prefer.clientId ?? other.clientId ?? prefer.id,
    content: existingLen >= incomingLen ? existing.content : incoming.content,
    agentFrames: prefer.agentFrames?.length
      ? prefer.agentFrames
      : other.agentFrames,
    agentSegments: prefer.agentSegments?.length
      ? prefer.agentSegments
      : other.agentSegments,
  };
}

void hasBody;

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
      set((state) => {
        const nextById = { ...state.messagesById };
        const prevIds = state.messageIdsByChatId[chatId] ?? [];
        const incomingIds: string[] = [];
        const byId: Record<string, Message> = {};

        for (const message of messages) {
          if (!message?.id) continue;
          byId[message.id] = message;
        }
        for (const oldId of prevIds) {
          if (!byId[oldId]) delete nextById[oldId];
        }
        for (const message of messages) {
          if (!message?.id) continue;
          nextById[message.id] = message;
          incomingIds.push(message.id);
        }
        const sorted = sortIdsByTurn(incomingIds, nextById);
        return {
          messagesById: nextById,
          messageIdsByChatId: {
            ...state.messageIdsByChatId,
            [chatId]: sorted,
          },
        };
      });
    },

    upsertMessage: (chatId, message) => {
      if (!message?.id) return;
      set((state) => {
        const ids = state.messageIdsByChatId[chatId] ?? [];
        const existingId = resolveExistingId(message, ids, state.messagesById);
        const nextById = { ...state.messagesById };

        if (existingId && existingId !== message.id) {
          delete nextById[existingId];
          nextById[message.id] = mergeMessage(
            state.messagesById[existingId]!,
            message,
          );
          const nextIds = ids.map((id) =>
            id === existingId ? message.id : id,
          );
          return {
            messagesById: nextById,
            messageIdsByChatId: {
              ...state.messageIdsByChatId,
              [chatId]: sortIdsByTurn(nextIds, nextById),
            },
          };
        }

        if (existingId === message.id) {
          nextById[message.id] = mergeMessage(
            state.messagesById[message.id]!,
            message,
          );
          return {
            messagesById: nextById,
            messageIdsByChatId: {
              ...state.messageIdsByChatId,
              [chatId]: sortIdsByTurn(ids, nextById),
            },
          };
        }

        nextById[message.id] = message;
        const nextIds = [...ids, message.id];
        return {
          messagesById: nextById,
          messageIdsByChatId: {
            ...state.messageIdsByChatId,
            [chatId]: sortIdsByTurn(nextIds, nextById),
          },
        };
      });
    },

    patchMessage: (chatId, messageId, updater) => {
      set((state) => {
        let existing = state.messagesById[messageId];
        let resolvedId = messageId;
        if (!existing) {
          const ids = state.messageIdsByChatId[chatId] ?? [];
          for (const id of ids) {
            const candidate = state.messagesById[id];
            if (
              candidate &&
              (candidate.clientId === messageId ||
                candidate.id === messageId)
            ) {
              existing = candidate;
              resolvedId = id;
              break;
            }
          }
        }
        if (!existing) return state;
        const ids = state.messageIdsByChatId[chatId];
        if (!ids?.includes(resolvedId)) return state;
        return {
          messagesById: {
            ...state.messagesById,
            [resolvedId]: updater(existing),
          },
        };
      });
    },

    appendMessageField: (chatId, messageId, field, delta) => {
      if (!delta) return;
      set((state) => {
        let existing = state.messagesById[messageId];
        let resolvedId = messageId;
        if (!existing) {
          const ids = state.messageIdsByChatId[chatId] ?? [];
          for (const id of ids) {
            const candidate = state.messagesById[id];
            if (
              candidate &&
              (candidate.clientId === messageId ||
                candidate.id === messageId)
            ) {
              existing = candidate;
              resolvedId = id;
              break;
            }
          }
        }
        if (!existing) return state;
        const ids = state.messageIdsByChatId[chatId];
        if (!ids?.includes(resolvedId)) return state;
        return {
          messagesById: {
            ...state.messagesById,
            [resolvedId]: {
              ...existing,
              [field]: `${existing[field] ?? ""}${delta}`,
              isStreaming: true,
              ...(field === "content"
                ? { isThinkingStreaming: false }
                : {}),
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

    migrateChatId: (fromId, toId) => {
      if (!fromId || !toId || fromId === toId) return;
      set((state) => {
        const nextMessageIds = { ...state.messageIdsByChatId };
        const fromIds = nextMessageIds[fromId];
        if (fromIds) {
          delete nextMessageIds[fromId];
          nextMessageIds[toId] = nextMessageIds[toId]?.length
            ? nextMessageIds[toId]!
            : fromIds;
        }
        const nextGenerating = { ...state.generatingChatIds };
        if (nextGenerating[fromId]) {
          delete nextGenerating[fromId];
          nextGenerating[toId] = true;
        }
        const nextQueued = { ...state.queuedMessagesByChatId };
        if (nextQueued[fromId]) {
          nextQueued[toId] = [
            ...(nextQueued[toId] ?? []),
            ...nextQueued[fromId]!,
          ];
          delete nextQueued[fromId];
        }
        const nextBranch = { ...state.branchDataset };
        if (nextBranch[fromId] !== undefined) {
          nextBranch[toId] = nextBranch[fromId]!;
          delete nextBranch[fromId];
        }
        const streaming =
          state.streaming?.chatId === fromId
            ? { ...state.streaming, chatId: toId }
            : state.streaming;
        const activeChatId =
          state.activeChatId === fromId ? toId : state.activeChatId;
        return {
          messageIdsByChatId: nextMessageIds,
          generatingChatIds: nextGenerating,
          queuedMessagesByChatId: nextQueued,
          branchDataset: nextBranch,
          streaming,
          activeChatId,
          isGenerating: Boolean(
            activeChatId && nextGenerating[activeChatId],
          ),
        };
      });
    },

    setRecentChats: (updater) => {
      set((state) => ({
        recentChats:
          typeof updater === "function"
            ? updater(state.recentChats)
            : updater,
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
          [chatId]: [
            ...(state.queuedMessagesByChatId[chatId] ?? []),
            item,
          ],
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
          [chatId]: (state.queuedMessagesByChatId[chatId] ?? []).map(
            (item) =>
              item.id === id ? { ...item, content: trimmed } : item,
          ),
        },
      }));
    },

    removeQueuedMessage: (chatId, id) => {
      set((state) => ({
        queuedMessagesByChatId: {
          ...state.queuedMessagesByChatId,
          [chatId]: (
            state.queuedMessagesByChatId[chatId] ?? []
          ).filter((item) => item.id !== id),
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

    clearInactiveChatMessages: (keepChatId, opts) => {
      set((state) => {
        const keep = new Set<string>();
        if (keepChatId) keep.add(keepChatId);
        if (opts?.alsoKeep && opts.alsoKeep !== keepChatId) {
          keep.add(opts.alsoKeep);
        }
        const nextById = { ...state.messagesById };
        const nextIdsByChat: Record<string, string[]> = {};
        for (const [chatId, ids] of Object.entries(
          state.messageIdsByChatId,
        )) {
          if (keep.has(chatId)) {
            nextIdsByChat[chatId] = ids;
            continue;
          }
          for (const id of ids) {
            delete nextById[id];
          }
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
        const ids: string[] = [];
        for (const message of messages) {
          if (!message?.id) continue;
          nextById[message.id] = message;
          ids.push(message.id);
        }
        nextIdsByChat[chatId] = sortIdsByTurn(ids, nextById);
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
      for (const [chatId, ids] of Object.entries(
        state.messageIdsByChatId,
      )) {
        result[chatId] = ids
          .map((id) => state.messagesById[id])
          .filter((m): m is Message => m !== undefined);
      }
      return result;
    },
  })),
);

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

export function useActiveChatId(): string | null {
  return useChatStore((s) => s.activeChatId);
}

export function setActiveChatId(chatId: string | null): void {
  useChatStore.getState().setActiveChatId(chatId);
}

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
