"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import type { StreamEvent } from "@/lib/chat-stream";
import { applyAgentStreamEvent } from "@/lib/agent-stream-reducer";
import { sanitizeAssistantStreamDelta } from "@/lib/assistant-output-sanitize";
import {
  EMPTY_ASSISTANT_RESPONSE_FALLBACK,
  hasUsefulAssistantProgress,
  toUserFacingChatError,
} from "@/lib/assistant-generation-error";
import {
  isEventStreamResponse,
  looksLikeSecurityChallenge,
} from "@/lib/security-challenge";
import {
  canFastAppendAnswer,
  patchToolOutputDelta,
} from "@/lib/agent-stream-fast-path";
import { agentAnswerDuplicatesInterim } from "@/lib/agent-frames";
import { createStreamEventBatcher } from "@/lib/stream-event-batcher";
import type { Message, RecentChat } from "@/lib/types";
import { useAiStream } from "@/hooks/use-ai-stream";
import {
  getAllChatsNormalized,
  patchAssistantMessage,
  setAllChatsNormalized,
} from "@/lib/chat-store-bridge";
import {
  useActiveChatMessages,
  useActiveChatId,
  setActiveChatId,
  useChatStore,
} from "@/stores/chat-store";
import * as chatsApi from "@/lib/api/chats";
import { uploadUserFile } from "@/lib/api/files";
import {
  toMessageAttachments,
  type ComposerAttachment,
} from "@/lib/composer-attachments";
import { createClient } from "@/utils/supabase/client";
import { logSupabaseQueryError } from "@/lib/supabase-query-error";
import { randomUUID } from "@/lib/id";
import {
  attachSnapshotToBranchVersion,
  compactMessageBranchData,
  editMessageWithBranchHelper,
  redoUserMessageWithBranchHelper,
  retryAssistantWithBranchHelper,
  switchMessageBranchHelper,
} from "@/lib/chat-branch";
import {
  buildChatConversation,
  extractActiveBranchPath,
} from "@/lib/branch-conversation";
import {
  appendChatTitleAnswerDelta,
  createChatTitleAnswerAccumulator,
  CHAT_TITLE_STREAM_CHAR_MS,
  CHAT_TITLE_STREAM_CHUNK,
  deriveTitleFromExchange,
  extractChatTitleFromText,
  finalizeChatTitleStrippedAnswer,
  normalizeChatTitle,
  normalizeInlineChatTitle,
  resolveFinalStreamedAnswer,
  seedChatTitleAnswerAccumulator,
  stripTitleSourceText,
} from "@/lib/chat-title";
import { DEFAULT_CHAT_MODEL_ID, type ChatModelId } from "@/lib/chat-models";
import {
  DEFAULT_HOMER_REASONING_EFFORT,
  type HomerReasoningEffort,
} from "@/lib/model-effort";
import { filterStartedRecentChats } from "@/lib/started-recent-chats";
import {
  hydrateMessageFromContentJson,
  overlayBranchMessagesOnPage,
} from "@/lib/hydrate-chat-messages";
import { takePendingChatRouteSeed } from "@/lib/chat-route-seed";
import {
  forgetDeviceChat,
  persistDeviceChatNow,
  persistDeviceRecentChatsNow,
  readDeviceChatList,
  readSyncDeviceChatList,
  scheduleDeviceChatPersist,
  writeSyncDeviceChatList,
} from "@/lib/device-chat-cache";
import { useAuth } from "@/contexts/auth-context";
import { readIdentityHintFromDocument } from "@/utils/identity-cookie";
import { useShallow } from "zustand/react/shallow";

function bootRecentChatsFromSync(): RecentChat[] {
  if (typeof window === "undefined") return [];
  const userId = readIdentityHintFromDocument()?.id;
  if (!userId) return [];
  return readSyncDeviceChatList(userId) ?? [];
}

function mapApiMessage(row: chatsApi.ApiMessage): Message {
  const meta = row.metadata as {
    thinkingContent?: string;
    hasThinking?: boolean;
    thinkingDurationSeconds?: number;
    branchVersions?: Message["branchVersions"];
    activeBranchIndex?: number;
    attachments?: Message["attachments"];
  };
  const createdAt = row.created_at
    ? new Date(row.created_at).getTime()
    : undefined;
  const ageMs =
    typeof createdAt === "number" ? Date.now() - createdAt : Number.POSITIVE_INFINITY;
  // Abandoned streaming rows look like "missing messages" after reload.
  const staleStreaming =
    row.status === "streaming" &&
    ageMs > 90_000 &&
    !(row.content ?? "").trim();
  const content = staleStreaming
    ? "Generation interrupted."
    : finalizeChatTitleStrippedAnswer(row.content);
  const base = compactMessageBranchData({
    id: row.id,
    clientId:
      typeof row.client_id === "string" && row.client_id.trim()
        ? row.client_id.trim()
        : row.id,
    role: row.role as Message["role"],
    content,
    thinkingContent: meta.thinkingContent,
    hasThinking: meta.hasThinking,
    thinkingDurationSeconds: meta.thinkingDurationSeconds,
    branchVersions: meta.branchVersions,
    activeBranchIndex: meta.activeBranchIndex,
    attachments: Array.isArray(meta.attachments)
      ? meta.attachments
      : undefined,
    createdAt,
    isStreaming: row.status === "streaming" && !staleStreaming,
  });
  return hydrateMessageFromContentJson(
    base,
    (row as { content_json?: unknown }).content_json,
  );
}

function buildConversation(messages: Message[]) {
  return buildChatConversation(messages);
}

// Module-level shared generation state so in-flight streams survive route
// changes and multitasking across chats. Keyed by chatId.
const sharedApiGenerations = new Map<
  string,
  { request: AbortController; assistantMessageId: string }
>();

function getGeneration(chatId: string) {
  return sharedApiGenerations.get(chatId) ?? null;
}

function setGeneration(
  chatId: string,
  entry: { request: AbortController; assistantMessageId: string } | null,
) {
  if (!entry) sharedApiGenerations.delete(chatId);
  else sharedApiGenerations.set(chatId, entry);
}

