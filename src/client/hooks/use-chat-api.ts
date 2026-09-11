"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import type { StreamEvent } from "@/lib/chat-stream";
import { applyAgentStreamEvent } from "@/lib/agent-trace-reducer";
import { sanitizeAssistantStreamDelta } from "@/lib/assistant-output-sanitize";
import {
  EMPTY_ASSISTANT_RESPONSE_FALLBACK,
  USER_FACING_CHAT_ERROR,
  hasUsefulAssistantProgress,
  toUserFacingChatError,
} from "@/lib/assistant-generation-error";
import {
  isEventStreamResponse,
  looksLikeSecurityChallenge,
} from "@/lib/security-challenge";
function canFastAppendAnswer(message: Message | undefined): boolean {
  return Boolean(message && !message.agentMode);
}
import { createStreamEventBatcher } from "@/lib/stream-event-batcher";
import type { Message, RecentChat } from "@/lib/types";
import { useAiStream } from "@/hooks/use-ai-stream";
import {
  getAllChatsNormalized,
  patchAssistantMessage,
  setAllChatsNormalized,
} from "@/lib/chat-store-bridge";
import {
  sealCompletedAssistantMessages,
  assignLegacyTurnIds,
} from "@/lib/chat-turn-helpers";
import {
  assistantClientIdForTurn,
  createTurnId,
  deriveTurnIdFromClientId,
  userClientIdForTurn,
} from "@/lib/chat-turn-id";
import {
  useActiveChatMessages,
  useActiveChatId,
  setActiveChatId,
  useChatStore,
} from "@/stores/chat-store";
import * as chatsApi from "@/lib/api/chats";
import { generateChatId } from "@/lib/chat-id";
import { uploadUserFile } from "@/lib/api/files";
import {
  toMessageAttachments,
  type ComposerAttachment,
} from "@/lib/composer-attachments";
import {
  attachmentContextLines,
  collectComposerVision,
} from "@/lib/composer-vision";
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
  syncMessageActiveVersion,
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

function isChatActivelyGenerating(chatId: string): boolean {
  return (
    Boolean(useChatStore.getState().generatingChatIds[chatId]) ||
    Boolean(getGeneration(chatId))
  );
}

/** Temp / pending ids mean an optimistic turn is on screen even before the lease. */
function hasOptimisticTurn(messages: readonly Message[]): boolean {
  return messages.some(
    (message) =>
      Boolean(message?.id?.startsWith("temp-")) ||
      Boolean(message?.id?.startsWith("pending-")) ||
      Boolean(message?.clientId?.startsWith("temp-")) ||
      Boolean(message?.clientId?.startsWith("pending-")),
  );
}

/** Never keep a streaming orb when this tab is not actively generating. */
function clearIdleStreamingFlags(message: Message): Message {
  if (!message.isStreaming && !message.isThinkingStreaming) return message;
  const now = Date.now();
  // Settle live clocks into static durations so an aborted turn keeps its
  // real "Worked for Ns" / "Thought for Ns" instead of losing them. Only live
  // steps are touched — persisted (non-streaming) steps keep their stored
  // stamps, and an already-stamped completion is never overwritten.
  const trace = message.agentTrace;
  let nextTrace = trace;
  if (trace && trace.complete !== true) {
    const steps = trace.steps.map((step) => {
      if (step.kind === "tool" && step.status === "running") {
        return { ...step, status: "done" as const, completedAtMs: now };
      }
      if (step.kind === "thinking" && step.isStreaming) {
        return {
          ...step,
          isStreaming: false as const,
          durationSeconds:
            step.durationSeconds ??
            (step.startedAtMs
              ? Math.max(1, Math.round((now - step.startedAtMs) / 1000))
              : 1),
        };
      }
      if (step.kind === "narration" && step.isStreaming) {
        return { ...step, isStreaming: false as const };
      }
      return step;
    });
    const latestStepEnd = steps.reduce(
      (latest, step) =>
        typeof step.completedAtMs === "number" &&
        step.completedAtMs > latest
          ? step.completedAtMs
          : latest,
      0,
    );
    nextTrace = {
      ...trace,
      steps,
      complete: true,
      completedAtMs:
        trace.completedAtMs ?? (latestStepEnd > 0 ? latestStepEnd : now),
    };
  }
  const thinkingDurationSeconds =
    message.isThinkingStreaming &&
    !(message.thinkingDurationSeconds && message.thinkingDurationSeconds > 0) &&
    typeof message.thinkingStartedAtMs === "number"
      ? Math.max(
          1,
          Math.round((now - message.thinkingStartedAtMs) / 1000),
        )
      : message.thinkingDurationSeconds;
  return {
    ...message,
    isStreaming: false,
    isThinkingStreaming: false,
    thinkingDurationSeconds,
    agentFrameComplete: true,
    agentTrace: nextTrace,
  };
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
    typeof createdAt === "number"
      ? Date.now() - createdAt
      : Number.POSITIVE_INFINITY;
  // Abandoned streaming rows look like "missing messages" after reload.
  const staleStreaming =
    row.status === "streaming" && ageMs > 90_000 && !(row.content ?? "").trim();
  const content = staleStreaming
    ? ""
    : finalizeChatTitleStrippedAnswer(
        row.content === "Generation interrupted." ? "" : row.content,
      );
  const isChatActive = isChatActivelyGenerating(row.chat_id);
  const activeGenAssistantId =
    getGeneration(row.chat_id)?.assistantMessageId ?? null;

  const clientId =
    typeof row.client_id === "string" && row.client_id.trim()
      ? row.client_id.trim()
      : row.id;

  // Only the active generation's assistant row may carry a live orb.
  // A previous turn's "streaming" status (DB lag) must not resurrect its orb
  // while a follow-up turn owns the stream.
  const isThisTurnActive =
    isChatActive &&
    (row.role !== "assistant" ||
      activeGenAssistantId === null ||
      row.id === activeGenAssistantId ||
      clientId === activeGenAssistantId);

  const base = compactMessageBranchData({
    id: row.id,
    clientId,
    // Turn identity is encoded in client_id, so DB rows rejoin the exact turn
    // they belong to after realtime / hydrate / reload.
    turnId: deriveTurnIdFromClientId(clientId),
    role: row.role as Message["role"],
    content,
    thinkingContent: meta.thinkingContent,
    hasThinking: meta.hasThinking,
    thinkingDurationSeconds: meta.thinkingDurationSeconds,
    branchVersions: meta.branchVersions,
    activeBranchIndex: meta.activeBranchIndex,
    attachments: Array.isArray(meta.attachments) ? meta.attachments : undefined,
    createdAt,
    isStreaming:
      isThisTurnActive &&
      (row.status === "streaming" || row.status === "queued") &&
      !staleStreaming,
  });
  return hydrateMessageFromContentJson(
    base,
    (row as { content_json?: unknown }).content_json,
  );
}

