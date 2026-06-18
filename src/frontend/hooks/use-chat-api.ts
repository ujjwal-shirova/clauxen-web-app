"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import type { StreamEvent } from "@/frontend/lib/chat-stream";
import { applyAgentStreamEvent } from "@/frontend/lib/agent-stream-reducer";
import {
  patchAnswerDelta,
  shouldFastPatchAnswerDelta,
} from "@/frontend/lib/agent-stream-fast-path";
import { agentAnswerDuplicatesInterim } from "@/frontend/lib/agent-frames";
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
import { filterStartedRecentChats } from "@/frontend/lib/started-recent-chats";
import { useShallow } from "zustand/react/shallow";

function mapApiMessage(row: chatsApi.ApiMessage): Message {
  const meta = row.metadata as {
    thinkingContent?: string;
    hasThinking?: boolean;
    thinkingDurationSeconds?: number;
    branchVersions?: Message["branchVersions"];
    activeBranchIndex?: number;
  };
  return compactMessageBranchData({
    id: row.id,
    role: row.role as Message["role"],
    content: finalizeChatTitleStrippedAnswer(row.content),
    thinkingContent: meta.thinkingContent,
    hasThinking: meta.hasThinking,
    thinkingDurationSeconds: meta.thinkingDurationSeconds,
    branchVersions: meta.branchVersions,
    activeBranchIndex: meta.activeBranchIndex,
  });
}

function buildConversation(messages: Message[]) {
  return buildChatConversation(messages);
}

