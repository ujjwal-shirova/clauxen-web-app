"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { StreamEvent } from "@/frontend/lib/chat-stream";
import { applyAgentStreamEvent } from "@/frontend/lib/agent-stream-reducer";
import { shouldUseAgentPath } from "@/lib/chat-routing";
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
  ensureBranchVersions,
  compactMessageBranchData,
  createChatSnapshot,
  editMessageWithBranchHelper,
  retryAssistantWithBranchHelper,
  switchMessageBranchHelper,
} from "@/frontend/lib/chat-branch";
import {
  deriveTitleFromExchange,
  normalizeChatTitle,
  stripTitleSourceText,
} from "@/lib/chat-title";

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
    content: row.content,
    thinkingContent: meta.thinkingContent,
    hasThinking: meta.hasThinking,
    thinkingDurationSeconds: meta.thinkingDurationSeconds,
    branchVersions: meta.branchVersions,
    activeBranchIndex: meta.activeBranchIndex,
  });
}

function buildConversation(messages: Message[]) {
  return messages
    .filter(
      (m) =>
        (m.role === "user" || m.role === "assistant") &&
        m.content.trim().length > 0,
    )
    .map((m) => ({ role: m.role, content: m.content }));
}

export function useChatApi(
  projectIdFilter: string | null,
  thinkingEnabled = false,
  webSearchEnabled = false,
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
  const activeChat = recentChats.find((c) => c.id === activeChatId) ?? null;

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

  const maybeGenerateChatTitle = useCallback(
    async (
      chatId: string,
      initialExchange: { userContent: string; assistantContent: string },
    ) => {
      if (titleGenerationInProgressRef.current.has(chatId)) return;

      const chatMeta = recentChatsRef.current.find((c) => c.id === chatId);
      if (!chatMeta || chatMeta.titleGenerated) return;

      if (
        !initialExchange.userContent.trim() ||
        !initialExchange.assistantContent.trim()
      )
        return;

      titleGenerationInProgressRef.current.add(chatId);
      setRecentChats((prev) => {
        const next = prev.map((c) =>
          c.id === chatId ? { ...c, titleGenerated: true } : c,
        );
        recentChatsRef.current = next;
        return next;
      });
      const userContentForTitle = stripTitleSourceText(
        initialExchange.userContent,
      );
      const assistantContentForTitle = stripTitleSourceText(
        initialExchange.assistantContent,
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
        const { title } = await chatsApi.generateChatTitle(chatId, [
          { role: "user", content: userContentForTitle },
          { role: "assistant", content: assistantContentForTitle },
        ]);
        const safeTitle = normalizeChatTitle(title, exchange);
        setRecentChats((prev) => {
          const next = prev.map((c) =>
            c.id === chatId
              ? { ...c, name: safeTitle, titleGenerated: true }
              : c,
          );
          recentChatsRef.current = next;
          return next;
        });
      } catch {
        setRecentChats((prev) => {
          const next = prev.map((c) =>
            c.id === chatId
              ? { ...c, name: fallbackTitle, titleGenerated: true }
              : c,
          );
          recentChatsRef.current = next;
          return next;
        });
      } finally {
        titleGenerationInProgressRef.current.delete(chatId);
      }
    },
    [],
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

      const response = await fetch(`/api/v1/chats/${chatId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          messages: conversation,
          thinkingEnabled,
          webSearchEnabled,
        }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error("Generation failed.");
      }

      const useAgent = shouldUseAgentPath({
        webSearchEnabled,
        thinkingType: thinkingEnabled ? "enabled" : "disabled",
      });

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
                    agentMode: useAgent,
                    agentFrameComplete: false,
                    agentSegments: useAgent ? [] : undefined,
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
              agentMode: useAgent,
              agentFrameComplete: false,
              agentSegments: useAgent ? [] : undefined,
            },
          ],
        };
      });

      let completedAnswer = "";

      const handleStreamEvent = (event: StreamEvent) => {
        if (event.type === "answer_delta") {
          completedAnswer += event.delta;
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

      if (activeRequestRef.current !== controller) return;

      setAllChats((prev) => ({
        ...prev,
        [chatId]: (prev[chatId] ?? []).map((m) =>
          m.id === assistantId ? { ...m, isStreaming: false } : m,
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
      streamFromResponse,
      thinkingEnabled,
      webSearchEnabled,
    ],
  );

  const handleSendMessage = useCallback(
    async (prompt: string) => {
      if (!prompt.trim() || isGenerating) return;

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
            { id: chat.id, name: chat.title, titleGenerated: false },
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
    },
    [activeChatId, isGenerating, projectIdFilter, streamAssistantResponse],
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
        const snapshot = createChatSnapshot(finalMessages);
        setAllChats((prev) => {
          const chatMessages = prev[chatId] || [];
          return {
            ...prev,
            [chatId]: chatMessages.map((msg) => {
              if (msg.id !== messageId) return msg;
              const versions = ensureBranchVersions(msg);
              const active = msg.activeBranchIndex ?? versions.length - 1;
              const nextVersions = [...versions];
              nextVersions[active] = {
                ...nextVersions[active],
                snapshot,
              };
              return { ...msg, branchVersions: nextVersions };
            }),
          };
        });
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
        const snapshot = createChatSnapshot(finalMessages);
        setAllChats((prev) => {
          const chatMessages = prev[chatId] || [];
          return {
            ...prev,
            [chatId]: chatMessages.map((msg) => {
              if (msg.id !== assistantMessageId) return msg;
              const versions = ensureBranchVersions(msg);
              const active = msg.activeBranchIndex ?? versions.length - 1;
              const nextVersionList = [...versions];
              nextVersionList[active] = {
                ...nextVersionList[active],
                snapshot,
              };
              return { ...msg, branchVersions: nextVersionList };
            }),
          };
        });
        setIsGenerating(false);
        activeRequestRef.current = null;
        scheduleBranchPersist(chatId);
      }
    },
    [isGenerating, streamAssistantResponse, scheduleBranchPersist],
  );

  const switchMessageBranch = useCallback(
    (chatId: string, messageId: string, direction: "prev" | "next") => {
      setAllChats((prev) => {
        const chatMessages = prev[chatId] || [];
        const { nextChat } = switchMessageBranchHelper(
          chatMessages,
          messageId,
          direction,
        );

        setTimeout(() => {
          void persistBranches(chatId, nextChat);
        }, 100);

        return {
          ...prev,
          [chatId]: nextChat,
        };
      });
    },
    [persistBranches],
  );

  return {
    messages,
    recentChats,
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
    retryAssistantWithBranch,
    switchMessageBranch,
    refreshChats,
  };
}
