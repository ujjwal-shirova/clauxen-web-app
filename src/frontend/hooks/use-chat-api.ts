"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import type { StreamEvent } from "@/frontend/lib/chat-stream";
import { applyAgentStreamEvent } from "@/frontend/lib/agent-stream-reducer";
import { sanitizeAssistantStreamDelta } from "@/lib/assistant-output-sanitize";
import {
  canFastAppendAnswer,
  patchToolOutputDelta,
} from "@/frontend/lib/agent-stream-fast-path";
import { agentAnswerDuplicatesInterim } from "@/frontend/lib/agent-frames";
import { createStreamEventBatcher } from "@/frontend/lib/stream-event-batcher";
import type { Message, RecentChat } from "@/frontend/lib/types";
import { useAiStream } from "@/frontend/hooks/use-ai-stream";
import {
  getAllChatsNormalized,
  patchAssistantMessage,
  setAllChatsNormalized,
} from "@/frontend/lib/chat-store-bridge";
import {
  useActiveChatMessages,
  useActiveChatId,
  setActiveChatId,
  useChatStore,
} from "@/frontend/stores/chat-store";
import * as chatsApi from "@/frontend/lib/api/chats";
import { uploadUserFile } from "@/frontend/lib/api/files";
import {
  toMessageAttachments,
  type ComposerAttachment,
} from "@/frontend/lib/composer-attachments";
import { createClient } from "@/utils/supabase/client";
import { randomUUID } from "@/frontend/lib/id";
import {
  attachSnapshotToBranchVersion,
  compactMessageBranchData,
  editMessageWithBranchHelper,
  redoUserMessageWithBranchHelper,
  retryAssistantWithBranchHelper,
  switchMessageBranchHelper,
} from "@/frontend/lib/chat-branch";
import { buildChatConversation } from "@/frontend/lib/branch-conversation";
import {
  appendChatTitleAnswerDelta,
  createChatTitleAnswerAccumulator,
  CHAT_TITLE_STREAM_CHAR_MS,
  CHAT_TITLE_STREAM_CHUNK,
  deriveTitleFromExchange,
  extractChatTitleFromText,
  finalizeChatTitleStrippedAnswer,
  normalizeChatTitle,
  stripTitleSourceText,
} from "@/lib/chat-title";
import { DEFAULT_CHAT_MODEL_ID, type ChatModelId } from "@/lib/chat-models";
import {
  DEFAULT_HOMER_REASONING_EFFORT,
  type HomerReasoningEffort,
} from "@/lib/model-effort";
import { filterStartedRecentChats } from "@/frontend/lib/started-recent-chats";
import {
  hydrateMessageFromContentJson,
  overlayBranchMessagesOnPage,
} from "@/frontend/lib/hydrate-chat-messages";
import { takePendingChatRouteSeed } from "@/frontend/lib/chat-route-seed";
import { useShallow } from "zustand/react/shallow";