export function useChatApi(
  projectIdFilter: string | null,
  thinkingEnabled = false,
  webSearchEnabled = false,
  chatModel: ChatModelId = DEFAULT_CHAT_MODEL_ID,
) {
  const { streamFromResponse } = useAiStream();
  const setAllChats = setAllChatsNormalized;
  const [recentChats, setRecentChats] = useState<RecentChat[]>([]);
  const activeChatId = useActiveChatId();
  const [isGenerating, setIsGenerating] = useState(false);
  const [loading, setLoading] = useState(false);
  const activeRequestRef = useRef<AbortController | null>(null);
  const activeGenerationRef = useRef<{
    chatId: string;
    assistantMessageId: string;
  } | null>(null);
  const allChatsRef = useRef<Record<string, Message[]>>({});
  const recentChatsRef = useRef<RecentChat[]>([]);
  const branchPersistRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  const refreshChats = useCallback(async () => {
    setLoading(true);
    try {
      const { chats } = await chatsApi.listChats(projectIdFilter ?? undefined);
      const nextChats = chats.map((c) => ({
        id: c.id,
        name: c.name,
        titleGenerated: c.name.toLowerCase() !== "new chat",
        projectId: c.projectId,
        updatedAt: new Date(c.updatedAt).getTime(),
      }));
      recentChatsRef.current = nextChats;
      setRecentChats(nextChats);
    } finally {
      setLoading(false);
    }
  }, [projectIdFilter]);

  useEffect(() => {
    void refreshChats();
  }, [refreshChats]);

  const loadChatMessages = useCallback(async (chatId: string) => {
    const { messages: rows } = await chatsApi.getChat(chatId);
    setAllChats((prev) => ({
      ...prev,
      [chatId]: rows.map(mapApiMessage),
    }));
    try {
      const branch = await chatsApi.getBranchState(chatId);
      const row = branch.state as { messages?: unknown } | null;
      const stored = row?.messages;
      if (Array.isArray(stored) && stored.length) {
        setAllChats((prev) => ({
          ...prev,
          [chatId]: stored as Message[],
        }));
      }
    } catch {
      // No branch state yet.
    }
  }, []);

  const handleSelectChat = useCallback(
    async (chatId: string | null) => {
      if (!chatId) {
        setActiveChatId(null);
        return;
      }
      setActiveChatId(chatId);
      const existing = useChatStore.getState().messageIdsByChatId[chatId];
      if (existing && existing.length > 0) return;
      await loadChatMessages(chatId);
    },
    [loadChatMessages],
  );

  const startNewChat = useCallback(() => {
    setActiveChatId(null);
  }, []);

  const stopGeneration = useCallback(() => {
    activeRequestRef.current?.abort();
    activeRequestRef.current = null;

    const activeGen = activeGenerationRef.current;
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
      activeGenerationRef.current = null;
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
      activeRequestRef.current = controller;

      const assistantId = overrideAssistantId ?? randomUUID();
      activeGenerationRef.current = {
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

      const response = await fetch(`/api/v1/chats/${chatId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          messages: conversation,
          thinkingEnabled,
          webSearchEnabled,
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

      const handleStreamEvent = (event: StreamEvent) => {
        if (event.type === "chat_title") {
          void applyInlineChatTitle(event.title);
          return;
        }
        if (event.type === "answer_delta") {
          let visibleDelta = event.delta;
          if (answerAccumulator) {
            visibleDelta = appendChatTitleAnswerDelta(
              answerAccumulator,
              event.delta,
            );
            const extractedTitle = extractChatTitleFromText(
              answerAccumulator.raw,
            );
            if (extractedTitle) {
              void applyInlineChatTitle(extractedTitle);
            }
            completedAnswer = answerAccumulator.visible;
          } else {
            completedAnswer += event.delta;
          }

          if (!visibleDelta) return;

          patchAssistantMessage(chatId, assistantId, (message) => {
            if (shouldFastPatchAnswerDelta(message)) {
              return patchAnswerDelta(message, visibleDelta);
            }
            return applyAgentStreamEvent(message, {
              ...event,
              delta: visibleDelta,
            });
          });
          return;
        }
        if (event.type === "error") {
          throw new Error(event.message);
        }
        patchAssistantMessage(chatId, assistantId, (message) =>
          applyAgentStreamEvent(message, event),
        );
      };

      await streamFromResponse(
        response,
        { onEvent: handleStreamEvent },
        controller.signal,
      );

      if (answerAccumulator && answerAccumulator.raw.trim()) {
        const finalized = finalizeChatTitleStrippedAnswer(answerAccumulator.raw);
        answerAccumulator.visible = finalized;
        completedAnswer = finalized;
        const extractedTitle = extractChatTitleFromText(answerAccumulator.raw);
        if (extractedTitle) {
          void applyInlineChatTitle(extractedTitle);
        }
        patchAssistantMessage(chatId, assistantId, (message) => ({
          ...message,
          content: finalized,
        }));
      }

      if (activeRequestRef.current !== controller) return;

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

      activeGenerationRef.current = null;
      scheduleBranchPersist(chatId);
      if (titleUserContent && completedAnswer.trim()) {
        void maybeGenerateChatTitle(chatId, {
          userContent: titleUserContent,
          assistantContent: completedAnswer,
        });
      }
    },
    [
      maybeGenerateChatTitle,
      scheduleBranchPersist,
      streamChatTitle,
      streamFromResponse,
      thinkingEnabled,
      webSearchEnabled,
      chatModel,
    ],
  );

  const handleSendMessage = useCallback(
    async (prompt: string): Promise<string | null> => {
      if (!prompt.trim() || isGenerating) return null;

      let chatId = activeChatId;
      const isNewChat = !chatId;
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
              name: chat.title,
              titleGenerated: false,
              projectId: projectIdFilter ?? undefined,
              updatedAt: Date.now(),
            },
            ...prev,
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
      try {
        await streamAssistantResponse(
          chatId!,
          conversation,
          isNewChat ? prompt.trim() : undefined,
        );
      } finally {
        setIsGenerating(false);
        activeRequestRef.current = null;
      }

      return chatId;
    },
    [
      activeChatId,
      isGenerating,
      maybeGenerateChatTitle,
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

  const handlePinChat = useCallback((chatId: string, pinned: boolean) => {
    setRecentChats((prev) =>
      prev.map((chat) =>
        chat.id === chatId ? { ...chat, pinned } : chat,
      ),
    );
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
        setIsGenerating(false);
        activeRequestRef.current = null;
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
        setIsGenerating(false);
        activeRequestRef.current = null;
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
        setIsGenerating(false);
        activeRequestRef.current = null;
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

  return {
    messages,
    recentChats,
    startedRecentChats,
    activeChat,
    activeChatId,
    isGenerating,
    loading,
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