export function useChatApi(
  projectIdFilter: string | null,
  chatModel: ChatModelId = DEFAULT_CHAT_MODEL_ID,
  homerReasoningEffort: HomerReasoningEffort = DEFAULT_HOMER_REASONING_EFFORT,
  extendedThinking = false,
) {
  const { streamFromResponse } = useAiStream();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const setAllChats = setAllChatsNormalized;
  const [recentChats, setRecentChats] = useState<RecentChat[]>(() =>
    bootRecentChatsFromSync(),
  );
  const activeChatId = useActiveChatId();
  const isGenerating = useChatStore((state) => state.isGenerating);
  const deviceCacheBootedRef = useRef(false);
  const setIsGenerating = useCallback((value: boolean) => {
    useChatStore.getState().setIsGenerating(value);
  }, []);
  const [loading, setLoading] = useState(() => bootRecentChatsFromSync().length === 0);
  const [creatingChatPending, setCreatingChatPending] = useState(false);
  const [loadingChatId, setLoadingChatId] = useState<string | null>(null);
  const [messageLoadErrors, setMessageLoadErrors] = useState<
    Record<string, string>
  >({});
  const messagesLoading =
    activeChatId !== null && loadingChatId === activeChatId;
  const messagesLoadError = activeChatId
    ? (messageLoadErrors[activeChatId] ?? null)
    : null;
  const chatsLoadedOnceRef = useRef(bootRecentChatsFromSync().length > 0);
  const allChatsRef = useRef<Record<string, Message[]>>({});
  const recentChatsRef = useRef<RecentChat[]>(bootRecentChatsFromSync());
  /** Optimistic pin overrides until server list agrees. */
  const pendingPinOverridesRef = useRef<Map<string, boolean>>(new Map());
  /** Optimistic title overrides until server list name catches up. */
  const pendingTitleOverridesRef = useRef<Map<string, string>>(new Map());
  const branchPersistRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Branch overlay snapshot per chat — applied once on hydrate. */
  const branchMessagesByChatRef = useRef<Record<string, unknown>>({});
  /** Chats that already received a full-thread hydrate this session. */
  const hydratedChatIdsRef = useRef<Set<string>>(new Set());
  const titleGenerationInProgressRef = useRef<Set<string>>(new Set());
  const handleSendMessageRef = useRef<
    | ((
        prompt: string,
        options?: {
          forceNewChat?: boolean;
          bypassQueue?: boolean;
          chatIdOverride?: string;
        },
      ) => Promise<string | null>)
    | null
  >(null);

  const messages = useActiveChatMessages();
  const messageIdsByChatId = useChatStore(
    useShallow((state) => state.messageIdsByChatId),
  );
  const activeChat = recentChats.find((c) => c.id === activeChatId) ?? null;
  const startedRecentChats = useMemo(
    () => filterStartedRecentChats(recentChats, messageIdsByChatId),
    [recentChats, messageIdsByChatId],
  );

  useEffect(() => {
    allChatsRef.current = getAllChatsNormalized();
    return useChatStore.subscribe(() => {
      allChatsRef.current = getAllChatsNormalized();
    });
  }, []);

  useEffect(() => {
    recentChatsRef.current = recentChats;
  }, [recentChats]);

  const persistBranches = useCallback(
    async (chatId: string, chatMessages: Message[]) => {
      try {
        await chatsApi.saveBranchState(
          chatId,
          extractActiveBranchPath(chatMessages),
          chatMessages,
        );
      } catch {
        // Branch persistence is best-effort.
      }
    },
    [],
  );

  const scheduleBranchPersist = useCallback(
    (chatId: string) => {
      if (branchPersistRef.current) clearTimeout(branchPersistRef.current);
      branchPersistRef.current = setTimeout(() => {
        const chatMessages = allChatsRef.current[chatId];
        if (chatMessages?.length) void persistBranches(chatId, chatMessages);
      }, 600);
    },
    [persistBranches],
  );

  const refreshChats = useCallback(async (opts?: { silent?: boolean }) => {
    // Silent when caller asks and we already have rows (sync/IDB paint or prior fetch).
    const silent =
      opts?.silent === true &&
      (chatsLoadedOnceRef.current || recentChatsRef.current.length > 0);
    if (!silent) setLoading(true);
    try {
      const { chats } = await chatsApi.listChats(projectIdFilter ?? undefined);
      const serverChats: RecentChat[] = chats.map((c) => ({
        id: c.id,
        name: c.name,
        titleGenerated: c.name.toLowerCase() !== "new chat",
        projectId: c.projectId,
        pinned: Boolean(c.pinned),
        updatedAt: new Date(c.updatedAt).getTime(),
      }));
      const now = Date.now();
      const LOCAL_LIST_GRACE_MS = 90_000;
      setRecentChats((prev) => {
        const serverIds = new Set(serverChats.map((c) => c.id));
        // Keep rows the server list hasn't caught yet (pending create, or
        // Worker/list cache lag right after create / first message).
        const localOnly = prev.filter((c) => {
          if (serverIds.has(c.id)) return false;
          if (c.isCreating || c.id.startsWith("pending-")) return true;
          const age = now - (c.updatedAt ?? 0);
          return age >= 0 && age < LOCAL_LIST_GRACE_MS;
        });
        const merged = serverChats.map((server) => {
          const local = prev.find((p) => p.id === server.id);
          const pinOverride = pendingPinOverridesRef.current.get(server.id);
          const titleOverride = pendingTitleOverridesRef.current.get(server.id);
          const pinned =
            pinOverride !== undefined ? pinOverride : server.pinned;
          // Drop pin override only once the server list agrees — avoids cache lag
          // flipping the chat out of Pinned after a successful POST.
          if (pinOverride !== undefined && Boolean(server.pinned) === pinOverride) {
            pendingPinOverridesRef.current.delete(server.id);
          }
          if (
            titleOverride !== undefined &&
            server.name.trim().toLowerCase() === titleOverride.trim().toLowerCase()
          ) {
            pendingTitleOverridesRef.current.delete(server.id);
          }
          if (!local) {
            return {
              ...server,
              pinned,
              ...(titleOverride
                ? { name: titleOverride, titleGenerated: true }
                : null),
            };
          }
          if (local.isTitleStreaming) {
            return {
              ...server,
              name: local.name,
              isTitleStreaming: true,
              titleGenerated: local.titleGenerated,
              pinned,
              updatedAt: Math.max(local.updatedAt ?? 0, server.updatedAt ?? 0),
            };
          }
          const name =
            titleOverride ??
            (local.titleGenerated &&
            local.name.trim().toLowerCase() !== "new chat" &&
            server.name.trim().toLowerCase() === "new chat"
              ? local.name
              : server.name);
          return {
            ...server,
            name,
            titleGenerated:
              Boolean(titleOverride) ||
              local.titleGenerated ||
              server.name.toLowerCase() !== "new chat",
            pinned,
            // Prefer fresher local updatedAt so a just-created chat stays on top.
            updatedAt: Math.max(local.updatedAt ?? 0, server.updatedAt ?? 0),
          };
        });
        const next = [...localOnly, ...merged].sort((a, b) => {
          if (Boolean(a.pinned) !== Boolean(b.pinned)) {
            return a.pinned ? -1 : 1;
          }
          return (b.updatedAt ?? 0) - (a.updatedAt ?? 0);
        });
        recentChatsRef.current = next;
        if (userId) {
          writeSyncDeviceChatList(userId, next);
        }
        return next;
      });
    } catch (error) {
      // Challenge HTML / transient network — keep existing sidebar list.
      console.warn("[chats] list failed (soft):", error);
    } finally {
      chatsLoadedOnceRef.current = true;
      setLoading(false);
    }
  }, [projectIdFilter, userId]);

  useEffect(() => {
    // Home = blank new chat immediately (don't wait for list / IndexedDB).
    if (
      typeof window !== "undefined" &&
      (window.location.pathname === "/new" ||
        window.location.pathname === "/" ||
        window.location.pathname === "")
    ) {
      setActiveChatId(null);
    }

    let cancelled = false;
    void (async () => {
      const hasSyncPaint = recentChatsRef.current.length > 0;
      if (hasSyncPaint) {
        chatsLoadedOnceRef.current = true;
        setLoading(false);
      }

      // IDB backup when sync mirror was empty (upgrade / cleared localStorage).
      if (userId && !deviceCacheBootedRef.current) {
        deviceCacheBootedRef.current = true;
        if (!hasSyncPaint) {
          try {
            const cached = await readDeviceChatList(userId);
            if (!cancelled && cached?.length) {
              setRecentChats((prev) => {
                if (prev.length > 0) return prev;
                recentChatsRef.current = cached;
                return cached;
              });
              chatsLoadedOnceRef.current = true;
              setLoading(false);
            }
          } catch (error) {
            console.warn("[device-chat-cache] list boot failed:", error);
          }
        }
      }

      if (cancelled) return;
      // Reconcile with Worker/API without blanking a painted sidebar.
      void refreshChats({
        silent:
          recentChatsRef.current.length > 0 || chatsLoadedOnceRef.current,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [refreshChats, userId]);

  // Debounced IndexedDB mirror — cuts refetch load across visits/tabs.
  useEffect(() => {
    if (!userId || typeof window === "undefined") return;
    let cancelPersist: (() => void) | null = null;
    const schedule = () => {
      // Never persist mid-stream — empty assistant snapshots were poisoning
      // reopen / silent reconcile and killing the orb.
      if (useChatStore.getState().isGenerating) return;
      cancelPersist?.();
      cancelPersist = scheduleDeviceChatPersist({
        userId,
        allChats: getAllChatsNormalized(),
        recentChats: recentChatsRef.current,
        activeChatId,
        delayMs: 250,
      });
    };
    schedule();
    const unsub = useChatStore.subscribe(schedule);
    return () => {
      unsub();
      cancelPersist?.();
    };
  }, [userId, activeChatId, isGenerating, recentChats]);

  // Live sidebar updates when chats change in Supabase (other tabs / title gen).
  useEffect(() => {
    const supabase = createClient();
    let debounceTimer = 0;
    const scheduleRefresh = () => {
      window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => {
        if (typeof document !== "undefined" && document.hidden) return;
        void refreshChats({ silent: true });
      }, 400);
    };
    const channel = supabase
      .channel(`chats-sidebar:${projectIdFilter ?? "all"}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chats",
        },
        scheduleRefresh,
      )
      .subscribe((status, err) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          logSupabaseQueryError("realtime.chats", err ?? { message: status }, {
            table: "chats",
            event: "*",
          });
        }
      });

    return () => {
      window.clearTimeout(debounceTimer);
      void supabase.removeChannel(channel);
    };
  }, [projectIdFilter, refreshChats]);

  // Live message inserts/updates for the open chat (other devices / tabs).
  // ChatGPT/Claude pattern: while THIS tab owns an SSE generation, the stream
  // is the sole source of truth for the assistant turn. Supabase Realtime must
  // not mutate content / streaming flags mid-turn (empty DB rows kill the orb).
  useEffect(() => {
    if (!activeChatId) return;
    const supabase = createClient();

    const isStreamOwner = () =>
      Boolean(getGeneration(activeChatId)) ||
      Boolean(useChatStore.getState().generatingChatIds[activeChatId]);

    /** Remap optimistic ids only — never touch content while streaming. */
    const remapIdsOnly = (
      existing: Message[],
      mapped: Message,
    ): Message[] | null => {
      const gen = getGeneration(activeChatId);
      if (mapped.role === "assistant" && gen?.assistantMessageId) {
        const localIndex = existing.findIndex(
          (message) =>
            message.id === gen.assistantMessageId ||
            message.clientId === gen.assistantMessageId ||
            (mapped.clientId &&
              (message.clientId === mapped.clientId ||
                message.id === mapped.clientId)),
        );
        if (localIndex >= 0) {
          const local = existing[localIndex]!;
          if (local.id === mapped.id) return null;
          const next = [...existing];
          next[localIndex] = {
            ...local,
            id: mapped.id,
            clientId: local.clientId ?? mapped.clientId ?? local.id,
          };
          setGeneration(activeChatId, {
            request: gen.request,
            assistantMessageId: mapped.id,
          });
          useChatStore
            .getState()
            .setStreaming({ chatId: activeChatId, messageId: mapped.id });
          return next;
        }
        return null;
      }
      if (mapped.role === "user") {
        const tempIndex = existing.findIndex(
          (message) =>
            message.role === "user" &&
            (message.id.startsWith("temp-") ||
              Boolean(message.clientId?.startsWith("temp-"))) &&
            (message.clientId === mapped.clientId ||
              mapped.clientId === message.id ||
              message.content === mapped.content),
        );
        if (tempIndex >= 0) {
          const next = [...existing];
          const local = next[tempIndex]!;
          if (local.id === mapped.id) return null;
          next[tempIndex] = {
            ...local,
            id: mapped.id,
            clientId: local.clientId ?? mapped.clientId ?? local.id,
            attachments: local.attachments ?? mapped.attachments,
          };
          return next;
        }
      }
      return null;
    };

    const channel = supabase
      .channel(`chat-messages:${activeChatId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `chat_id=eq.${activeChatId}`,
        },
        (payload) => {
          const row = payload.new as chatsApi.ApiMessage | undefined;
          if (!row?.id || row.status === "cancelled") return;
          const mapped = mapApiMessage(row);
          setAllChats((prev) => {
            const existing = prev[activeChatId] ?? [];
            if (
              existing.some(
                (message) =>
                  message.id === mapped.id ||
                  (mapped.clientId &&
                    (message.clientId === mapped.clientId ||
                      message.id === mapped.clientId)),
              )
            ) {
              return prev;
            }

            if (isStreamOwner()) {
              const remapped = remapIdsOnly(existing, mapped);
              if (remapped) return { ...prev, [activeChatId]: remapped };
              return prev;
            }

            if (
              mapped.role === "assistant" &&
              mapped.isStreaming &&
              !(mapped.content ?? "").trim()
            ) {
              return prev;
            }

            return {
              ...prev,
              [activeChatId]: [...existing, mapped],
            };
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "chat_messages",
          filter: `chat_id=eq.${activeChatId}`,
        },
        (payload) => {
          const row = payload.new as chatsApi.ApiMessage | undefined;
          if (!row?.id) return;
          const mapped = mapApiMessage(row);

          // SSE owns the turn — ignore content/status from WAL entirely.
          if (isStreamOwner()) {
            setAllChats((prev) => {
              const existing = prev[activeChatId] ?? [];
              const remapped = remapIdsOnly(existing, mapped);
              if (remapped) return { ...prev, [activeChatId]: remapped };
              return prev;
            });
            return;
          }

          const rowStatus = row.status;
          setAllChats((prev) => {
            const existing = prev[activeChatId] ?? [];
            const index = existing.findIndex(
              (message) =>
                message.id === mapped.id ||
                (mapped.clientId &&
                  (message.clientId === mapped.clientId ||
                    message.id === mapped.clientId)),
            );
            if (index < 0) {
              if (
                mapped.role === "assistant" &&
                mapped.isStreaming &&
                !(mapped.content ?? "").trim()
              ) {
                return prev;
              }
              return {
                ...prev,
                [activeChatId]: [...existing, mapped],
              };
            }
            const next = [...existing];
            const prevMessage = next[index]!;
            // Prefer richer local content if realtime is stale.
            const localHasAgentFrames =
              (prevMessage.agentFrames?.some(
                (frame) => frame.segments.length > 0,
              ) ??
                false) ||
              (prevMessage.agentSegments?.length ?? 0) > 0;
            const mappedHasAgentFrames =
              (mapped.agentFrames?.some((frame) => frame.segments.length > 0) ??
                false) ||
              (mapped.agentSegments?.length ?? 0) > 0;
            next[index] = {
              ...prevMessage,
              ...mapped,
              id: mapped.id,
              clientId:
                prevMessage.clientId ?? mapped.clientId ?? mapped.id,
              content:
                (prevMessage.content?.length ?? 0) >
                (mapped.content?.length ?? 0)
                  ? prevMessage.content
                  : mapped.content,
              isStreaming: rowStatus === "streaming",
              ...(localHasAgentFrames && !mappedHasAgentFrames
                ? {
                    agentMode: prevMessage.agentMode,
                    agentFrameComplete: prevMessage.agentFrameComplete,
                    agentFrames: prevMessage.agentFrames,
                    agentSegments: prevMessage.agentSegments,
                    activeAgentFrameIndex:
                      prevMessage.activeAgentFrameIndex,
                    agentArtifacts: prevMessage.agentArtifacts,
                  }
                : {}),
            };
            return { ...prev, [activeChatId]: next };
          });
        },
      )
      .subscribe((status, err) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          logSupabaseQueryError(
            "realtime.chat_messages",
            err ?? { message: status },
            {
              table: "chat_messages",
              filter: `chat_id=eq.${activeChatId}`,
              chatId: activeChatId,
            },
          );
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [activeChatId, setAllChats]);

  const applyHydratedMessages = useCallback(
    (
      chatId: string,
      apiMessages: chatsApi.ApiMessage[],
      branchMessages: unknown,
    ) => {
      if (branchMessages != null) {
        branchMessagesByChatRef.current[chatId] = branchMessages;
      }
      const hydrated = overlayBranchMessagesOnPage({
        pageMessages: apiMessages.map(mapApiMessage),
        branchMessages:
          branchMessages ?? branchMessagesByChatRef.current[chatId] ?? null,
      });
      setAllChats((prev) => {
        const existing = prev[chatId] ?? [];
        const isLive =
          Boolean(useChatStore.getState().generatingChatIds[chatId]) ||
          Boolean(getGeneration(chatId)) ||
          existing.some(
            (message) =>
              message.isStreaming === true ||
              message.isThinkingStreaming === true ||
              Boolean(message.id?.startsWith("temp-")) ||
              Boolean(message.clientId?.startsWith("temp-")),
          );
        // Never replace a live optimistic/streaming thread with a colder
        // server snapshot (empty assistant rows cause the blank-orb bug).
        if (isLive && existing.length > 0) {
          const merged = existing.map((local) => {
            const match = hydrated.find(
              (remote) =>
                remote.id === local.id ||
                (local.clientId &&
                  (remote.clientId === local.clientId ||
                    remote.id === local.clientId)) ||
                (remote.clientId && remote.clientId === local.id),
            );
            if (!match) return local;
            // Id remap only while streaming — never adopt colder content.
            if (
              local.isStreaming ||
              local.isThinkingStreaming ||
              (local.content?.length ?? 0) >= (match.content?.length ?? 0)
            ) {
              return {
                ...local,
                id: match.id,
                clientId: local.clientId ?? match.clientId ?? local.id,
              };
            }
            return {
              ...match,
              clientId: local.clientId ?? match.clientId ?? match.id,
              attachments: local.attachments ?? match.attachments,
            };
          });
          const existingKeys = new Set(
            merged.flatMap((message) =>
              [message.id, message.clientId].filter(Boolean) as string[],
            ),
          );
          for (const remote of hydrated) {
            if (
              existingKeys.has(remote.id) ||
              (remote.clientId && existingKeys.has(remote.clientId))
            ) {
              continue;
            }
            // Never append a blank streaming/completed assistant while live —
            // that paints a second orb then collapses to empty.
            if (
              remote.role === "assistant" &&
              !(remote.content ?? "").trim() &&
              (remote.isStreaming ||
                !(remote.agentFrames?.some((f) => f.segments.length > 0) ??
                  false))
            ) {
              continue;
            }
            merged.push(remote);
          }
          return { ...prev, [chatId]: merged };
        }
        return {
          ...prev,
          [chatId]: hydrated,
        };
      });
      hydratedChatIdsRef.current.add(chatId);
    },
    [],
  );

  const loadChatMessages = useCallback(
    async (chatId: string, opts?: { silent?: boolean }) => {
      const silent = opts?.silent === true;
      // Never reconcile over a live turn — silent Worker fetches were wiping
      // the optimistic orb on new-chat / follow-up navigations.
      const store = useChatStore.getState();
      const isLive =
        Boolean(store.generatingChatIds[chatId]) ||
        Boolean(getGeneration(chatId));
      if (silent && isLive) {
        return;
      }
      if (!silent) {
        setLoadingChatId(chatId);
      }
      setMessageLoadErrors((current) => {
        if (!current[chatId]) return current;
        const next = { ...current };
        delete next[chatId];
        return next;
      });
      try {
        const [bundle, branch] = await Promise.all([
          chatsApi.listAllChatMessages(chatId),
          chatsApi.getBranchState(chatId).catch(() => null),
        ]);
        // Re-check after await — generation may have started while fetching.
        const after = useChatStore.getState();
        if (
          Boolean(after.generatingChatIds[chatId]) ||
          Boolean(getGeneration(chatId))
        ) {
          applyHydratedMessages(chatId, bundle.messages, null);
          return;
        }
        const row = branch?.state as { messages?: unknown } | null;
        applyHydratedMessages(chatId, bundle.messages, row?.messages ?? null);
        if (userId) {
          const messages = getAllChatsNormalized()[chatId] ?? [];
          void persistDeviceChatNow(
            userId,
            chatId,
            messages,
            recentChatsRef.current,
            useChatStore.getState().activeChatId,
          );
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Could not load this conversation.";
        console.warn("[chat] hydrate failed:", error);
        if (!silent) {
          setMessageLoadErrors((current) => ({
            ...current,
            [chatId]: message,
          }));
        }
      } finally {
        if (!silent) {
          setLoadingChatId((current) => (current === chatId ? null : current));
        }
      }
    },
    [applyHydratedMessages, userId],
  );

  const retryLoadMessages = useCallback(() => {
    if (!activeChatId) return Promise.resolve();
    return loadChatMessages(activeChatId);
  }, [activeChatId, loadChatMessages]);

  const handleSelectChat = useCallback(
    async (chatId: string | null) => {
      if (!chatId) {
        setActiveChatId(null);
        useChatStore.getState().clearInactiveChatMessages(null);
        setLoadingChatId(null);
        return;
      }
      const previousChatId = useChatStore.getState().activeChatId;
      setActiveChatId(chatId);
      // Keep the previous chat warm for back-nav; drop everything else.
      useChatStore
        .getState()
        .clearInactiveChatMessages(chatId, { alsoKeep: previousChatId });

      const store = useChatStore.getState();
      const existingIds = store.messageIdsByChatId[chatId];
      const existingMessages =
        existingIds?.map((id) => store.messagesById[id]).filter(Boolean) ?? [];
      const hasLocalTurns = existingMessages.length > 0;
      const isLive =
        Boolean(store.generatingChatIds[chatId]) ||
        Boolean(getGeneration(chatId)) ||
        existingMessages.some(
          (message) =>
            message?.isStreaming === true ||
            message?.isThinkingStreaming === true ||
            Boolean(message?.id?.startsWith("temp-")) ||
            Boolean(message?.clientId?.startsWith("temp-")),
        );
      const alreadyHydrated = hydratedChatIdsRef.current.has(chatId);

      // Keep optimistic / in-flight turns — never let SSR seed or a fetch
      // wipe a live stream (that remount flicker on send from /new).
      if (hasLocalTurns && (alreadyHydrated || isLive)) {
        takePendingChatRouteSeed(chatId);
        setLoadingChatId((current) => (current === chatId ? null : current));
        return;
      }

      // Warm local turns always win over a sparse/empty SSR seed (brand-new
      // /c/[id] right after create often has 0–1 DB rows while UI already
      // painted the optimistic user + assistant placeholder).
      if (hasLocalTurns) {
        const ssrSeed = takePendingChatRouteSeed(chatId);
        const seedCount = ssrSeed?.messages?.length ?? 0;
        const seedHasRicherAssistant = Boolean(
          ssrSeed?.messages?.some((message) => {
            if (message.role !== "assistant") return false;
            const localAssistant = existingMessages.find(
              (local) =>
                local.role === "assistant" &&
                (local.id === message.id ||
                  local.clientId ===
                    (message as { client_id?: string }).client_id),
            );
            const seedLen = (message.content ?? "").trim().length;
            const localLen = (localAssistant?.content ?? "").trim().length;
            return seedLen > localLen && !localAssistant?.isStreaming;
          }),
        );
        if (
          ssrSeed &&
          seedCount > existingMessages.length &&
          seedHasRicherAssistant
        ) {
          applyHydratedMessages(
            chatId,
            ssrSeed.messages,
            ssrSeed.branchMessages,
          );
        } else {
          hydratedChatIdsRef.current.add(chatId);
        }
        setLoadingChatId((current) => (current === chatId ? null : current));
        return;
      }

      const ssrSeed = takePendingChatRouteSeed(chatId);
      if (ssrSeed) {
        applyHydratedMessages(
          chatId,
          ssrSeed.messages,
          ssrSeed.branchMessages,
        );
        setLoadingChatId((current) => (current === chatId ? null : current));
        // Only silent-reconcile when idle — never during a live send/stream.
        const liveNow =
          Boolean(useChatStore.getState().generatingChatIds[chatId]) ||
          Boolean(getGeneration(chatId));
        if (!liveNow) {
          void loadChatMessages(chatId, { silent: true });
        }
        return;
      }

      // Edge-first: Worker Cache/KV/R2 → Hyperdrive. No loading chrome —
      // empty transcript paints; messages fill in when the Worker returns.
      void loadChatMessages(chatId, { silent: true });
    },
    [applyHydratedMessages, loadChatMessages, setAllChats],
  );

  const startNewChat = useCallback(() => {
    setActiveChatId(null);
  }, []);

  const stopGeneration = useCallback(() => {
    const chatId = useChatStore.getState().activeChatId;
    if (!chatId) return;
    const gen = getGeneration(chatId);
    if (!gen) return;

    // Explicit server stop — tab close alone must not cancel durable generation.
    // Incognito sessions have no DO lease / chat row.
    if (!chatId.startsWith("incognito-")) {
      void fetch(`/api/v1/chats/${chatId}/generate/stop`, {
        method: "POST",
        credentials: "include",
      }).catch(() => {});
    }

    gen.request.abort();
    setGeneration(chatId, null);
    useChatStore.getState().setChatGenerating(chatId, false);

    setAllChats((prev) => {
      const currentMessages = prev[chatId] || [];
      return {
        ...prev,
        [chatId]: currentMessages.map((message) =>
          message.id === gen.assistantMessageId
            ? { ...message, isStreaming: false }
            : message,
        ),
      };
    });
  }, []);

  const streamChatTitle = useCallback(
    async (
      chatId: string,
      nextTitle: string,
      exchange: { userContent: string; assistantContent: string },
      options?: { persist?: boolean },
    ) => {
      const title = normalizeChatTitle(nextTitle, exchange);
      const shouldPersist = options?.persist !== false;
      pendingTitleOverridesRef.current.set(chatId, title);

      setRecentChats((prev) => {
        const next = prev.map((chat) =>
          chat.id === chatId ? { ...chat, isTitleStreaming: true } : chat,
        );
        recentChatsRef.current = next;
        return next;
      });

      for (
        let index = CHAT_TITLE_STREAM_CHUNK;
        index <= title.length;
        index += CHAT_TITLE_STREAM_CHUNK
      ) {
        await new Promise((resolve) =>
          setTimeout(resolve, CHAT_TITLE_STREAM_CHAR_MS),
        );
        const partial = title.slice(0, index);
        setRecentChats((prev) => {
          const next = prev.map((chat) =>
            chat.id === chatId
              ? { ...chat, name: partial, isTitleStreaming: true }
              : chat,
          );
          recentChatsRef.current = next;
          return next;
        });
      }

      setRecentChats((prev) => {
        const next = prev.map((chat) =>
          chat.id === chatId
            ? {
                ...chat,
                name: title,
                isTitleStreaming: false,
                titleGenerated: true,
              }
            : chat,
        );
        recentChatsRef.current = next;
        return next;
      });

      if (userId) {
        void persistDeviceRecentChatsNow(
          userId,
          recentChatsRef.current,
          useChatStore.getState().activeChatId,
        );
      }

      if (!shouldPersist) return title;

      try {
        await chatsApi.updateChat(chatId, { title });
      } catch (error) {
        console.error("Failed to persist chat title:", error);
      }
      return title;
    },
    [userId],
  );

  const maybeGenerateChatTitle = useCallback(
    async (
      chatId: string,
      initialExchange: { userContent: string; assistantContent?: string },
    ) => {
      if (titleGenerationInProgressRef.current.has(chatId)) return;

      const chatMeta = recentChatsRef.current.find((c) => c.id === chatId);
      if (!chatMeta || chatMeta.titleGenerated) return;

      if (!initialExchange.userContent.trim()) {
        return;
      }

      if (!initialExchange.assistantContent?.trim()) {
        return;
      }

      titleGenerationInProgressRef.current.add(chatId);

      const userContentForTitle = stripTitleSourceText(
        initialExchange.userContent,
      );
      const assistantContentForTitle = stripTitleSourceText(
        initialExchange.assistantContent ?? "",
      );
      const exchange = {
        userContent: userContentForTitle,
        assistantContent: assistantContentForTitle,
      };
      const fallbackTitle = deriveTitleFromExchange(
        userContentForTitle,
        assistantContentForTitle,
      );

      try {
        // Paint + animate a local title immediately so the header/sidebar
        // never wait on the title API. Refine if the server returns better.
        const streamedFallback = await streamChatTitle(
          chatId,
          fallbackTitle,
          exchange,
          { persist: false },
        );

        try {
          const titleMessages = [
            { role: "user", content: userContentForTitle },
            ...(assistantContentForTitle
              ? [{ role: "assistant", content: assistantContentForTitle }]
              : []),
          ];
          const { title } = await chatsApi.generateChatTitle(
            chatId,
            titleMessages,
          );
          const refined = normalizeChatTitle(title, exchange);
          if (
            refined &&
            refined.trim().toLowerCase() !==
              streamedFallback.trim().toLowerCase()
          ) {
            await streamChatTitle(chatId, refined, exchange);
          } else {
            pendingTitleOverridesRef.current.set(chatId, streamedFallback);
            try {
              await chatsApi.updateChat(chatId, { title: streamedFallback });
            } catch (error) {
              console.error("Failed to persist chat title:", error);
            }
          }
        } catch {
          pendingTitleOverridesRef.current.set(chatId, streamedFallback);
          try {
            await chatsApi.updateChat(chatId, { title: streamedFallback });
          } catch (error) {
            console.error("Failed to persist chat title:", error);
          }
        }
      } finally {
        titleGenerationInProgressRef.current.delete(chatId);
      }
    },
    [streamChatTitle],
  );

  const streamAssistantResponse = useCallback(
    async (
      chatId: string,
      conversation: Array<{ role: string; content: string }>,
      titleUserContent?: string,
      overrideAssistantId?: string,
      turn?: {
        content: string;
        modelContent?: string;
        fileIds?: string[];
        userClientId: string;
        assistantClientId: string;
      },
      options?: { ephemeral?: boolean },
    ) => {
      const ephemeral = options?.ephemeral === true;
      const controller = new AbortController();
      const assistantIdLocal =
        overrideAssistantId ?? turn?.assistantClientId ?? randomUUID();
      let assistantId = assistantIdLocal;
      const assistantClientId = assistantIdLocal;
      setGeneration(chatId, {
        request: controller,
        assistantMessageId: assistantId,
      });
      useChatStore.getState().setChatGenerating(chatId, true);
      useChatStore.getState().setStreaming({ chatId, messageId: assistantId });

      const resolveAssistantId = () => {
        const gen = getGeneration(chatId);
        if (gen?.request === controller && gen.assistantMessageId) {
          assistantId = gen.assistantMessageId;
          return assistantId;
        }
        const store = useChatStore.getState();
        const ids = store.messageIdsByChatId[chatId] ?? [];
        for (const id of ids) {
          const message = store.messagesById[id];
          if (
            !message ||
            message.role !== "assistant" ||
            !(
              message.id === assistantId ||
              message.id === assistantClientId ||
              message.clientId === assistantClientId
            )
          ) {
            continue;
          }
          if (message.id !== assistantId) {
            assistantId = message.id;
            if (gen?.request === controller) {
              setGeneration(chatId, {
                request: controller,
                assistantMessageId: assistantId,
              });
            }
            useChatStore
              .getState()
              .setStreaming({ chatId, messageId: assistantId });
          }
          return assistantId;
        }
        return assistantId;
      };

      // Optimistic assistant placeholder — visible immediately with fade-in
      // while the generate request is in flight (cuts perceived TTFT).
      setAllChats((prev) => {
        const current = prev[chatId] ?? [];
        const exists = current.some(
          (m) => m.id === assistantId || m.clientId === assistantClientId,
        );
        if (exists) {
          return {
            ...prev,
            [chatId]: current.map((m) =>
              m.id === assistantId || m.clientId === assistantClientId
                ? {
                    ...m,
                    clientId: m.clientId ?? assistantClientId,
                    isStreaming: true,
                    // Keep any tokens already painted if this is a reconcile.
                    content: m.content ?? "",
                    thinkingContent: m.thinkingContent ?? "",
                    hasThinking: m.hasThinking ?? false,
                    agentMode: m.agentMode ?? false,
                    agentFrameComplete: false,
                  }
                : m,
            ),
          };
        }
        return {
          ...prev,
          [chatId]: [
            ...current,
            {
              id: assistantId,
              clientId: assistantClientId,
              role: "assistant",
              content: "",
              isStreaming: true,
              agentMode: false,
              agentFrameComplete: false,
            },
          ],
        };
      });

      try {
        const generateBody = JSON.stringify({
          messages: conversation,
          homerReasoningEffort,
          chatModel,
          extendedThinking,
          // Keep title generation off the hot response path; it runs after the
          // answer completes so first-token rendering is not blocked.
          generateChatTitle: false,
          ...(!ephemeral && turn
            ? {
                turn: {
                  content: turn.content,
                  modelContent: turn.modelContent,
                  fileIds: turn.fileIds,
                  userClientId: turn.userClientId,
                  assistantClientId,
                },
              }
            : {}),
        });

        // Brief retry on lease races: previous turn just ended / ask pause
        // released the DO a few ms after the client became idle.
        let response: Response | null = null;
        let lastDetail = "Generation failed";
        const generateUrl = ephemeral
          ? "/api/v1/incognito/generate"
          : `/api/v1/chats/${chatId}/generate`;
        for (let attempt = 0; attempt < 6; attempt += 1) {
          const attemptResponse = await fetch(generateUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "text/event-stream",
            },
            credentials: "include",
            body: generateBody,
            signal: controller.signal,
          });

          // Cloudflare/Vercel challenge HTML on /generate — brief retry instead
          // of ending the turn with "Connection was interrupted".
          if (
            attemptResponse.body &&
            !isEventStreamResponse(attemptResponse)
          ) {
            const peek = await attemptResponse.clone().text();
            if (looksLikeSecurityChallenge(attemptResponse, peek)) {
              lastDetail = "Security check in progress. Please retry in a moment.";
              if (attempt < 5) {
                await new Promise((resolve) =>
                  setTimeout(resolve, 400 + attempt * 200),
                );
                continue;
              }
              throw new Error(lastDetail);
            }
          }

          if (attemptResponse.ok && attemptResponse.body) {
            response = attemptResponse;
            break;
          }

          let detail = `Generation failed (${attemptResponse.status})`;
          let leaseBusy = attemptResponse.status === 409;
          try {
            const payload = (await attemptResponse.json()) as {
              error?: string | { message?: string };
              message?: string;
              code?: string;
            };
            const fromError =
              typeof payload.error === "string"
                ? payload.error
                : payload.error?.message;
            detail = fromError || payload.message || detail;
            leaseBusy =
              leaseBusy ||
              payload.code === "generation_in_progress" ||
              /already generating/i.test(detail);
          } catch {
            // ignore parse errors
          }
          lastDetail = detail;
          if (!leaseBusy || attempt === 5) {
            throw new Error(detail);
          }
          await new Promise((resolve) =>
            setTimeout(resolve, 80 + attempt * 60),
          );
        }
        if (!response?.ok || !response.body) {
          throw new Error(lastDetail);
        }

        const serverUserId = response.headers.get("X-User-Message-Id");
        if (turn && serverUserId && serverUserId !== turn.userClientId) {
          setAllChats((prev) => {
            const list = prev[chatId] ?? [];
            const index = list.findIndex(
              (message) =>
                message.id === turn.userClientId ||
                message.clientId === turn.userClientId,
            );
            if (index < 0) return prev;
            const next = [...list];
            next[index] = {
              ...next[index]!,
              id: serverUserId,
              clientId: next[index]!.clientId ?? turn.userClientId,
            };
            return { ...prev, [chatId]: next };
          });
        }

        // Sync optimistic local id → durable DB assistant id (prevents duplicates).
        const serverAssistantId = response.headers.get("X-Assistant-Message-Id");
        if (serverAssistantId && serverAssistantId !== assistantId) {
          const previousId = assistantId;
          assistantId = serverAssistantId;
          const current = getGeneration(chatId);
          if (current?.request === controller) {
            setGeneration(chatId, {
              request: controller,
              assistantMessageId: assistantId,
            });
          }
          useChatStore.getState().setStreaming({ chatId, messageId: assistantId });
          setAllChats((prev) => {
            const list = prev[chatId] ?? [];
            const index = list.findIndex(
              (message) =>
                message.id === previousId ||
                message.clientId === assistantClientId,
            );
            if (index < 0) return prev;
            const next = [...list];
            next[index] = {
              ...next[index]!,
              id: assistantId,
              clientId: next[index]!.clientId ?? assistantClientId,
            };
            return { ...prev, [chatId]: next };
          });
        }

        let completedAnswer = "";
        const answerAccumulator = titleUserContent
          ? createChatTitleAnswerAccumulator()
          : null;

        const applyInlineChatTitle = async (rawTitle: string) => {
          const chatMeta = recentChatsRef.current.find((c) => c.id === chatId);
          if (chatMeta?.titleGenerated || chatMeta?.isTitleStreaming) return;
          if (titleGenerationInProgressRef.current.has(chatId)) return;
          const title = normalizeInlineChatTitle(
            rawTitle,
            titleUserContent ?? "",
          );
          if (!title) return;
          titleGenerationInProgressRef.current.add(chatId);
          try {
            await streamChatTitle(chatId, title, {
              userContent: titleUserContent ?? "",
              assistantContent: "",
            });
          } finally {
            titleGenerationInProgressRef.current.delete(chatId);
          }
        };

        const handleStreamEventImmediate = (event: StreamEvent) => {
          const targetAssistantId = resolveAssistantId();
          if (event.type === "chat_title") {
            void applyInlineChatTitle(event.title);
            return;
          }
          if (event.type === "answer_delta") {
            let visibleDelta = sanitizeAssistantStreamDelta(event.delta);
            if (answerAccumulator) {
              visibleDelta = appendChatTitleAnswerDelta(
                answerAccumulator,
                visibleDelta,
              );
              const extractedTitle = extractChatTitleFromText(
                answerAccumulator.raw,
              );
              if (extractedTitle) {
                void applyInlineChatTitle(extractedTitle);
              }
              completedAnswer = answerAccumulator.visible;
            } else {
              completedAnswer += visibleDelta;
            }

            if (!visibleDelta) return;

            const msg = useChatStore.getState().messagesById[targetAssistantId];
            if (canFastAppendAnswer(msg)) {
              useChatStore
                .getState()
                .appendMessageField(
                  chatId,
                  targetAssistantId,
                  "content",
                  visibleDelta,
                );
            } else {
              patchAssistantMessage(chatId, targetAssistantId, (message) =>
                applyAgentStreamEvent(message, {
                  ...event,
                  delta: visibleDelta,
                }),
              );
            }
            return;
          }
          if (event.type === "answer_finalize") {
            // Agent loop promotes the final-round narration wholesale.
            // Seed the title accumulator so post-stream finalize cannot
            // overwrite a good answer with an unused empty accumulator.
            const finalized = finalizeChatTitleStrippedAnswer(event.text);
            if (answerAccumulator) {
              seedChatTitleAnswerAccumulator(answerAccumulator, event.text);
              const extractedTitle = extractChatTitleFromText(
                answerAccumulator.raw,
              );
              if (extractedTitle) {
                void applyInlineChatTitle(extractedTitle);
              }
            }
            completedAnswer = finalized;
            patchAssistantMessage(chatId, targetAssistantId, (message) =>
              applyAgentStreamEvent(message, event),
            );
            return;
          }
          if (event.type === "narration_delta") {
            // Title tags may arrive inside narration on the first turn.
            const visibleDelta = sanitizeAssistantStreamDelta(event.delta);
            if (answerAccumulator && visibleDelta) {
              appendChatTitleAnswerDelta(answerAccumulator, visibleDelta);
              const extractedTitle = extractChatTitleFromText(
                answerAccumulator.raw,
              );
              if (extractedTitle) {
                void applyInlineChatTitle(extractedTitle);
              }
            }
            patchAssistantMessage(chatId, targetAssistantId, (message) =>
              applyAgentStreamEvent(message, {
                ...event,
                delta: visibleDelta || event.delta,
              }),
            );
            return;
          }
          if (event.type === "tool_output_delta") {
            patchAssistantMessage(chatId, targetAssistantId, (message) =>
              patchToolOutputDelta(message, event),
            );
            return;
          }
          if (event.type === "error") {
            throw new Error(event.message);
          }
          if (
            event.type === "tool_end" &&
            event.name === "ask_user_input_v0"
          ) {
            // Mark the ask turn idle in the transcript, but keep the generation
            // controller until SSE `done`. Clearing early made bypassQueue think
            // the lease was free while the server still held it → 409.
            patchAssistantMessage(chatId, targetAssistantId, (message) => {
              const next = applyAgentStreamEvent(message, event);
              return {
                ...next,
                isStreaming: false,
                isThinkingStreaming: false,
                agentFrameComplete: true,
              };
            });
            return;
          }
          patchAssistantMessage(chatId, targetAssistantId, (message) =>
            applyAgentStreamEvent(message, event),
          );
        };

        const streamBatcher = createStreamEventBatcher({
          onFlush: (events) => {
            for (const event of events) {
              handleStreamEventImmediate(event);
            }
          },
        });

        const handleStreamEvent = (event: StreamEvent) => {
          // Flush immediately on lifecycle boundaries so tool/thinking shimmer
          // clears in the same frame the server ends the step.
          if (
            event.type === "error" ||
            event.type === "done" ||
            event.type === "tool_end" ||
            event.type === "thinking_end" ||
            event.type === "segment_end" ||
            event.type === "answer_finalize"
          ) {
            streamBatcher.flush();
            handleStreamEventImmediate(event);
            return;
          }
          streamBatcher.push(event);
        };

        await streamFromResponse(
          response,
          { onEvent: handleStreamEvent },
          controller.signal,
        );
        streamBatcher.dispose();

        if (answerAccumulator && answerAccumulator.raw.trim()) {
          const finalized = finalizeChatTitleStrippedAnswer(
            answerAccumulator.raw,
          );
          answerAccumulator.visible = finalized;
          if (!completedAnswer.trim() && finalized.trim()) {
            completedAnswer = finalized;
          }
          const extractedTitle = extractChatTitleFromText(
            answerAccumulator.raw,
          );
          if (extractedTitle) {
            void applyInlineChatTitle(extractedTitle);
          }
          if (finalized.trim() && !completedAnswer.trim()) {
            patchAssistantMessage(chatId, resolveAssistantId(), (message) => ({
              ...message,
              content: finalized,
            }));
          }
        }

        if (getGeneration(chatId)?.request !== controller) return;

        const finalizedAssistantId = resolveAssistantId();
        setAllChats((prev) => ({
          ...prev,
          [chatId]: (prev[chatId] ?? []).map((m) =>
            m.id === finalizedAssistantId || m.clientId === assistantClientId
              ? {
                  ...m,
                  content: (() => {
                    const finalized = resolveFinalStreamedAnswer({
                      completedAnswer,
                      accumulatorRaw: answerAccumulator?.raw,
                      messageContent: m.content,
                    });
                    const visible = agentAnswerDuplicatesInterim({
                      ...m,
                      content: finalized,
                    })
                      ? m.content
                      : finalized;
                    // The backend persists the same fallback, but paint one
                    // immediately when a model closes its SSE turn without text.
                    // A completed blank assistant is never a valid UI state —
                    // except ask_user_input pauses, which intentionally wait.
                    if (visible.trim()) return visible;
                    const hasPendingAsk = (m.agentFrames ?? [])
                      .flatMap((frame) => frame.segments)
                      .concat(m.agentSegments ?? [])
                      .some(
                        (segment) =>
                          segment.kind === "tool" &&
                          segment.name === "ask_user_input_v0" &&
                          segment.status === "done",
                      );
                    return hasPendingAsk
                      ? ""
                      : EMPTY_ASSISTANT_RESPONSE_FALLBACK;
                  })(),
                  isStreaming: false,
                  isThinkingStreaming: false,
                  agentFrameComplete: true,
                  generationFailed: (() => {
                    const finalized = resolveFinalStreamedAnswer({
                      completedAnswer,
                      accumulatorRaw: answerAccumulator?.raw,
                      messageContent: m.content,
                    });
                    if (finalized.trim()) return false;
                    const hasPendingAsk = (m.agentFrames ?? [])
                      .flatMap((frame) => frame.segments)
                      .concat(m.agentSegments ?? [])
                      .some(
                        (segment) =>
                          segment.kind === "tool" &&
                          segment.name === "ask_user_input_v0" &&
                          segment.status === "done",
                      );
                    return !hasPendingAsk;
                  })(),
                  thinkingDurationSeconds:
                    m.thinkingDurationSeconds ??
                    (m.thinkingStartedAtMs
                      ? Math.max(
                          1,
                          Math.round((Date.now() - m.thinkingStartedAtMs) / 1000),
                        )
                      : undefined),
                }
              : m,
          ),
        }));

        if (!ephemeral) {
          scheduleBranchPersist(chatId);
          if (titleUserContent && completedAnswer.trim()) {
            void maybeGenerateChatTitle(chatId, {
              userContent: titleUserContent,
              assistantContent: completedAnswer,
            });
          }
        }
      } catch (error) {
        // Aborts come from stopGeneration, which already finalized the
        // assistant message and cleared generation state.
        const isAbort =
          error instanceof Error && error.name === "AbortError";
        if (getGeneration(chatId)?.request === controller && !isAbort) {
          const failedAssistantId = resolveAssistantId();
          const rawMessage =
            error instanceof Error ? error.message : String(error ?? "");
          const friendly = toUserFacingChatError(rawMessage);
          setAllChats((prev) => {
            const list = prev[chatId] ?? [];
            return {
              ...prev,
              [chatId]: list.map((m) => {
                if (
                  m.id !== failedAssistantId &&
                  m.clientId !== assistantClientId
                ) {
                  return m;
                }
                // Proxy/challenge blips mid-stream: keep painted work and
                // soft-complete instead of replacing the answer with an error.
                if (hasUsefulAssistantProgress(m)) {
                  return {
                    ...m,
                    isStreaming: false,
                    isThinkingStreaming: false,
                    agentFrameComplete: true,
                    generationFailed: false,
                  };
                }
                return {
                  ...m,
                  isStreaming: false,
                  isThinkingStreaming: false,
                  agentFrameComplete: true,
                  generationFailed: true,
                  content: friendly,
                };
              }),
            };
          });
        }
        if (!isAbort) {
          console.error("Chat generation failed:", error);
        }
      } finally {
        // Only clear state if this generation is still the active one.
        if (getGeneration(chatId)?.request === controller) {
          setGeneration(chatId, null);
          useChatStore.getState().setChatGenerating(chatId, false);
          // Drain one queued prompt for this chat, if any.
          const nextQueued = useChatStore
            .getState()
            .shiftQueuedMessage(chatId);
          if (nextQueued?.content) {
            queueMicrotask(() => {
              void handleSendMessageRef.current?.(nextQueued.content, {
                forceNewChat: false,
                bypassQueue: true,
                chatIdOverride: chatId,
              });
            });
          }
        }
      }
    },
    [
      maybeGenerateChatTitle,
      scheduleBranchPersist,
      streamChatTitle,
      streamFromResponse,
      homerReasoningEffort,
      chatModel,
      extendedThinking,
    ],
  );

  const handleSendMessage = useCallback(
    async (
      prompt: string,
      options?: {
        forceNewChat?: boolean;
        bypassQueue?: boolean;
        chatIdOverride?: string;
        attachments?: ComposerAttachment[];
        /** Bind a new chat to this project (overrides session projectIdFilter). */
        projectId?: string | null;
        /** Fires the moment a brand-new chat has a durable id (before persist/stream). */
        onChatCreated?: (chatId: string) => void;
        /** Incognito: in-memory only — no DB chat, files, or history. */
        ephemeral?: boolean;
      },
    ): Promise<string | null> => {
      const trimmed = prompt.trim();
      const pendingAttachments = options?.attachments ?? [];
      const ephemeral = options?.ephemeral === true;
      if (!trimmed && pendingAttachments.length === 0) return null;
      if (creatingChatPending && !options?.chatIdOverride && !ephemeral) {
        return null;
      }

      const bindProjectId =
        options?.projectId !== undefined
          ? options.projectId
          : projectIdFilter;

      let chatId = options?.chatIdOverride
        ? options.chatIdOverride
        : options?.forceNewChat
          ? null
          : activeChatId;

      // ChatGPT-style: while this chat is generating, new prompts go to the
      // queue instead of racing a second generation (which produced 409s).
      // Attachment-only sends cannot be queued yet — require an idle chat.
      const locallyGenerating = Boolean(
        chatId &&
          (useChatStore.getState().generatingChatIds[chatId] ||
            getGeneration(chatId)),
      );
      if (chatId && !options?.bypassQueue && locallyGenerating) {
        if (!trimmed) return null;
        useChatStore.getState().enqueueQueuedMessage(chatId, trimmed);
        return chatId;
      }

      // Ask-user answers bypass the queue, but the paused SSE turn may still
      // hold the generation controller / DO lease for a few ms after tool_end.
      // Wait for teardown so we don't race into a 409.
      if (chatId && options?.bypassQueue) {
        const deadline = Date.now() + 8_000;
        while (Date.now() < deadline) {
          const stillHeld =
            Boolean(getGeneration(chatId)) ||
            Boolean(useChatStore.getState().generatingChatIds[chatId]);
          if (!stillHeld) break;
          await new Promise((resolve) => setTimeout(resolve, 40));
        }
      }

      const isNewChat = !chatId;
      const tempUserId = `temp-${randomUUID()}`;
      const optimisticUser: Message = {
        id: tempUserId,
        clientId: tempUserId,
        role: "user",
        content: trimmed,
        attachments:
          !ephemeral && pendingAttachments.length > 0
            ? toMessageAttachments(pendingAttachments)
            : undefined,
      };

      // Optimistic pending id — paint chat-view + sidebar immediately.
      // Incognito uses a local session id and never touches Recents.
      let pendingChatId: string | null = null;
      if (!chatId) {
        pendingChatId = ephemeral
          ? `incognito-${randomUUID()}`
          : `pending-${randomUUID()}`;
        chatId = pendingChatId;
        if (!ephemeral) {
          setCreatingChatPending(true);
        }
        setActiveChatId(pendingChatId);
        if (!ephemeral) {
          setRecentChats((prev) => {
            const next = [
              {
                id: pendingChatId!,
                name: "New chat",
                titleGenerated: false,
                isCreating: true,
                projectId: bindProjectId ?? undefined,
                updatedAt: Date.now(),
              },
              ...prev.filter((c) => c.id !== pendingChatId),
            ];
            recentChatsRef.current = next;
            return next;
          });
        }
        setAllChats((prev) => ({
          ...prev,
          [pendingChatId!]: [optimisticUser],
        }));
        hydratedChatIdsRef.current.add(pendingChatId);
      } else {
        // Existing chat — paint the user bubble immediately (before network).
        setAllChats((prev) => ({
          ...prev,
          [chatId!]: [...(prev[chatId!] ?? []), optimisticUser],
        }));
        // Touch Recents so this chat stays at the top (ChatGPT/Claude).
        if (!ephemeral) {
          setRecentChats((prev) => {
            const touchedAt = Date.now();
            const next = [
              ...prev
                .filter((c) => c.id === chatId)
                .map((c) => ({ ...c, updatedAt: touchedAt })),
              ...prev.filter((c) => c.id !== chatId),
            ].sort((a, b) => {
              if (Boolean(a.pinned) !== Boolean(b.pinned)) {
                return a.pinned ? -1 : 1;
              }
              return (b.updatedAt ?? 0) - (a.updatedAt ?? 0);
            });
            recentChatsRef.current = next;
            return next;
          });
        }
      }

      try {
        if (pendingChatId && !ephemeral) {
          const { chat } = await chatsApi.createChat({
            title: "New chat",
            projectId: bindProjectId ?? undefined,
          });
          const realId = chat.id;

          // Remap generation map key if anything was registered under pending.
          const pendingGen = getGeneration(pendingChatId);
          if (pendingGen) {
            setGeneration(pendingChatId, null);
            setGeneration(realId, pendingGen);
          }
          useChatStore.getState().migrateChatId(pendingChatId, realId);
          hydratedChatIdsRef.current.delete(pendingChatId);
          hydratedChatIdsRef.current.add(realId);

          setRecentChats((prev) => {
            const next = [
              {
                id: realId,
                name: chat.title || "New chat",
                titleGenerated: false,
                isCreating: false,
                projectId: bindProjectId ?? undefined,
                updatedAt: Date.now(),
              },
              ...prev.filter((c) => c.id !== pendingChatId && c.id !== realId),
            ];
            recentChatsRef.current = next;
            return next;
          });
          chatId = realId;
          setCreatingChatPending(false);
          // Mark generating before navigation so /c/[id] select treats this as
          // a live turn and never kicks off a wiping hydrate/shimmer.
          useChatStore.getState().setChatGenerating(realId, true);
        } else if (pendingChatId && ephemeral) {
          useChatStore.getState().setChatGenerating(pendingChatId, true);
        }

        // Upload attachments in parallel; failures mark chips but still stream text.
        // Incognito never persists files — skip uploads entirely.
        const fileIds: string[] = [];
        let uploadFailures = 0;
        if (!ephemeral && pendingAttachments.length > 0) {
          const uploaded = await Promise.all(
            pendingAttachments.map(async (attachment) => {
              if (attachment.fileId) return attachment.fileId;
              if (!attachment.file) return null;
              try {
                return await uploadUserFile(attachment.file);
              } catch (error) {
                console.warn("[chat] attachment upload failed:", error);
                uploadFailures += 1;
                return null;
              }
            }),
          );
          for (const id of uploaded) {
            if (id) fileIds.push(id);
          }

          setAllChats((prev) => {
            const list = prev[chatId!] ?? [];
            const index = list.findIndex((message) => message.id === tempUserId);
            if (index < 0) return prev;
            const next = [...list];
            const current = next[index]!;
            next[index] = {
              ...current,
              attachments: (current.attachments ?? []).map((item, i) => ({
                ...item,
                fileId: uploaded[i] ?? item.fileId,
                // Keep local preview even when upload fails so the chip still renders.
                previewUrl: item.previewUrl,
              })),
            };
            return { ...prev, [chatId!]: next };
          });

          if (uploadFailures > 0 && fileIds.length === 0) {
            console.warn(
              `[chat] ${uploadFailures} attachment upload(s) failed; continuing with text only`,
            );
          }
        }

        const attachmentContext =
          pendingAttachments.length > 0
            ? [
                "",
                "[Attached files]",
                ...pendingAttachments.map((item) => {
                  if (item.kind === "document" && item.textPreview) {
                    return `- ${item.name}:\n${item.textPreview.slice(0, 8000)}`;
                  }
                  return `- ${item.name} (${item.mimeType || item.kind})`;
                }),
              ].join("\n")
            : "";

        const modelUserContent = `${trimmed}${attachmentContext}`.trim();
        const modelUser: Message = {
          ...optimisticUser,
          content: modelUserContent || trimmed || "(attached files)",
        };

        const priorMessages = (allChatsRef.current[chatId!] ?? []).filter(
          (message) => message.id !== tempUserId,
        );
        const conversation = buildConversation([
          ...priorMessages,
          modelUser,
        ]);

        // One server-owned turn creates the durable user and assistant rows in
        // a transaction. Sending their stable client ids makes browser retries
        // idempotent without racing a separate /messages request.
        const assistantClientId = randomUUID();
        const userContent = trimmed || "(attached files)";
        useChatStore.getState().setChatGenerating(chatId!, true);

        // Open /c/{id} only after the assistant placeholder is armed so the
        // route swap cannot land on an empty streaming orb.
        void streamAssistantResponse(
          chatId!,
          conversation,
          !ephemeral && isNewChat ? trimmed || "New chat" : undefined,
          assistantClientId,
          ephemeral
            ? undefined
            : {
                content: userContent,
                modelContent: modelUserContent || userContent,
                fileIds: fileIds.length ? fileIds : undefined,
                userClientId: tempUserId,
                assistantClientId,
              },
          { ephemeral },
        );

        if (pendingChatId && !ephemeral) {
          try {
            options?.onChatCreated?.(chatId!);
          } catch {
            // Navigation callbacks must not abort the send path.
          }
        }

        return chatId;
      } catch (error) {
        if (pendingChatId) {
          setCreatingChatPending(false);
          if (!ephemeral) {
            setRecentChats((prev) => {
              const next = prev.filter((c) => c.id !== pendingChatId);
              recentChatsRef.current = next;
              return next;
            });
          }
          useChatStore.getState().removeChat(pendingChatId);
          if (useChatStore.getState().activeChatId === pendingChatId) {
            setActiveChatId(null);
          }
          hydratedChatIdsRef.current.delete(pendingChatId);
        }
        console.warn("[chat] send failed:", error);
        return null;
      } finally {
        if (isNewChat && !ephemeral) setCreatingChatPending(false);
      }
    },
    [
      activeChatId,
      creatingChatPending,
      projectIdFilter,
      streamAssistantResponse,
    ],
  );

  handleSendMessageRef.current = handleSendMessage;

  const handleDeleteChat = useCallback(
    async (chatId: string) => {
      // Stop any in-flight generation for this chat first.
      const gen = getGeneration(chatId);
      if (gen) {
        void fetch(`/api/v1/chats/${chatId}/generate/stop`, {
          method: "POST",
          credentials: "include",
        }).catch(() => {});
        gen.request.abort();
        setGeneration(chatId, null);
      }
      useChatStore.getState().setChatGenerating(chatId, false);
      useChatStore.setState((state) => {
        const queued = { ...state.queuedMessagesByChatId };
        delete queued[chatId];
        return { queuedMessagesByChatId: queued };
      });

      await chatsApi.deleteChat(chatId);
      setAllChats((prev) => {
        const next = { ...prev };
        delete next[chatId];
        return next;
      });
      hydratedChatIdsRef.current.delete(chatId);
      void forgetDeviceChat(chatId);
      const remaining = recentChats.filter((c) => c.id !== chatId);
      setRecentChats(remaining);
      recentChatsRef.current = remaining;
      // Leave navigation to the caller (sidebar / chat header → /new).
      if (activeChatId === chatId) {
        setActiveChatId(null);
      }
    },
    [activeChatId, recentChats],
  );

  const handleRenameChat = useCallback(
    async (chatId: string, newName: string) => {
      const title = newName.trim();
      if (!title) return;
      const previous =
        recentChatsRef.current.find((c) => c.id === chatId)?.name ?? "New Chat";
      pendingTitleOverridesRef.current.set(chatId, title);
      setRecentChats((prev) => {
        const next = prev.map((c) =>
          c.id === chatId
            ? { ...c, name: title, titleGenerated: true, isTitleStreaming: false }
            : c,
        );
        recentChatsRef.current = next;
        return next;
      });
      if (userId) {
        void persistDeviceRecentChatsNow(
          userId,
          recentChatsRef.current,
          useChatStore.getState().activeChatId,
        );
      }
      try {
        await chatsApi.updateChat(chatId, { title });
      } catch (error) {
        console.error("Failed to persist chat rename:", error);
        pendingTitleOverridesRef.current.delete(chatId);
        setRecentChats((prev) => {
          const next = prev.map((c) =>
            c.id === chatId ? { ...c, name: previous } : c,
          );
          recentChatsRef.current = next;
          return next;
        });
      }
    },
    [userId],
  );

  const handlePinChat = useCallback(
    (chatId: string, pinned: boolean) => {
      const prevPinned = recentChatsRef.current.find(
        (c) => c.id === chatId,
      )?.pinned;
      // Instant UI — never block on Hyperdrive / API. Persist in background.
      // Keep override until list refresh sees the same pinned value.
      pendingPinOverridesRef.current.set(chatId, pinned);
      setRecentChats((prev) => {
        const next = prev
          .map((chat) => (chat.id === chatId ? { ...chat, pinned } : chat))
          .sort((a, b) => {
            if (Boolean(a.pinned) !== Boolean(b.pinned)) {
              return a.pinned ? -1 : 1;
            }
            return (b.updatedAt ?? 0) - (a.updatedAt ?? 0);
          });
        recentChatsRef.current = next;
        return next;
      });

      if (userId) {
        void persistDeviceRecentChatsNow(
          userId,
          recentChatsRef.current,
          useChatStore.getState().activeChatId,
        );
      }

      void (pinned ? chatsApi.pinChat(chatId) : chatsApi.unpinChat(chatId)).catch(
        (error) => {
          console.error("Failed to persist chat pin:", error);
          pendingPinOverridesRef.current.delete(chatId);
          setRecentChats((prev) => {
            const next = prev
              .map((chat) =>
                chat.id === chatId
                  ? { ...chat, pinned: Boolean(prevPinned) }
                  : chat,
              )
              .sort((a, b) => {
                if (Boolean(a.pinned) !== Boolean(b.pinned)) {
                  return a.pinned ? -1 : 1;
                }
                return (b.updatedAt ?? 0) - (a.updatedAt ?? 0);
              });
            recentChatsRef.current = next;
            return next;
          });
          if (userId) {
            void persistDeviceRecentChatsNow(
              userId,
              recentChatsRef.current,
              useChatStore.getState().activeChatId,
            );
          }
        },
      );
    },
    [userId],
  );

  const editMessageWithBranch = useCallback(
    async (
      chatId: string,
      messageId: string,
      newContent: string,
      options?: { attachments?: ComposerAttachment[] },
    ) => {
      const trimmed = newContent.trim();
      const pendingAttachments = options?.attachments ?? [];
      if ((!trimmed && pendingAttachments.length === 0) || isGenerating) return;

      const existing = allChatsRef.current[chatId] || [];
      const assistantMessageId = randomUUID();

      // Upload new local files; keep existing fileIds.
      const uploadedAttachments: ComposerAttachment[] = await Promise.all(
        pendingAttachments.map(async (attachment) => {
          if (attachment.fileId || !attachment.file) return attachment;
          try {
            const fileId = await uploadUserFile(attachment.file);
            return {
              ...attachment,
              fileId,
              uploadStatus: "ready" as const,
            };
          } catch (error) {
            console.warn("[chat] edit attachment upload failed:", error);
            return { ...attachment, uploadStatus: "error" as const };
          }
        }),
      );
      const messageAttachments = toMessageAttachments(uploadedAttachments);

      let helperResult;
      try {
        helperResult = editMessageWithBranchHelper(
          existing,
          messageId,
          trimmed,
          assistantMessageId,
          messageAttachments,
        );
      } catch (err) {
        console.error(err);
        return;
      }

      useChatStore.getState().setChatGenerating(chatId, true);

      const { nextChat } = helperResult;
      setAllChats((prev) => ({
        ...prev,
        [chatId]: nextChat,
      }));

      const attachmentContext =
        uploadedAttachments.length > 0
          ? [
              "",
              "[Attached files]",
              ...uploadedAttachments.map((item) => {
                if (item.kind === "document" && item.textPreview) {
                  return `- ${item.name}:\n${item.textPreview.slice(0, 8000)}`;
                }
                return `- ${item.name} (${item.mimeType || item.kind})`;
              }),
            ].join("\n")
          : "";

      const conversationBase = nextChat.slice(0, -1).map((msg) =>
        msg.id === messageId
          ? {
              ...msg,
              content: `${trimmed}${attachmentContext}`.trim() ||
                trimmed ||
                "(attached files)",
            }
          : msg,
      );
      const conversationForApi = buildConversation(conversationBase);

      try {
        await streamAssistantResponse(
          chatId,
          conversationForApi,
          undefined,
          assistantMessageId,
        );
      } finally {
        const finalMessages = allChatsRef.current[chatId] || [];
        setAllChats((prev) => ({
          ...prev,
          [chatId]: attachSnapshotToBranchVersion(finalMessages, messageId),
        }));
        scheduleBranchPersist(chatId);
      }
    },
    [isGenerating, streamAssistantResponse, scheduleBranchPersist],
  );

  const redoUserMessageWithBranch = useCallback(
    async (chatId: string, messageId: string) => {
      if (isGenerating) return;
      const existing = allChatsRef.current[chatId] || [];
      const assistantMessageId = randomUUID();

      let helperResult;
      try {
        helperResult = redoUserMessageWithBranchHelper(
          existing,
          messageId,
          assistantMessageId,
        );
      } catch (err) {
        console.error(err);
        return;
      }

      useChatStore.getState().setChatGenerating(chatId, true);

      const { nextChat } = helperResult;
      setAllChats((prev) => ({
        ...prev,
        [chatId]: nextChat,
      }));

      const conversationForApi = buildConversation(nextChat.slice(0, -1));

      try {
        await streamAssistantResponse(
          chatId,
          conversationForApi,
          undefined,
          assistantMessageId,
        );
      } finally {
        const finalMessages = allChatsRef.current[chatId] || [];
        setAllChats((prev) => ({
          ...prev,
          [chatId]: attachSnapshotToBranchVersion(finalMessages, messageId),
        }));
        scheduleBranchPersist(chatId);
      }
    },
    [isGenerating, streamAssistantResponse, scheduleBranchPersist],
  );

  const retryAssistantWithBranch = useCallback(
    async (chatId: string, assistantMessageId: string) => {
      if (isGenerating) return;
      const existing = allChatsRef.current[chatId] || [];

      let helperResult;
      try {
        helperResult = retryAssistantWithBranchHelper(
          existing,
          assistantMessageId,
        );
      } catch (err) {
        console.error(err);
        return;
      }

      useChatStore.getState().setChatGenerating(chatId, true);

      const { nextChat } = helperResult;
      setAllChats((prev) => ({
        ...prev,
        [chatId]: nextChat,
      }));

      const conversationForApi = buildConversation(nextChat.slice(0, -1));

      try {
        await streamAssistantResponse(
          chatId,
          conversationForApi,
          undefined,
          assistantMessageId,
        );
      } finally {
        const finalMessages = allChatsRef.current[chatId] || [];
        setAllChats((prev) => ({
          ...prev,
          [chatId]: attachSnapshotToBranchVersion(
            finalMessages,
            assistantMessageId,
          ),
        }));
        scheduleBranchPersist(chatId);
      }
    },
    [isGenerating, streamAssistantResponse, scheduleBranchPersist],
  );

  const switchMessageBranch = useCallback(
    (chatId: string, messageId: string, direction: "prev" | "next") => {
      let nextChat: Message[] = [];
      setAllChats((prev) => {
        const chatMessages = prev[chatId] || [];
        const result = switchMessageBranchHelper(
          chatMessages,
          messageId,
          direction,
        );
        nextChat = result.nextChat;
        return {
          ...prev,
          [chatId]: result.nextChat,
        };
      });

      setTimeout(() => {
        if (nextChat.length) void persistBranches(chatId, nextChat);
      }, 100);
    },
    [persistBranches],
  );

  const generatingChatIds = useChatStore(
    useShallow((state) => Object.keys(state.generatingChatIds)),
  );
  const queuedMessages = useChatStore(
    useShallow((state) =>
      activeChatId ? (state.queuedMessagesByChatId[activeChatId] ?? []) : [],
    ),
  );

  const editQueuedMessage = useCallback(
    (id: string, content: string) => {
      if (!activeChatId) return;
      useChatStore.getState().updateQueuedMessage(activeChatId, id, content);
    },
    [activeChatId],
  );

  const removeQueuedMessage = useCallback(
    (id: string) => {
      if (!activeChatId) return;
      useChatStore.getState().removeQueuedMessage(activeChatId, id);
    },
    [activeChatId],
  );

  const sendQueuedMessageNow = useCallback(
    (id: string) => {
      if (!activeChatId) return;
      const promoted = useChatStore
        .getState()
        .promoteQueuedMessage(activeChatId, id);
      if (!promoted) return;
      if (useChatStore.getState().generatingChatIds[activeChatId]) {
        // Already generating — keep at front; will flush when idle.
        return;
      }
      const shifted = useChatStore.getState().shiftQueuedMessage(activeChatId);
      if (shifted) {
        void handleSendMessage(shifted.content, {
          bypassQueue: true,
          chatIdOverride: activeChatId,
        });
      }
    },
    [activeChatId, handleSendMessage],
  );

  return {
    messages,
    recentChats,
    startedRecentChats,
    activeChat,
    activeChatId,
    isGenerating,
    generatingChatIds,
    queuedMessages,
    editQueuedMessage,
    removeQueuedMessage,
    sendQueuedMessageNow,
    loading,
    messagesLoading,
    messagesLoadError,
    retryLoadMessages,
    creatingChatPending,
    handleSendMessage,
    stopGeneration,
    startNewChat,
    handleSelectChat,
    handleDeleteChat,
    handleRenameChat,
    handlePinChat,
    editMessageWithBranch,
    redoUserMessageWithBranch,
    retryAssistantWithBranch,
    switchMessageBranch,
    refreshChats,
  };
}