function mapApiMessage(row: chatsApi.ApiMessage): Message {
  const meta = row.metadata as {
    thinkingContent?: string;
    hasThinking?: boolean;
    thinkingDurationSeconds?: number;
    branchVersions?: Message["branchVersions"];
    activeBranchIndex?: number;
    attachments?: Message["attachments"];
  };
  const base = compactMessageBranchData({
    id: row.id,
    role: row.role as Message["role"],
    content: finalizeChatTitleStrippedAnswer(row.content),
    thinkingContent: meta.thinkingContent,
    hasThinking: meta.hasThinking,
    thinkingDurationSeconds: meta.thinkingDurationSeconds,
    branchVersions: meta.branchVersions,
    activeBranchIndex: meta.activeBranchIndex,
    attachments: Array.isArray(meta.attachments)
      ? meta.attachments
      : undefined,
    createdAt: row.created_at
      ? new Date(row.created_at).getTime()
      : undefined,
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
) {
  const { streamFromResponse } = useAiStream();
  const setAllChats = setAllChatsNormalized;
  const [recentChats, setRecentChats] = useState<RecentChat[]>([]);
  const activeChatId = useActiveChatId();
  const isGenerating = useChatStore((state) => state.isGenerating);
  const setIsGenerating = useCallback((value: boolean) => {
    useChatStore.getState().setIsGenerating(value);
  }, []);
  const [loading, setLoading] = useState(true);
  const [creatingChatPending, setCreatingChatPending] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const chatsLoadedOnceRef = useRef(false);
  const allChatsRef = useRef<Record<string, Message[]>>({});
  const recentChatsRef = useRef<RecentChat[]>([]);
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
        await chatsApi.saveBranchState(chatId, [], chatMessages);
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
    const silent = opts?.silent === true && chatsLoadedOnceRef.current;
    if (!silent) setLoading(true);
    try {
      const { chats } = await chatsApi.listChats(projectIdFilter ?? undefined);
      const nextChats = chats.map((c) => ({
        id: c.id,
        name: c.name,
        titleGenerated: c.name.toLowerCase() !== "new chat",
        projectId: c.projectId,
        pinned: Boolean(c.pinned),
        updatedAt: new Date(c.updatedAt).getTime(),
      }));
      recentChatsRef.current = nextChats;
      setRecentChats(nextChats);
    } catch (error) {
      // Challenge HTML / transient network — keep existing sidebar list.
      console.warn("[chats] list failed (soft):", error);
    } finally {
      chatsLoadedOnceRef.current = true;
      setLoading(false);
    }
  }, [projectIdFilter]);

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
    // Defer sidebar list so the composer paints first.
    const t = window.setTimeout(() => {
      void refreshChats();
    }, 0);
    return () => window.clearTimeout(t);
  }, [refreshChats]);

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
      .subscribe();

    return () => {
      window.clearTimeout(debounceTimer);
      void supabase.removeChannel(channel);
    };
  }, [projectIdFilter, refreshChats]);

  // Live message inserts/updates for the open chat (other devices / tabs).
  useEffect(() => {
    if (!activeChatId) return;
    const supabase = createClient();
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
            if (existing.some((message) => message.id === mapped.id)) {
              return prev;
            }

            // While this tab is streaming, reconcile the DB assistant row with
            // the optimistic local assistant instead of appending a duplicate.
            const gen = getGeneration(activeChatId);
            if (mapped.role === "assistant" && gen?.assistantMessageId) {
              const localIndex = existing.findIndex(
                (message) => message.id === gen.assistantMessageId,
              );
              if (localIndex >= 0) {
                const local = existing[localIndex]!;
                const next = [...existing];
                next[localIndex] = {
                  ...local,
                  id: mapped.id,
                  isStreaming: local.isStreaming || mapped.isStreaming,
                };
                setGeneration(activeChatId, {
                  request: gen.request,
                  assistantMessageId: mapped.id,
                });
                return { ...prev, [activeChatId]: next };
              }
              // Local stream already owns this turn — ignore sparse DB insert.
              return prev;
            }

            // Same for optimistic user rows (temp id → server id).
            if (mapped.role === "user") {
              const tempIndex = existing.findIndex(
                (message) =>
                  message.role === "user" &&
                  message.id.startsWith("temp-") &&
                  message.content === mapped.content,
              );
              if (tempIndex >= 0) {
                const next = [...existing];
                next[tempIndex] = {
                  ...next[tempIndex]!,
                  ...mapped,
                  id: mapped.id,
                };
                return { ...prev, [activeChatId]: next };
              }
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
          const rowStatus = row.status;
          setAllChats((prev) => {
            const existing = prev[activeChatId] ?? [];
            const index = existing.findIndex((message) => message.id === mapped.id);
            if (index < 0) {
              return {
                ...prev,
                [activeChatId]: [...existing, mapped],
              };
            }
            const next = [...existing];
            const prevMessage = next[index]!;
            // Don't clobber an in-progress local stream with a sparse DB row.
            if (prevMessage.isStreaming && rowStatus === "streaming") {
              return prev;
            }
            next[index] = {
              ...prevMessage,
              ...mapped,
              isStreaming: rowStatus === "streaming",
            };
            return { ...prev, [activeChatId]: next };
          });
        },
      )
      .subscribe();

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
      setAllChats((prev) => ({
        ...prev,
        [chatId]: hydrated,
      }));
      hydratedChatIdsRef.current.add(chatId);
    },
    [],
  );

  const loadChatMessages = useCallback(
    async (chatId: string) => {
      setMessagesLoading(true);
      try {
        const [bundle, branch] = await Promise.all([
          chatsApi.listAllChatMessages(chatId),
          chatsApi.getBranchState(chatId).catch(() => null),
        ]);
        const row = branch?.state as { messages?: unknown } | null;
        applyHydratedMessages(chatId, bundle.messages, row?.messages ?? null);
      } finally {
        setMessagesLoading(false);
      }
    },
    [applyHydratedMessages],
  );

  const handleSelectChat = useCallback(
    async (chatId: string | null) => {
      if (!chatId) {
        setActiveChatId(null);
        useChatStore.getState().clearInactiveChatMessages(null);
        setMessagesLoading(false);
        return;
      }
      const previousChatId = useChatStore.getState().activeChatId;
      setActiveChatId(chatId);
      // Keep the previous chat warm for back-nav; drop everything else.
      useChatStore
        .getState()
        .clearInactiveChatMessages(chatId, { alsoKeep: previousChatId });

      const ssrSeed = takePendingChatRouteSeed(chatId);
      if (ssrSeed) {
        applyHydratedMessages(
          chatId,
          ssrSeed.messages,
          ssrSeed.branchMessages,
        );
        setMessagesLoading(false);
        return;
      }

      const existing = useChatStore.getState().messageIdsByChatId[chatId];
      const isLive =
        Boolean(useChatStore.getState().generatingChatIds[chatId]) ||
        Boolean(getGeneration(chatId));
      const alreadyHydrated = hydratedChatIdsRef.current.has(chatId);

      // Keep optimistic / in-flight turns — don't replace with a stale fetch.
      if (existing && existing.length > 0 && (alreadyHydrated || isLive)) {
        setMessagesLoading(false);
        return;
      }

      // Warm RAM hit after back-nav — paint immediately.
      if (existing && existing.length > 0) {
        hydratedChatIdsRef.current.add(chatId);
        setMessagesLoading(false);
        return;
      }

      await loadChatMessages(chatId);
    },
    [applyHydratedMessages, loadChatMessages],
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
    void fetch(`/api/v1/chats/${chatId}/generate/stop`, {
      method: "POST",
      credentials: "include",
    }).catch(() => {});

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
    ) => {
      const title = normalizeChatTitle(nextTitle, exchange);

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

      try {
        await chatsApi.updateChat(chatId, { title });
      } catch (error) {
        console.error("Failed to persist chat title:", error);
      }
    },
    [],
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
        const titleMessages = [
          { role: "user", content: userContentForTitle },
          ...(assistantContentForTitle
            ? [{ role: "assistant", content: assistantContentForTitle }]
            : []),
        ];
        const { title } = await chatsApi.generateChatTitle(chatId, titleMessages);
        await streamChatTitle(chatId, title, exchange);
      } catch {
        await streamChatTitle(chatId, fallbackTitle, exchange);
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
    ) => {
      const controller = new AbortController();
      const assistantIdLocal = overrideAssistantId ?? randomUUID();
      let assistantId = assistantIdLocal;
      setGeneration(chatId, {
        request: controller,
        assistantMessageId: assistantId,
      });
      useChatStore.getState().setChatGenerating(chatId, true);
      useChatStore.getState().setStreaming({ chatId, messageId: assistantId });

      // Optimistic assistant placeholder — visible immediately with fade-in
      // while the generate request is in flight (cuts perceived TTFT).
      setAllChats((prev) => {
        const current = prev[chatId] ?? [];
        const exists = current.some((m) => m.id === assistantId);
        if (exists) {
          return {
            ...prev,
            [chatId]: current.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    isStreaming: true,
                    content: "",
                    thinkingContent: "",
                    hasThinking: false,
                    agentMode: false,
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
        const response = await fetch(`/api/v1/chats/${chatId}/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            messages: conversation,
            homerReasoningEffort,
            chatModel,
            // Keep title generation off the hot response path; it runs after the
            // answer completes so first-token rendering is not blocked.
            generateChatTitle: false,
          }),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          let detail = `Generation failed (${response.status})`;
          try {
            const payload = (await response.json()) as {
              error?: string | { message?: string };
              message?: string;
            };
            const fromError =
              typeof payload.error === "string"
                ? payload.error
                : payload.error?.message;
            detail = fromError || payload.message || detail;
          } catch {
            // ignore parse errors
          }
          throw new Error(detail);
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
            const index = list.findIndex((message) => message.id === previousId);
            if (index < 0) return prev;
            const next = [...list];
            next[index] = { ...next[index]!, id: assistantId };
            return { ...prev, [chatId]: next };
          });
        }

        let completedAnswer = "";
        const answerAccumulator = titleUserContent
          ? createChatTitleAnswerAccumulator()
          : null;

        const applyInlineChatTitle = async (_rawTitle: string) => {
          // Sidebar titles are generated after the first assistant response completes.
        };

        const handleStreamEventImmediate = (event: StreamEvent) => {
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

            const msg = useChatStore.getState().messagesById[assistantId];
            if (canFastAppendAnswer(msg)) {
              useChatStore
                .getState()
                .appendMessageField(chatId, assistantId, "content", visibleDelta);
            } else {
              patchAssistantMessage(chatId, assistantId, (message) =>
                applyAgentStreamEvent(message, {
                  ...event,
                  delta: visibleDelta,
                }),
              );
            }
            return;
          }
          if (event.type === "tool_output_delta") {
            patchAssistantMessage(chatId, assistantId, (message) =>
              patchToolOutputDelta(message, event),
            );
            return;
          }
          if (event.type === "error") {
            throw new Error(event.message);
          }
          patchAssistantMessage(chatId, assistantId, (message) =>
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
          if (event.type === "error" || event.type === "done") {
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
          completedAnswer = finalized;
          const extractedTitle = extractChatTitleFromText(
            answerAccumulator.raw,
          );
          if (extractedTitle) {
            void applyInlineChatTitle(extractedTitle);
          }
          patchAssistantMessage(chatId, assistantId, (message) => ({
            ...message,
            content: finalized,
          }));
        }

        if (getGeneration(chatId)?.request !== controller) return;

        setAllChats((prev) => ({
          ...prev,
          [chatId]: (prev[chatId] ?? []).map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: (() => {
                    const finalized = answerAccumulator
                      ? finalizeChatTitleStrippedAnswer(answerAccumulator.raw)
                      : finalizeChatTitleStrippedAnswer(m.content);
                    return agentAnswerDuplicatesInterim({
                      ...m,
                      content: finalized,
                    })
                      ? m.content
                      : finalized;
                  })(),
                  isStreaming: false,
                }
              : m,
          ),
        }));

        scheduleBranchPersist(chatId);
        if (titleUserContent && completedAnswer.trim()) {
          void maybeGenerateChatTitle(chatId, {
            userContent: titleUserContent,
            assistantContent: completedAnswer,
          });
        }
      } catch (error) {
        // Aborts come from stopGeneration, which already finalized the
        // assistant message and cleared generation state.
        const isAbort =
          error instanceof Error && error.name === "AbortError";
        if (getGeneration(chatId)?.request === controller && !isAbort) {
          setAllChats((prev) => ({
            ...prev,
            [chatId]: (prev[chatId] ?? []).map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    isStreaming: false,
                    content:
                      m.content ||
                      (error instanceof Error
                        ? `Generation failed: ${error.message}`
                        : "Generation failed."),
                  }
                : m,
            ),
          }));
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
      },
    ): Promise<string | null> => {
      const trimmed = prompt.trim();
      const pendingAttachments = options?.attachments ?? [];
      if (!trimmed && pendingAttachments.length === 0) return null;
      if (creatingChatPending && !options?.chatIdOverride) return null;

      let chatId = options?.chatIdOverride
        ? options.chatIdOverride
        : options?.forceNewChat
          ? null
          : activeChatId;

      // Queue when this chat is already generating (unless flushing the queue).
      // Attachment-only sends cannot be queued yet — require an idle chat.
      if (
        chatId &&
        !options?.bypassQueue &&
        useChatStore.getState().generatingChatIds[chatId]
      ) {
        if (!trimmed) return null;
        useChatStore.getState().enqueueQueuedMessage(chatId, trimmed);
        return chatId;
      }

      const isNewChat = !chatId;
      const tempUserId = `temp-${randomUUID()}`;
      const optimisticUser: Message = {
        id: tempUserId,
        role: "user",
        content: trimmed,
        attachments:
          pendingAttachments.length > 0
            ? toMessageAttachments(pendingAttachments)
            : undefined,
      };

      if (!chatId) {
        setCreatingChatPending(true);
      }

      try {
        if (!chatId) {
          const { chat } = await chatsApi.createChat({
            title: "New chat",
            projectId: projectIdFilter ?? undefined,
          });
          chatId = chat.id;
          // Paint chat-view immediately: set id + user bubble before generate.
          setActiveChatId(chatId);
          setRecentChats((prev) => {
            const next = [
              {
                id: chat.id,
                name: chat.title || "New chat",
                titleGenerated: false,
                projectId: projectIdFilter ?? undefined,
                updatedAt: Date.now(),
              },
              ...prev.filter((c) => c.id !== chat.id),
            ];
            recentChatsRef.current = next;
            return next;
          });
          setAllChats((prev) => ({
            ...prev,
            [chatId!]: [optimisticUser],
          }));
          hydratedChatIdsRef.current.add(chatId!);
        } else {
          // Existing chat — paint the user bubble immediately (before network).
          setAllChats((prev) => ({
            ...prev,
            [chatId!]: [...(prev[chatId!] ?? []), optimisticUser],
          }));
        }

        // Upload attachments in parallel; failures mark chips but still stream text.
        const fileIds: string[] = [];
        let uploadFailures = 0;
        if (pendingAttachments.length > 0) {
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

        useChatStore.getState().setChatGenerating(chatId!, true);
        void streamAssistantResponse(
          chatId!,
          conversation,
          isNewChat ? trimmed || "New chat" : undefined,
        );

        // Persist user message without blocking the bubble / stream start.
        void chatsApi
          .appendMessage(chatId!, trimmed || "(attached files)", {
            fileIds: fileIds.length ? fileIds : undefined,
          })
          .then(({ message: saved }) => {
            const real = mapApiMessage(saved);
            setAllChats((prev) => {
              const list = prev[chatId!] ?? [];
              const index = list.findIndex((message) => message.id === tempUserId);
              if (index < 0) {
                if (list.some((message) => message.id === real.id)) return prev;
                return {
                  ...prev,
                  [chatId!]: [
                    ...list,
                    {
                      ...real,
                      attachments: optimisticUser.attachments,
                    },
                  ],
                };
              }
              const next = [...list];
              next[index] = {
                ...next[index]!,
                ...real,
                id: real.id,
                attachments: next[index]!.attachments ?? optimisticUser.attachments,
              };
              return { ...prev, [chatId!]: next };
            });
          })
          .catch((error) => {
            console.warn("[chat] appendMessage failed:", error);
          });

        return chatId;
      } finally {
        if (isNewChat) setCreatingChatPending(false);
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
      await chatsApi.updateChat(chatId, { title });
      setRecentChats((prev) =>
        prev.map((c) =>
          c.id === chatId ? { ...c, name: title, titleGenerated: true } : c,
        ),
      );
    },
    [],
  );

  const handlePinChat = useCallback(async (chatId: string, pinned: boolean) => {
    const prevChats = recentChatsRef.current;
    setRecentChats((prev) =>
      prev.map((chat) => (chat.id === chatId ? { ...chat, pinned } : chat)),
    );
    try {
      if (pinned) {
        await chatsApi.pinChat(chatId);
      } else {
        await chatsApi.unpinChat(chatId);
      }
    } catch (error) {
      console.error("Failed to persist chat pin:", error);
      setRecentChats(prevChats);
    }
  }, []);

  const editMessageWithBranch = useCallback(
    async (chatId: string, messageId: string, newContent: string) => {
      const trimmed = newContent.trim();
      if (!trimmed || isGenerating) return;

      const existing = allChatsRef.current[chatId] || [];
      const assistantMessageId = randomUUID();

      let helperResult;
      try {
        helperResult = editMessageWithBranchHelper(
          existing,
          messageId,
          trimmed,
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