function buildConversation(messages: Message[]) {
  return buildChatConversation(messages);
}

/**
 * Abort any in-flight stream for a chat before forking a new branch.
 * Editing / retrying must hide the previous branch immediately even while a
 * response is still streaming — the stale stream is cancelled, its flags are
 * cleared, and the caller then truncates + paints the fresh placeholder in
 * the same synchronous update.
 */
function abortInFlightGenerationForBranch(chatId: string) {
  const gen = getGeneration(chatId);
  if (gen) {
    try {
      gen.request.abort();
    } catch {
      // ignore abort errors
    }
    setGeneration(chatId, null);
  }
  if (!chatId.startsWith("incognito-")) {
    void fetch(`/api/v1/chats/${chatId}/generate/stop`, {
      method: "POST",
      credentials: "include",
      keepalive: true,
    }).catch(() => {});
  }
  useChatStore.getState().setChatGenerating(chatId, false);
  useChatStore.getState().setStreaming(null);
  setAllChatsNormalized((prev) => {
    const list = prev[chatId];
    if (!list?.length) return prev;
    let changed = false;
    const next = list.map((message) => {
      if (!message.isStreaming && !message.isThinkingStreaming) return message;
      changed = true;
      // Settle live clocks into static durations so the snapshotted branch
      // keeps its real timings.
      return clearIdleStreamingFlags(message);
    });
    if (!changed) return prev;
    return { ...prev, [chatId]: next };
  });
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
  const [loading, setLoading] = useState(
    () => bootRecentChatsFromSync().length === 0,
  );
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
  /** Chats removed in the UI — keep them out of refresh merges until the server agrees. */
  const pendingDeletedChatIdsRef = useRef<Set<string>>(new Set());
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

  const refreshChats = useCallback(
    async (opts?: { silent?: boolean }) => {
      // Silent when caller asks and we already have rows (sync/IDB paint or prior fetch).
      const silent =
        opts?.silent === true &&
        (chatsLoadedOnceRef.current || recentChatsRef.current.length > 0);
      if (!silent) setLoading(true);
      try {
        const { chats } = await chatsApi.listChats(
          projectIdFilter ?? undefined,
        );
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
        const deletedIds = pendingDeletedChatIdsRef.current;
        setRecentChats((prev) => {
          const serverChatsVisible = serverChats.filter(
            (c) => !deletedIds.has(c.id),
          );
          // Once the server list no longer returns a deleted id, drop the hold.
          for (const id of [...deletedIds]) {
            if (!serverChats.some((c) => c.id === id)) {
              deletedIds.delete(id);
            }
          }
          const serverIds = new Set(serverChatsVisible.map((c) => c.id));
          // Keep rows the server list hasn't caught yet (pending create, or
          // Worker/list cache lag right after create / first message).
          const localOnly = prev.filter((c) => {
            if (deletedIds.has(c.id)) return false;
            if (serverIds.has(c.id)) return false;
            if (c.isCreating || c.id.startsWith("pending-")) return true;
            const age = now - (c.updatedAt ?? 0);
            return age >= 0 && age < LOCAL_LIST_GRACE_MS;
          });
          const merged = serverChatsVisible.map((server) => {
            const local = prev.find((p) => p.id === server.id);
            const pinOverride = pendingPinOverridesRef.current.get(server.id);
            const titleOverride = pendingTitleOverridesRef.current.get(
              server.id,
            );
            const pinned =
              pinOverride !== undefined ? pinOverride : server.pinned;
            // Drop pin override only once the server list agrees — avoids cache lag
            // flipping the chat out of Pinned after a successful POST.
            if (
              pinOverride !== undefined &&
              Boolean(server.pinned) === pinOverride
            ) {
              pendingPinOverridesRef.current.delete(server.id);
            }
            if (
              titleOverride !== undefined &&
              server.name.trim().toLowerCase() ===
                titleOverride.trim().toLowerCase()
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
                updatedAt: Math.max(
                  local.updatedAt ?? 0,
                  server.updatedAt ?? 0,
                ),
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
    },
    [projectIdFilter, userId],
  );

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
        silent: recentChatsRef.current.length > 0 || chatsLoadedOnceRef.current,
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
  // While THIS tab owns an SSE generation, the stream
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
        // Only remap the assistant that belongs to the *current* generation.
        // A late realtime UPDATE for a *previous* turn's assistant must not
        // hijack gen.assistantMessageId — otherwise the follow-up stream's
        // resolveAssistantId targets the wrong (previous) assistant and its
        // tools render under the previous user message.
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
          // The remapped assistant belongs to the current generation only when
          // it was located via the generation's own assistant identity — NOT
          // merely because a stale turn's realtime UPDATE shares mapped.clientId.
          const isCurrentGenerationAssistant =
            local.id === gen.assistantMessageId ||
            local.clientId === gen.assistantMessageId;
          if (local.id === mapped.id) return null;
          const next = [...existing];
          next[localIndex] = {
            ...local,
            id: mapped.id,
            clientId: local.clientId ?? mapped.clientId ?? local.id,
            turnId: local.turnId ?? mapped.turnId,
          };
          if (isCurrentGenerationAssistant) {
            setGeneration(activeChatId, {
              request: gen.request,
              assistantMessageId: mapped.id,
            });
            useChatStore
              .getState()
              .setStreaming({ chatId: activeChatId, messageId: mapped.id });
          }
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
            turnId: local.turnId ?? mapped.turnId,
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
          if (
            !row?.id ||
            (row.status === "cancelled" && !(row.content ?? "").trim())
          )
            return;
          const mapped = mapApiMessage(row);
          const store = useChatStore.getState();
          const existing = store.getMessagesForChat(activeChatId);
          const alreadyPresent = existing.some(
            (message) =>
              message.id === mapped.id ||
              (mapped.clientId &&
                (message.clientId === mapped.clientId ||
                  message.id === mapped.clientId)),
          );
          if (alreadyPresent) return;

          if (isStreamOwner()) {
            const remapped = remapIdsOnly(existing, mapped);
            if (remapped) {
              for (const message of remapped) {
                store.upsertMessage(activeChatId, message);
              }
            }
            return;
          }

          if (
            mapped.role === "assistant" &&
            mapped.isStreaming &&
            !(mapped.content ?? "").trim()
          ) {
            return;
          }

          store.upsertMessage(activeChatId, mapped);
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
          const store = useChatStore.getState();
          const existing = store.getMessagesForChat(activeChatId);

          // SSE owns the turn — ignore content/status from WAL entirely,
          // only remap ids if needed.
          if (isStreamOwner()) {
            const remapped = remapIdsOnly(existing, mapped);
            if (remapped) {
              for (const message of remapped) {
                store.upsertMessage(activeChatId, message);
              }
            }
            return;
          }

          const rowStatus = row.status;
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
              return;
            }
            store.upsertMessage(activeChatId, mapped);
            return;
          }

          const prevMessage = existing[index]!;
          const localHasAgentFrames =
            (prevMessage.agentTrace?.steps.length ?? 0) > 0;
          const mappedHasAgentFrames =
            (mapped.agentTrace?.steps.length ?? 0) > 0;
          const chatStillGenerating = isChatActivelyGenerating(activeChatId);
          const activeGenAssistantId =
            getGeneration(activeChatId)?.assistantMessageId ?? null;
          const isThisTurnActive =
            chatStillGenerating &&
            (activeGenAssistantId === null ||
              mapped.id === activeGenAssistantId ||
              mapped.clientId === activeGenAssistantId ||
              prevMessage.clientId === activeGenAssistantId);

          store.upsertMessage(activeChatId, {
            ...prevMessage,
            ...mapped,
            id: mapped.id,
            clientId: prevMessage.clientId ?? mapped.clientId ?? mapped.id,
            turnId: prevMessage.turnId ?? mapped.turnId,
            content:
              (prevMessage.content?.length ?? 0) > (mapped.content?.length ?? 0)
                ? prevMessage.content
                : mapped.content,
            isStreaming:
              isThisTurnActive &&
              (rowStatus === "streaming" || rowStatus === "queued"),
            ...(localHasAgentFrames && !mappedHasAgentFrames
              ? {
                  agentMode: prevMessage.agentMode,
                  agentFrameComplete: prevMessage.agentFrameComplete,
                  agentTrace: prevMessage.agentTrace,
                  agentArtifacts: prevMessage.agentArtifacts,
                }
              : {}),
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
      const hydrated = assignLegacyTurnIds(
        overlayBranchMessagesOnPage({
          pageMessages: apiMessages.map(mapApiMessage),
          branchMessages:
            branchMessages ?? branchMessagesByChatRef.current[chatId] ?? null,
        }),
      );
      setAllChats((prev) => {
        const existing = prev[chatId] ?? [];
        // Stale isStreaming alone must NOT count as live — that blocked hydrate
        // and left the orb stuck after reload / aborted turns.
        const isLive =
          isChatActivelyGenerating(chatId) || hasOptimisticTurn(existing);
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
                turnId: local.turnId ?? match.turnId,
              };
            }
            return {
              ...match,
              clientId: local.clientId ?? match.clientId ?? match.id,
              turnId: local.turnId ?? match.turnId,
              attachments: local.attachments ?? match.attachments,
            };
          });
          const existingKeys = new Set(
            merged.flatMap(
              (message) =>
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
                !((remote.agentTrace?.steps.length ?? 0) > 0))
            ) {
              continue;
            }
            // Never prepend/append a contentful assistant ahead of the latest
            // optimistic user — that is the "answer above user chip" bug.
            if (remote.role === "assistant") {
              continue;
            }
            merged.push(remote);
          }
          return { ...prev, [chatId]: merged };
        }
        // Idle hydrate: merge per-message instead of wholesale replacement.
        // The old code swapped the whole list for the server snapshot, which
        // erased locally painted answers whenever the durable row lagged
        // behind (the disappearing-assistant bug right after a turn ends).
        const localById = new Map<string, Message>();
        for (const message of existing) {
          if (message.id) localById.set(message.id, message);
          if (message.clientId) localById.set(message.clientId, message);
        }
        const merged = hydrated.map((remote) => {
          const local =
            (remote.id && localById.get(remote.id)) ??
            (remote.clientId ? localById.get(remote.clientId) : undefined);
          if (!local) return clearIdleStreamingFlags(remote);
          // Local painted content wins when it is at least as rich; otherwise
          // adopt the server row but keep local identity + attachments.
          const localLen = local.content?.trim().length ?? 0;
          const remoteLen = remote.content?.trim().length ?? 0;
          if (
            local.isStreaming ||
            local.isThinkingStreaming ||
            localLen >= remoteLen
          ) {
            return {
              ...local,
              id: remote.id,
              clientId: local.clientId ?? remote.clientId ?? remote.id,
              turnId: local.turnId ?? remote.turnId,
            };
          }
          return clearIdleStreamingFlags({
            ...remote,
            clientId: local.clientId ?? remote.clientId ?? remote.id,
            turnId: local.turnId ?? remote.turnId,
            attachments: local.attachments ?? remote.attachments,
          });
        });
        // Keep any local-only rows the server does not know about yet (e.g. an
        // assistant reply whose finalize commit has not landed).
        const hydratedKeys = new Set(
          merged.flatMap(
            (message) =>
              [message.id, message.clientId].filter(Boolean) as string[],
          ),
        );
        for (const message of existing) {
          if (
            hydratedKeys.has(message.id) ||
            (message.clientId && hydratedKeys.has(message.clientId))
          ) {
            continue;
          }
          merged.push(clearIdleStreamingFlags(message));
        }
        return { ...prev, [chatId]: merged };
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
      const isLive = isChatActivelyGenerating(chatId);
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
        if (isChatActivelyGenerating(chatId)) {
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
        isChatActivelyGenerating(chatId) ||
        hasOptimisticTurn(existingMessages as Message[]);
      const alreadyHydrated = hydratedChatIdsRef.current.has(chatId);

      // Keep optimistic / in-flight turns — never let SSR seed or a fetch
      // wipe a live stream (that remount flicker on send from /new).
      if (hasLocalTurns && (alreadyHydrated || isLive)) {
        takePendingChatRouteSeed(chatId);
        // Idle reopen with a stale isStreaming flag still paints the orb —
        // strip it whenever this tab is not actually generating.
        if (!isChatActivelyGenerating(chatId)) {
          const hasStaleOrb = existingMessages.some(
            (message) =>
              message?.isStreaming === true ||
              message?.isThinkingStreaming === true,
          );
          if (hasStaleOrb) {
            setAllChats((prev) => ({
              ...prev,
              [chatId]: (prev[chatId] ?? []).map(clearIdleStreamingFlags),
            }));
          }
        }
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
        applyHydratedMessages(chatId, ssrSeed.messages, ssrSeed.branchMessages);
        setLoadingChatId((current) => (current === chatId ? null : current));
        // Only silent-reconcile when idle — never during a live send/stream.
        if (!isChatActivelyGenerating(chatId)) {
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

    if (!chatId.startsWith("incognito-")) {
      void fetch(`/api/v1/chats/${chatId}/generate/stop`, {
        method: "POST",
        credentials: "include",
        keepalive: true,
      }).catch(() => {});
    }

    const gen = getGeneration(chatId);
    const assistantId = gen?.assistantMessageId;

    if (gen) {
      gen.request.abort();
      setGeneration(chatId, null);
    }

    useChatStore.getState().setChatGenerating(chatId, false);
    useChatStore.getState().setStreaming(null);

    setAllChats((prev) => {
      const list = prev[chatId] || [];
      return {
        ...prev,
        [chatId]: list.map((message) => {
          const matches =
            message.isStreaming ||
            message.isThinkingStreaming ||
            (assistantId &&
              (message.id === assistantId || message.clientId === assistantId));
          if (!matches) return clearIdleStreamingFlags(message);
          return clearIdleStreamingFlags(
            applyAgentStreamEvent(message, { type: "done" }),
          );
        }),
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
        images?: Array<{ mimeType: string; data: string; name?: string }>;
        userClientId: string;
        assistantClientId: string;
      },
      options?: {
        ephemeral?: boolean;
        vision?: {
          fileIds?: string[];
          images?: Array<{ mimeType: string; data: string; name?: string }>;
        };
      },
    ) => {
      const ephemeral = options?.ephemeral === true;
      const vision = options?.vision;
      const controller = new AbortController();
      const assistantIdLocal =
        overrideAssistantId ?? turn?.assistantClientId ?? randomUUID();
      let assistantId = assistantIdLocal;
      const assistantClientId = assistantIdLocal;
      // Retries / regenerations reuse the existing turn when the client id
      // carries one; otherwise this stream opens its own turn.
      const streamTurnId =
        deriveTurnIdFromClientId(assistantClientId) ??
        deriveTurnIdFromClientId(turn?.userClientId) ??
        createTurnId();
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
      // Use a targeted upsert, never a full-list replace: exporting the whole
      // chat and re-importing it can drop rows whose ids changed via realtime
      // during the await window (the disappearing-previous-answer bug).
      {
        const store = useChatStore.getState();
        const existing = store
          .getMessagesForChat(chatId)
          .find(
            (m) => m.id === assistantId || m.clientId === assistantClientId,
          );
        const turnId =
          existing?.turnId ??
          store
            .getMessagesForChat(chatId)
            .find(
              (m) =>
                turn?.userClientId &&
                (m.id === turn.userClientId ||
                  m.clientId === turn.userClientId),
            )?.turnId ??
          streamTurnId;
        store.upsertMessage(chatId, {
          id: assistantId,
          clientId: assistantClientId,
          turnId,
          role: "assistant",
          content: existing?.content ?? "",
          thinkingContent: existing?.thinkingContent ?? "",
          hasThinking: existing?.hasThinking ?? false,
          createdAt: existing?.createdAt ?? Date.now() + 1,
          isStreaming: true,
          agentMode: existing?.agentMode ?? true,
          agentFrameComplete: false,
          // Forked turns (edit/redo/retry) reach the stream without an
          // optimistic trace — seed one so the Working-for clock is stable
          // from the first paint instead of starting at the `start` event.
          agentTrace: existing?.agentTrace ?? {
            steps: [],
            startedAtMs: existing?.createdAt ?? Date.now(),
          },
        });
      }

      try {
        const generateBody = JSON.stringify({
          messages: conversation,
          homerReasoningEffort,
          chatModel,
          extendedThinking,
          clientTimezone:
            typeof Intl !== "undefined"
              ? Intl.DateTimeFormat().resolvedOptions().timeZone
              : undefined,
          // Keep title generation off the hot response path; it runs after the
          // answer completes so first-token rendering is not blocked.
          generateChatTitle: false,
          ...(!ephemeral && turn
            ? {
                turn: {
                  content: turn.content,
                  modelContent: turn.modelContent,
                  fileIds: turn.fileIds,
                  images: turn.images,
                  userClientId: turn.userClientId,
                  assistantClientId,
                },
              }
            : {}),
          ...(vision && (vision.images?.length || vision.fileIds?.length)
            ? {
                vision: {
                  fileIds: vision.fileIds,
                  images: vision.images,
                },
              }
            : {}),
        });

        // A reload or route swap can forget the local generation map while the
        // server still owns the durable Cloudflare lease. The first 409 saves
        // this turn as queued; wait on the lightweight status route instead of
        // hammering /generate (and its rate limiter) or failing the transcript.
        let response: Response | null = null;
        let lastDetail = "Generation failed";
        const generateUrl = ephemeral
          ? "/api/v1/incognito/generate"
          : `/api/v1/chats/${chatId}/generate`;
        const waitForGenerationSlot = async (): Promise<boolean> => {
          if (ephemeral) return false;
          const deadline = Date.now() + 285_000;
          let statusFailures = 0;
          let pollDelayMs = 150;
          while (Date.now() < deadline) {
            await new Promise((resolve) => setTimeout(resolve, pollDelayMs));
            pollDelayMs = Math.min(1000, Math.round(pollDelayMs * 1.5));
            try {
              const statusResponse = await fetch(`${generateUrl}/status`, {
                method: "GET",
                headers: { Accept: "application/json" },
                credentials: "include",
                cache: "no-store",
                signal: controller.signal,
              });
              if (!statusResponse.ok) {
                statusFailures += 1;
                if (statusFailures >= 8) return true;
                continue;
              }
              const payload = (await statusResponse.json()) as {
                data?: { active?: boolean };
              };
              statusFailures = 0;
              if (!payload.data?.active) return true;
            } catch (error) {
              if (controller.signal.aborted) throw error;
              statusFailures += 1;
              if (statusFailures >= 8) return true;
            }
          }
          return false;
        };

        for (let attempt = 0; attempt < 4; attempt += 1) {
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
          if (attemptResponse.body && !isEventStreamResponse(attemptResponse)) {
            const peek = await attemptResponse.clone().text();
            if (looksLikeSecurityChallenge(attemptResponse, peek)) {
              lastDetail =
                "Security check in progress. Please retry in a moment.";
              if (attempt < 3) {
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
          // A 409 always means the durable lease is still held — never surface
          // that as "Something unexpected happened"; retry on the status route.
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
          if (!leaseBusy || attempt === 3) {
            throw new Error(detail);
          }
          const slotAvailable = await waitForGenerationSlot();
          if (!slotAvailable) {
            throw new Error(
              "The previous reply is taking longer than expected. Your message is saved; please reopen this chat in a moment.",
            );
          }
        }
        if (!response?.ok || !response.body) {
          throw new Error(lastDetail);
        }

        const serverUserId = response.headers.get("X-User-Message-Id");
        if (turn && serverUserId && serverUserId !== turn.userClientId) {
          const store = useChatStore.getState();
          const existing = store
            .getMessagesForChat(chatId)
            .find(
              (message) =>
                message.id === turn.userClientId ||
                message.clientId === turn.userClientId,
            );
          if (existing) {
            store.upsertMessage(chatId, {
              ...existing,
              id: serverUserId,
              clientId: existing.clientId ?? turn.userClientId,
            });
          }
        }

        // Sync optimistic local id → durable DB assistant id (prevents duplicates).
        const serverAssistantId = response.headers.get(
          "X-Assistant-Message-Id",
        );
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
          useChatStore
            .getState()
            .setStreaming({ chatId, messageId: assistantId });
          const store = useChatStore.getState();
          const existing = store
            .getMessagesForChat(chatId)
            .find(
              (message) =>
                message.id === previousId ||
                message.clientId === assistantClientId,
            );
          if (existing) {
            store.upsertMessage(chatId, {
              ...existing,
              id: assistantId,
              clientId: existing.clientId ?? assistantClientId,
              turnId: existing.turnId ?? streamTurnId,
            });
          }
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
          if (getGeneration(chatId)?.request !== controller) return;
          const targetAssistantId = resolveAssistantId();
          if (event.type === "turn_ready") {
            const serverUserId = event.userMessageId;
            if (turn && serverUserId && serverUserId !== turn.userClientId) {
              const store = useChatStore.getState();
              const existingUser = store
                .getMessagesForChat(chatId)
                .find(
                  (message) =>
                    message.id === turn.userClientId ||
                    message.clientId === turn.userClientId,
                );
              if (existingUser) {
                store.upsertMessage(chatId, {
                  ...existingUser,
                  id: serverUserId,
                  clientId: existingUser.clientId ?? turn.userClientId,
                });
              }
            }
            const serverAssistantId = event.assistantMessageId;
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
              useChatStore
                .getState()
                .setStreaming({ chatId, messageId: assistantId });
              const store = useChatStore.getState();
              const existingAsst = store
                .getMessagesForChat(chatId)
                .find(
                  (message) =>
                    message.id === previousId ||
                    message.clientId === assistantClientId,
                );
              if (existingAsst) {
                store.upsertMessage(chatId, {
                  ...existingAsst,
                  id: assistantId,
                  clientId: existingAsst.clientId ?? assistantClientId,
                  turnId: existingAsst.turnId ?? streamTurnId,
                });
              }
            }
            return;
          }
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
              applyAgentStreamEvent(message, event),
            );
            return;
          }
          if (event.type === "error") {
            // Soft-complete when the turn already painted tools/answer —
            // a mid-continue provider blip must not wipe the conversation.
            const existing = (allChatsRef.current[chatId] ?? []).find(
              (m) =>
                m.id === targetAssistantId || m.clientId === assistantClientId,
            );
            if (existing && hasUsefulAssistantProgress(existing)) {
              patchAssistantMessage(chatId, targetAssistantId, (message) => ({
                ...message,
                isStreaming: false,
                isThinkingStreaming: false,
                agentFrameComplete: true,
                generationFailed: false,
              }));
              return;
            }
            throw new Error(event.message || USER_FACING_CHAT_ERROR);
          }
          if (event.type === "tool_end" && event.name === "ask_user_input_v0") {
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

        let paintedFirstContent = false;
        const streamBatcher = createStreamEventBatcher({
          onFlush: (events) => {
            // User stop clears generation before the SSE reader unwinds —
            // drop late batches so the caret cannot resurrect.
            if (getGeneration(chatId)?.request !== controller) return;
            for (const event of events) {
              handleStreamEventImmediate(event);
            }
          },
        });

        const handleStreamEvent = (event: StreamEvent) => {
          if (getGeneration(chatId)?.request !== controller) return;
          const isContentDelta =
            event.type === "answer_delta" ||
            event.type === "narration_delta" ||
            event.type === "thinking_delta" ||
            event.type === "text_delta" ||
            event.type === "tool_output_delta";

          // Paint the first visible chunk immediately for low TTFT. Subsequent
          // deltas are coalesced to one reducer pass per animation frame so a
          // fast provider cannot starve React paint with token-sized commits.
          if (isContentDelta) {
            if (!paintedFirstContent) {
              paintedFirstContent = true;
              streamBatcher.flush();
              handleStreamEventImmediate(event);
            } else {
              streamBatcher.push(event);
            }
            return;
          }

          // Lifecycle events form ordering boundaries: land queued content
          // before a tool/segment changes phase.
          if (
            event.type === "error" ||
            event.type === "done" ||
            event.type === "start" ||
            event.type === "turn_ready" ||
            event.type === "tool_start" ||
            event.type === "tool_end" ||
            event.type === "tool_data" ||
            event.type === "thinking_end" ||
            event.type === "segment_start" ||
            event.type === "segment_end" ||
            event.type === "answer_finalize"
          ) {
            streamBatcher.flush();
            handleStreamEventImmediate(event);
            return;
          }
          streamBatcher.push(event);
        };

        try {
          await streamFromResponse(
            response,
            { onEvent: handleStreamEvent },
            controller.signal,
          );
        } finally {
          if (controller.signal.aborted) {
            streamBatcher.cancel();
          } else {
            streamBatcher.dispose();
          }
        }

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
        {
          const store = useChatStore.getState();
          const existing = store
            .getMessagesForChat(chatId)
            .find(
              (m) =>
                m.id === finalizedAssistantId ||
                m.clientId === assistantClientId,
            );
          if (existing) {
            store.patchMessage(chatId, finalizedAssistantId, (m) => {
              const finalized = resolveFinalStreamedAnswer({
                completedAnswer,
                accumulatorRaw: answerAccumulator?.raw,
                messageContent: m.content,
              });
              const visible = finalized;
              const content = (() => {
                if (visible.trim()) return visible;
                const hasPendingAsk = (m.agentTrace?.steps ?? []).some(
                  (step) =>
                    step.kind === "tool" &&
                    step.name === "ask_user_input_v0" &&
                    step.status === "done",
                );
                if (hasPendingAsk) return "";
                if (hasUsefulAssistantProgress(m)) return m.content ?? "";
                return EMPTY_ASSISTANT_RESPONSE_FALLBACK;
              })();
              const failed = (() => {
                const fin = resolveFinalStreamedAnswer({
                  completedAnswer,
                  accumulatorRaw: answerAccumulator?.raw,
                  messageContent: m.content,
                });
                if (fin.trim()) return false;
                const hasPendingAsk = (m.agentTrace?.steps ?? []).some(
                  (step) =>
                    step.kind === "tool" &&
                    step.name === "ask_user_input_v0" &&
                    step.status === "done",
                );
                if (hasPendingAsk) return false;
                if (hasUsefulAssistantProgress(m)) return false;
                return true;
              })();
              return {
                ...m,
                content,
                isStreaming: false,
                isThinkingStreaming: false,
                agentFrameComplete: true,
                generationFailed: failed,
                thinkingDurationSeconds:
                  m.thinkingDurationSeconds ??
                  (m.thinkingStartedAtMs
                    ? Math.max(
                        1,
                        Math.round((Date.now() - m.thinkingStartedAtMs) / 1000),
                      )
                    : undefined),
              };
            });
          }
        }

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
        const isAbort = error instanceof Error && error.name === "AbortError";
        if (getGeneration(chatId)?.request === controller && !isAbort) {
          const failedAssistantId = resolveAssistantId();
          const rawMessage =
            error instanceof Error ? error.message : String(error ?? "");
          const friendly = toUserFacingChatError(rawMessage);
          const store = useChatStore.getState();
          const existing = store
            .getMessagesForChat(chatId)
            .find(
              (m) =>
                m.id === failedAssistantId || m.clientId === assistantClientId,
            );
          if (existing) {
            store.patchMessage(chatId, failedAssistantId, (m) => {
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
            });
          }
        }
        if (!isAbort) {
          console.error("Chat generation failed:", error);
        }
      } finally {
        // Only clear state if this generation is still the active one.
        if (getGeneration(chatId)?.request === controller) {
          // Seal the finished assistant BEFORE clearing the lease / draining
          // the queue. Otherwise the next optimistic U+A can steal or merge
          // the previous answer (queue flush disappearance bug).
          const store = useChatStore.getState();
          for (const message of store.getMessagesForChat(chatId)) {
            if (
              message.role === "assistant" &&
              (message.isStreaming || message.isThinkingStreaming)
            ) {
              store.upsertMessage(
                chatId,
                sealCompletedAssistantMessages([message])[0]!,
              );
            }
          }
          setGeneration(chatId, null);
          useChatStore.getState().setChatGenerating(chatId, false);
          useChatStore.getState().setStreaming(null);
          const nextQueued = useChatStore.getState().shiftQueuedMessage(chatId);
          if (nextQueued?.content) {
            // Let the sealed transcript commit before painting the next turn.
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
        options?.projectId !== undefined ? options.projectId : projectIdFilter;

      let chatId = options?.chatIdOverride
        ? options.chatIdOverride
        : options?.forceNewChat
          ? null
          : activeChatId;

      // While this chat is generating, new prompts go to the
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
        // Also wait for the server-side DO lease to release. The local
        // controller is gone before the durable lease commits, so a
        // bypassQueue send would 409 → "Something unexpected happened".
        if (!ephemeral) {
          const generateStatusUrl = `/api/v1/chats/${chatId}/generate/status`;
          const serverDeadline = Date.now() + 8_000;
          let serverFailures = 0;
          while (Date.now() < serverDeadline) {
            try {
              const statusResponse = await fetch(generateStatusUrl, {
                method: "GET",
                headers: { Accept: "application/json" },
                credentials: "include",
                cache: "no-store",
              });
              if (statusResponse.ok) {
                serverFailures = 0;
                const payload = (await statusResponse.json()) as {
                  data?: { active?: boolean };
                };
                if (!payload.data?.active) break;
              } else {
                serverFailures += 1;
                if (serverFailures >= 6) break;
              }
            } catch {
              serverFailures += 1;
              if (serverFailures >= 6) break;
            }
            await new Promise((resolve) => setTimeout(resolve, 80));
          }
        }
      }

      const isNewChat = !chatId;
      const existingForStamp = chatId
        ? (allChatsRef.current[chatId] ?? [])
        : [];
      const lastStamp = existingForStamp.reduce((max, message) => {
        const stamp =
          typeof message.createdAt === "number" ? message.createdAt : 0;
        return stamp > max ? stamp : max;
      }, 0);
      // Monotonic stamps so heal sort cannot put the previous assistant after
      // the newly queued user/assistant pair.
      const now = Math.max(Date.now(), lastStamp + 2);
      // One turn id owns this prompt and its reply. Both client ids embed it,
      // so the DB round-trip (realtime / hydrate / reload) restores the pair.
      const turnId = createTurnId();
      const userClientId = userClientIdForTurn(turnId);
      const assistantClientId = assistantClientIdForTurn(turnId);
      const tempUserId = `temp-${userClientId}`;
      const optimisticUser: Message = {
        id: tempUserId,
        clientId: userClientId,
        turnId,
        role: "user",
        content: trimmed,
        createdAt: now,
        attachments:
          !ephemeral && pendingAttachments.length > 0
            ? toMessageAttachments(pendingAttachments)
            : undefined,
      };
      const optimisticAssistant: Message = {
        id: assistantClientId,
        clientId: assistantClientId,
        turnId,
        role: "assistant",
        content: "",
        createdAt: now + 1,
        isStreaming: true,
        agentMode: true,
        agentFrameComplete: false,
        // Seed the trace clock at send time so "Working for Ns" never snaps
        // back when the stream's start event arrives after network RTT.
        agentTrace: { steps: [], startedAtMs: now + 1 },
      };

      // Optimistic pending id — paint chat-view + sidebar immediately.
      // Incognito uses a local session id and never touches Recents.
      let pendingChatId: string | null = null;
      if (!chatId) {
        pendingChatId = ephemeral
          ? `incognito-${randomUUID()}`
          : generateChatId(recentChatsRef.current.map((chat) => chat.id));
        chatId = pendingChatId;
        if (!ephemeral) {
          setCreatingChatPending(true);
        }
        setActiveChatId(pendingChatId);
        useChatStore.getState().setChatGenerating(pendingChatId, true);
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
          [pendingChatId!]: [optimisticUser, optimisticAssistant],
        }));
        hydratedChatIdsRef.current.add(pendingChatId);
      } else {
        // Existing chat — seal any stale live flags on prior turns, then append
        // the new user+assistant pair. Use targeted upserts so we never replace
        // the whole id list (a full-list replace can drop rows whose ids changed
        // via realtime during the await window — the disappearing-answer bug).
        useChatStore.getState().setChatGenerating(chatId, true);
        const store = useChatStore.getState();
        const existing = store.getMessagesForChat(chatId);
        for (const message of existing) {
          if (
            message.role === "assistant" &&
            (message.isStreaming || message.isThinkingStreaming)
          ) {
            store.upsertMessage(
              chatId,
              sealCompletedAssistantMessages([message])[0]!,
            );
          }
        }
        store.upsertMessage(chatId, optimisticUser);
        store.upsertMessage(chatId, optimisticAssistant);
        // Touch Recents so this chat stays at the top.
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
          // Open the chat URL immediately — persist the row in the background.
          try {
            options?.onChatCreated?.(pendingChatId);
          } catch {
            // Navigation callbacks must not abort the send path.
          }

          const { chat } = await chatsApi.createChat({
            id: pendingChatId,
            title: "New chat",
            projectId: bindProjectId ?? undefined,
          });
          const realId = chat.id;

          if (realId !== pendingChatId) {
            const pendingGen = getGeneration(pendingChatId);
            if (pendingGen) {
              setGeneration(pendingChatId, null);
              setGeneration(realId, pendingGen);
            }
            useChatStore.getState().migrateChatId(pendingChatId, realId);
            hydratedChatIdsRef.current.delete(pendingChatId);
            hydratedChatIdsRef.current.add(realId);
            chatId = realId;
            useChatStore.getState().setChatGenerating(realId, true);
            try {
              options?.onChatCreated?.(realId);
            } catch {
              /* keep the live turn even if a second navigate fails */
            }
          }

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
          setCreatingChatPending(false);
          useChatStore.getState().setChatGenerating(realId, true);
        } else if (pendingChatId && ephemeral) {
          useChatStore.getState().setChatGenerating(pendingChatId, true);
        }

        // Upload attachments before generate when images need durable fileIds,
        // but always read image bytes locally for Novita/Kimi vision (base64).
        const knownFileIds = pendingAttachments
          .map((item) => item.fileId)
          .filter((id): id is string => Boolean(id));
        const fileIds: string[] = [...knownFileIds];
        let uploadFailures = 0;
        const { images: visionImages } =
          await collectComposerVision(pendingAttachments);

        const uploadAttachments = async () => {
          if (ephemeral || pendingAttachments.length === 0) return;
          const uploaded = await Promise.all(
            pendingAttachments.map(async (attachment) => {
              if (attachment.fileId) return attachment.fileId;
              if (!attachment.file) return null;
              try {
                return await uploadUserFile(attachment.file, {
                  purpose: "chat-attachment",
                  chatId,
                });
              } catch (error) {
                console.warn("[chat] attachment upload failed:", error);
                uploadFailures += 1;
                return null;
              }
            }),
          );
          for (const id of uploaded) {
            if (id && !fileIds.includes(id)) fileIds.push(id);
          }

          setAllChats((prev) => {
            const list = prev[chatId!] ?? [];
            const index = list.findIndex(
              (message) => message.id === tempUserId,
            );
            if (index < 0) return prev;
            const next = [...list];
            const current = next[index]!;
            next[index] = {
              ...current,
              attachments: (current.attachments ?? []).map((item, i) => ({
                ...item,
                fileId: uploaded[i] ?? item.fileId,
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
        };

        // Await uploads when we have files (images need durable ids for history;
        // vision still uses local base64 so the model does not wait on R2).
        if (
          !ephemeral &&
          pendingAttachments.some((item) => item.file && !item.fileId)
        ) {
          await uploadAttachments();
        } else {
          void uploadAttachments();
        }

        const attachmentContext = attachmentContextLines(pendingAttachments);

        const modelUserContent = `${trimmed}${attachmentContext}`.trim();
        const modelUser: Message = {
          ...optimisticUser,
          content: modelUserContent || trimmed || "(attached files)",
        };

        const priorMessages = (allChatsRef.current[chatId!] ?? []).filter(
          (message) =>
            message.id !== tempUserId &&
            message.id !== assistantClientId &&
            message.clientId !== assistantClientId,
        );
        const conversation = buildConversation([...priorMessages, modelUser]);

        // One server-owned turn creates the durable user and assistant rows in
        // a transaction. Sending their stable client ids makes browser retries
        // idempotent without racing a separate /messages request.
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
                images: visionImages.length ? visionImages : undefined,
                // Persist the turn-encoded client ids so DB rows can rebuild
                // the exact user↔assistant pairing on any later read.
                userClientId,
                assistantClientId,
              },
          {
            ephemeral,
            vision:
              ephemeral && visionImages.length
                ? { images: visionImages }
                : undefined,
          },
        );

        if (pendingChatId && !ephemeral) {
          try {
            options?.onChatCreated?.(chatId!);
          } catch {
            // Safety net if the early navigate was skipped.
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
          useChatStore.getState().setChatGenerating(pendingChatId, false);
          useChatStore.getState().removeChat(pendingChatId);
          if (useChatStore.getState().activeChatId === pendingChatId) {
            setActiveChatId(null);
          }
          hydratedChatIdsRef.current.delete(pendingChatId);
        } else if (chatId) {
          // Roll back the optimistic follow-up turn and drop the idle orb.
          const failedChatId = chatId;
          useChatStore.getState().setChatGenerating(failedChatId, false);
          useChatStore.getState().setStreaming(null);
          setAllChats((prev) => ({
            ...prev,
            [failedChatId]: (prev[failedChatId] ?? []).filter(
              (message) =>
                message.id !== tempUserId &&
                message.id !== assistantClientId &&
                message.clientId !== assistantClientId,
            ),
          }));
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

      // Optimistic: remove from sidebar / local state immediately, persist later.
      const previousRecent = recentChatsRef.current;
      const previousMessages = allChatsRef.current[chatId];
      const wasActive = activeChatId === chatId;

      pendingDeletedChatIdsRef.current.add(chatId);

      setAllChats((prev) => {
        const next = { ...prev };
        delete next[chatId];
        return next;
      });
      useChatStore.getState().removeChat(chatId);
      hydratedChatIdsRef.current.delete(chatId);
      void forgetDeviceChat(chatId);
      const remaining = previousRecent.filter((c) => c.id !== chatId);
      setRecentChats(remaining);
      recentChatsRef.current = remaining;
      if (wasActive) {
        setActiveChatId(null);
      }
      if (userId) {
        writeSyncDeviceChatList(userId, remaining);
        void persistDeviceRecentChatsNow(
          userId,
          remaining,
          wasActive ? null : useChatStore.getState().activeChatId,
        );
      }

      try {
        await chatsApi.deleteChat(chatId);
        // Refresh in the background without resurrecting this id.
        void refreshChats({ silent: true });
      } catch (error) {
        console.error("Failed to delete chat:", error);
        // Roll back sidebar + messages so the user can retry.
        pendingDeletedChatIdsRef.current.delete(chatId);
        setRecentChats(previousRecent);
        recentChatsRef.current = previousRecent;
        if (previousMessages) {
          setAllChats((prev) => ({
            ...prev,
            [chatId]: previousMessages,
          }));
        }
        if (wasActive) {
          setActiveChatId(chatId);
        }
        if (userId) {
          writeSyncDeviceChatList(userId, previousRecent);
          void persistDeviceRecentChatsNow(
            userId,
            previousRecent,
            wasActive ? chatId : useChatStore.getState().activeChatId,
          );
        }
      }
    },
    [activeChatId, refreshChats, userId],
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
            ? {
                ...c,
                name: title,
                titleGenerated: true,
                isTitleStreaming: false,
              }
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

      void (
        pinned ? chatsApi.pinChat(chatId) : chatsApi.unpinChat(chatId)
      ).catch((error) => {
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
      });
    },
    [userId],
  );

  const handleMoveChatToProject = useCallback(
    async (chatId: string, projectId: string | null) => {
      const previous =
        recentChatsRef.current.find((chat) => chat.id === chatId)?.projectId ??
        null;
      setRecentChats((prev) => {
        const next = prev.map((chat) =>
          chat.id === chatId ? { ...chat, projectId } : chat,
        );
        recentChatsRef.current = next;
        return next;
      });
      if (userId) {
        writeSyncDeviceChatList(userId, recentChatsRef.current);
        void persistDeviceRecentChatsNow(
          userId,
          recentChatsRef.current,
          useChatStore.getState().activeChatId,
        );
      }
      try {
        await chatsApi.updateChat(chatId, { projectId });
      } catch (error) {
        console.error("Failed to move chat to project:", error);
        setRecentChats((prev) => {
          const next = prev.map((chat) =>
            chat.id === chatId ? { ...chat, projectId: previous } : chat,
          );
          recentChatsRef.current = next;
          return next;
        });
      }
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
      if (!trimmed && pendingAttachments.length === 0) return;

      // Forking wins over any in-flight stream: cancel first so the previous
      // branch hides immediately instead of waiting for the old stream.
      abortInFlightGenerationForBranch(chatId);

      const assistantMessageId = randomUUID();
      // Optimistic fork with local attachments FIRST — the previous branch
      // (old answer + follow-ups) hides in the same synchronous paint that
      // shows the edited prompt + streaming placeholder. Uploads resolve
      // afterwards and only patch attachment metadata.
      const optimisticAttachments = toMessageAttachments(pendingAttachments);
      const baseExisting = allChatsRef.current[chatId] || [];

      let helperResult;
      try {
        helperResult = editMessageWithBranchHelper(
          baseExisting,
          messageId,
          trimmed,
          assistantMessageId,
          optimisticAttachments,
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

      // Upload new local files in the background; keep existing fileIds.
      const uploadedAttachments: ComposerAttachment[] = await Promise.all(
        pendingAttachments.map(async (attachment) => {
          if (attachment.fileId || !attachment.file) return attachment;
          try {
            const fileId = await uploadUserFile(attachment.file, {
              purpose: "chat-attachment",
              chatId,
            });
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
      const { images: visionImages, fileIds: visionFileIds } =
        await collectComposerVision(uploadedAttachments);
      const attachmentContext = attachmentContextLines(uploadedAttachments);

      // Patch the forked user message if uploads resolved new fileIds after
      // the optimistic paint (keeps the visible branch + metadata in sync).
      if (uploadedAttachments.length > 0) {
        setAllChats((prev) => {
          const list = prev[chatId];
          if (!list?.length) return prev;
          return {
            ...prev,
            [chatId]: list.map((msg) => {
              if (msg.id !== messageId) return msg;
              const versions = msg.branchVersions;
              if (!versions?.length) {
                return { ...msg, attachments: messageAttachments };
              }
              const active =
                msg.activeBranchIndex ?? versions.length - 1;
              const nextVersions = [...versions];
              nextVersions[active] = {
                ...nextVersions[active],
                attachments: messageAttachments,
              };
              return {
                ...msg,
                attachments: messageAttachments,
                branchVersions: nextVersions,
              };
            }),
          };
        });
      }

      const conversationBase = nextChat.slice(0, -1).map((msg) =>
        msg.id === messageId
          ? {
              ...msg,
              content:
                `${trimmed}${attachmentContext}`.trim() ||
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
          undefined,
          {
            vision:
              visionImages.length || visionFileIds.length
                ? {
                    images: visionImages.length ? visionImages : undefined,
                    fileIds: visionFileIds.length ? visionFileIds : undefined,
                  }
                : undefined,
          },
        );
      } finally {
        const finalMessages = allChatsRef.current[chatId] || [];
        setAllChats((prev) => ({
          ...prev,
          // Settle the streamed answer into its active version first so a
          // later retry regenerates from real content, then stamp the
          // post-stream thread on the edited version.
          [chatId]: attachSnapshotToBranchVersion(
            syncMessageActiveVersion(finalMessages, assistantMessageId),
            messageId,
          ),
        }));
        scheduleBranchPersist(chatId);
      }
    },
    [streamAssistantResponse, scheduleBranchPersist],
  );

  const redoUserMessageWithBranch = useCallback(
    async (chatId: string, messageId: string) => {
      abortInFlightGenerationForBranch(chatId);
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
          [chatId]: attachSnapshotToBranchVersion(
            syncMessageActiveVersion(finalMessages, assistantMessageId),
            messageId,
          ),
        }));
        scheduleBranchPersist(chatId);
      }
    },
    [streamAssistantResponse, scheduleBranchPersist],
  );

  const retryAssistantWithBranch = useCallback(
    async (chatId: string, assistantMessageId: string) => {
      abortInFlightGenerationForBranch(chatId);
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
          // The regenerated answer streams into a fresh empty version —
          // settle the final text into it before stamping the snapshot.
          [chatId]: attachSnapshotToBranchVersion(
            syncMessageActiveVersion(finalMessages, assistantMessageId),
            assistantMessageId,
          ),
        }));
        scheduleBranchPersist(chatId);
      }
    },
    [streamAssistantResponse, scheduleBranchPersist],
  );

  const switchMessageBranch = useCallback(
    (chatId: string, messageId: string, direction: "prev" | "next") => {
      // Never switch mid-stream: the streaming turn owns the tail of the
      // thread and a restore/truncate underneath it corrupts both.
      if (isGenerating) return;
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
    [isGenerating, persistBranches],
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
    handleMoveChatToProject,
    editMessageWithBranch,
    redoUserMessageWithBranch,
    retryAssistantWithBranch,
    switchMessageBranch,
    refreshChats,
  };
}
