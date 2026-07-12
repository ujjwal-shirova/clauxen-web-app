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
import { useShallow } from "zustand/react/shallow";

type ChatHistoryCursor = {
  id: string;
  createdAt: string;
};

type ChatHistoryPageState = {
  hasMore: boolean;
  nextCursor: ChatHistoryCursor | null;
  isLoadingOlder: boolean;
};

function mapApiMessage(row: chatsApi.ApiMessage): Message {
  const meta = row.metadata as {
    thinkingContent?: string;
    hasThinking?: boolean;
    thinkingDurationSeconds?: number;
    branchVersions?: Message["branchVersions"];
    activeBranchIndex?: number;
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

// Module-level shared generation state so an in-flight stream survives route
// changes (e.g. project home -> conversation view). The stream patches the
// global chat store; the active controller/context live here so the next
// mounted useChatApi instance can still stop or finalize the generation.
const sharedApiGeneration = {
  request: null as AbortController | null,
  context: null as { chatId: string; assistantMessageId: string } | null,
};

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
  const [historyByChatId, setHistoryByChatId] = useState<
    Record<string, ChatHistoryPageState>
  >({});
  const chatsLoadedOnceRef = useRef(false);
  const allChatsRef = useRef<Record<string, Message[]>>({});
  const recentChatsRef = useRef<RecentChat[]>([]);
  const branchPersistRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const historyByChatIdRef = useRef(historyByChatId);
  historyByChatIdRef.current = historyByChatId;
  const titleGenerationInProgressRef = useRef<Set<string>>(new Set());

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
    const channel = supabase
      .channel(`chats-sidebar:${projectIdFilter ?? "all"}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chats",
        },
        () => {
          void refreshChats({ silent: true });
        },
      )
      .subscribe();

    return () => {
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

  const loadChatMessages = useCallback(async (chatId: string) => {
    setMessagesLoading(true);
    try {
      const page = await chatsApi.listMessagesPage(chatId, { limit: 20 });
      const apiMessages = page.messages.map(mapApiMessage);
      let branchMessages: unknown = null;
      try {
        const branch = await chatsApi.getBranchState(chatId);
        const row = branch.state as { messages?: unknown } | null;
        branchMessages = row?.messages ?? null;
      } catch {
        // No branch state yet.
      }
      const hydrated = overlayBranchMessagesOnPage({
        pageMessages: apiMessages,
        branchMessages,
      });
      setAllChats((prev) => ({
        ...prev,
        [chatId]: hydrated,
      }));
      setHistoryByChatId((prev) => ({
        ...prev,
        [chatId]: {
          hasMore: Boolean(page.hasMore),
          nextCursor: page.nextCursor,
          isLoadingOlder: false,
        },
      }));
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  const loadOlderMessages = useCallback(async (chatId: string) => {
    const current = historyByChatIdRef.current[chatId];
    if (!current?.hasMore || !current.nextCursor || current.isLoadingOlder) {
      return false;
    }

    setHistoryByChatId((prev) => ({
      ...prev,
      [chatId]: { ...current, isLoadingOlder: true },
    }));

    try {
      const page = await chatsApi.listMessagesPage(chatId, {
        limit: 20,
        cursorId: current.nextCursor.id,
        cursorCreatedAt: current.nextCursor.createdAt,
      });
      const apiMessages = page.messages.map(mapApiMessage);
      let branchMessages: unknown = null;
      try {
        const branch = await chatsApi.getBranchState(chatId);
        const row = branch.state as { messages?: unknown } | null;
        branchMessages = row?.messages ?? null;
      } catch {
        // ignore
      }
      const older = overlayBranchMessagesOnPage({
        pageMessages: apiMessages,
        branchMessages,
      });

      setAllChats((prev) => {
        const existing = prev[chatId] ?? [];
        const existingIds = new Set(existing.map((message) => message.id));
        const prepended = older.filter((message) => !existingIds.has(message.id));
        if (prepended.length === 0) return prev;
        return {
          ...prev,
          [chatId]: [...prepended, ...existing],
        };
      });

      setHistoryByChatId((prev) => ({
        ...prev,
        [chatId]: {
          hasMore: Boolean(page.hasMore),
          nextCursor: page.nextCursor,
          isLoadingOlder: false,
        },
      }));
      return true;
    } catch {
      setHistoryByChatId((prev) => ({
        ...prev,
        [chatId]: {
          ...(prev[chatId] ?? {
            hasMore: false,
            nextCursor: null,
            isLoadingOlder: false,
          }),
          isLoadingOlder: false,
        },
      }));
      return false;
    }
  }, []);

  const handleSelectChat = useCallback(
    async (chatId: string | null) => {
      if (!chatId) {
        setActiveChatId(null);
        setMessagesLoading(false);
        return;
      }
      setActiveChatId(chatId);
      const existing = useChatStore.getState().messageIdsByChatId[chatId];
      const history = historyByChatIdRef.current[chatId];
      // Re-fetch when we have never loaded a page for this chat.
      if (existing && existing.length > 0 && history) {
        setMessagesLoading(false);
        return;
      }
      await loadChatMessages(chatId);
    },
    [loadChatMessages],
  );

  const startNewChat = useCallback(() => {
    setActiveChatId(null);
  }, []);

  const stopGeneration = useCallback(() => {
    sharedApiGeneration.request?.abort();
    sharedApiGeneration.request = null;

    const activeGen = sharedApiGeneration.context;
    if (activeGen) {
      setAllChats((prev) => {
        const currentMessages = prev[activeGen.chatId] || [];
        return {
          ...prev,
          [activeGen.chatId]: currentMessages.map((message) =>
            message.id === activeGen.assistantMessageId
              ? { ...message, isStreaming: false }
              : message,
          ),
        };
      });
      sharedApiGeneration.context = null;
    }

    setIsGenerating(false);
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
      sharedApiGeneration.request = controller;

      const assistantId = overrideAssistantId ?? randomUUID();
      sharedApiGeneration.context = {
        chatId,
        assistantMessageId: assistantId,
      };

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
          throw new Error("Generation failed.");
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

        if (sharedApiGeneration.request !== controller) return;

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
        if (sharedApiGeneration.request === controller && !isAbort) {
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
        // Only clear state if this generation is still the active one — a
        // newer generation (rare, guarded by isGenerating) owns the state now.
        if (sharedApiGeneration.request === controller) {
          sharedApiGeneration.request = null;
          sharedApiGeneration.context = null;
          setIsGenerating(false);
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
      options?: { forceNewChat?: boolean },
    ): Promise<string | null> => {
      if (!prompt.trim() || isGenerating) return null;

      let chatId = options?.forceNewChat ? null : activeChatId;
      const isNewChat = !chatId;
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
          setAllChats((prev) => ({ ...prev, [chatId!]: [] }));
        }

        const { message: saved } = await chatsApi.appendMessage(
          chatId!,
          prompt.trim(),
        );
        const userMessage = mapApiMessage(saved);

        const priorMessages = allChatsRef.current[chatId!] ?? [];
        const conversation = buildConversation([...priorMessages, userMessage]);

        setAllChats((prev) => ({
          ...prev,
          [chatId!]: [...(prev[chatId!] ?? []), userMessage],
        }));

        setIsGenerating(true);
        void streamAssistantResponse(
          chatId!,
          conversation,
          isNewChat ? prompt.trim() : undefined,
        );

        return chatId;
      } finally {
        if (isNewChat) setCreatingChatPending(false);
      }
    },
    [
      activeChatId,
      isGenerating,
      projectIdFilter,
      streamAssistantResponse,
    ],
  );

  const handleDeleteChat = useCallback(
    async (chatId: string) => {
      await chatsApi.deleteChat(chatId);
      setAllChats((prev) => {
        const next = { ...prev };
        delete next[chatId];
        return next;
      });
      const remaining = recentChats.filter((c) => c.id !== chatId);
      setRecentChats(remaining);
      if (activeChatId === chatId) {
        setActiveChatId(remaining[0]?.id ?? null);
        if (remaining[0]?.id) void loadChatMessages(remaining[0].id);
      }
    },
    [activeChatId, loadChatMessages, recentChats],
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

      setIsGenerating(true);

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

      setIsGenerating(true);

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

      setIsGenerating(true);

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

  const historyState = activeChatId
    ? historyByChatId[activeChatId]
    : undefined;

  return {
    messages,
    recentChats,
    startedRecentChats,
    activeChat,
    activeChatId,
    isGenerating,
    loading,
    messagesLoading,
    creatingChatPending,
    hasMoreMessages: Boolean(historyState?.hasMore),
    isLoadingOlderMessages: Boolean(historyState?.isLoadingOlder),
    loadOlderMessages: () =>
      activeChatId ? loadOlderMessages(activeChatId) : Promise.resolve(false),
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
