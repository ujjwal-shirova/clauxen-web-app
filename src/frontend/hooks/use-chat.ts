"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type { StreamEvent } from "@/frontend/lib/chat-stream";
import { applyAgentStreamEvent } from "@/frontend/lib/agent-stream-reducer";
import type { Message, RecentChat } from "@/frontend/lib/types";
import { useChatApi } from "@/frontend/hooks/use-chat-api";
import { useAiStream } from "@/frontend/hooks/use-ai-stream";
import {
  getAllChatsNormalized,
  patchAssistantMessage,
  setAllChatsNormalized,
} from "@/frontend/lib/chat-store-bridge";
import {
  migrateLegacyLocalStorage,
  schedulePersistAllChats,
  loadChatMeta,
  loadFullChatFromIndexedDB,
  CHAT_STORAGE_KEY,
  BRANCH_DATASET_KEY,
} from "@/frontend/lib/chat-storage";
import {
  useActiveChatMessages,
  useActiveChatId,
  setActiveChatId,
  useChatStore,
} from "@/frontend/stores/chat-store";
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
import { shouldUseAgentPath } from "@/lib/chat-routing";

type AllChats = { [key: string]: Message[] };
type BranchDataset = Record<
  string,
  Record<
    string,
    { activeIndex: number; totalVersions: number; updatedAt: number }
  >
>;

function compactChatsForStorage(chats: AllChats): AllChats {
  return Object.fromEntries(
    Object.entries(chats).map(([chatId, messages]) => [
      chatId,
      messages.map(compactMessageBranchData),
    ]),
  );
}

export type UseChatOptions = {
  apiEnabled?: boolean;
  projectId?: string | null;
  thinkingEnabled?: boolean;
  webSearchEnabled?: boolean;
};

function useLocalChat(
  options: Pick<UseChatOptions, "thinkingEnabled" | "webSearchEnabled"> = {},
) {
  const thinkingEnabled = options.thinkingEnabled ?? false;
  const webSearchEnabled = options.webSearchEnabled ?? false;
  const { streamFromResponse } = useAiStream();
  const [branchDataset, setBranchDataset] = useState<BranchDataset>({});
  const [recentChats, setRecentChats] = useState<RecentChat[]>([]);
  const activeChatId = useActiveChatId();
  const [isGenerating, setIsGenerating] = useState(false);
  const setAllChats = setAllChatsNormalized;
  const activeRequestRef = useRef<AbortController | null>(null);
  const activeGenerationRef = useRef<{
    chatId: string;
    assistantMessageId: string;
  } | null>(null);
  const persistTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const allChatsRef = useRef<AllChats>({});
  const recentChatsRef = useRef<RecentChat[]>([]);
  const titleGenerationInProgressRef = useRef<Set<string>>(new Set());

  const messages = useActiveChatMessages();
  const activeChat =
    recentChats.find((chat) => chat.id === activeChatId) ?? null;

  useEffect(() => {
    allChatsRef.current = getAllChatsNormalized();
    return useChatStore.subscribe(() => {
      allChatsRef.current = getAllChatsNormalized();
    });
  }, []);


  useEffect(() => {
    recentChatsRef.current = recentChats;
  }, [recentChats]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    void (async () => {
      try {
        const migrated = await migrateLegacyLocalStorage();
        if (migrated) {
          const hydratedChats = Object.fromEntries(
            Object.entries(migrated.allChats).map(([chatId, chatMessages]) => [
              chatId,
              chatMessages.map((message) =>
                compactMessageBranchData({
                  ...message,
                  isStreaming: false,
                  isThinkingStreaming: false,
                }),
              ),
            ]),
          );
          useChatStore.getState().hydrateFromLegacy({
            allChats: hydratedChats,
            recentChats: migrated.meta?.recentChats,
            activeChatId: migrated.meta?.activeChatId,
            branchDataset: migrated.meta?.branchDataset,
          });
          if (migrated.meta?.recentChats) {
            setRecentChats(
              migrated.meta.recentChats.map((chat) => ({
                ...chat,
                isTitleStreaming: false,
              })),
            );
          }
          if (migrated.meta?.activeChatId !== undefined) {
            setActiveChatId(migrated.meta.activeChatId);
          }
          if (migrated.meta?.branchDataset) {
            setBranchDataset(migrated.meta.branchDataset);
          }
          return;
        }

        const meta = await loadChatMeta();
        if (!meta) {
          const saved = window.localStorage.getItem(CHAT_STORAGE_KEY);
          if (!saved) return;
          const parsed = JSON.parse(saved) as {
            allChats?: AllChats;
            recentChats?: RecentChat[];
            activeChatId?: string | null;
            branchDataset?: BranchDataset;
          };
          if (parsed.allChats) {
            const hydratedChats = Object.fromEntries(
              Object.entries(parsed.allChats).map(([chatId, chatMessages]) => [
                chatId,
                chatMessages.map((message) =>
                  compactMessageBranchData({
                    ...message,
                    isStreaming: false,
                    isThinkingStreaming: false,
                  }),
                ),
              ]),
            );
            useChatStore.getState().hydrateFromLegacy({
              allChats: hydratedChats,
              recentChats: parsed.recentChats,
              activeChatId: parsed.activeChatId,
              branchDataset: parsed.branchDataset,
            });
          }
          if (parsed.recentChats) setRecentChats(parsed.recentChats);
          if (parsed.activeChatId !== undefined)
            setActiveChatId(parsed.activeChatId);
          if (parsed.branchDataset) setBranchDataset(parsed.branchDataset);
          return;
        }

        setRecentChats(
          meta.recentChats.map((chat) => ({
            ...chat,
            isTitleStreaming: false,
          })),
        );
        setActiveChatId(meta.activeChatId);
        setBranchDataset(meta.branchDataset);

        const allChats: AllChats = {};
        for (const chat of meta.recentChats) {
          const loaded = await loadFullChatFromIndexedDB(chat.id);
          if (loaded.length > 0) {
            allChats[chat.id] = loaded.map((message) =>
              compactMessageBranchData({
                ...message,
                isStreaming: false,
                isThinkingStreaming: false,
              }),
            );
          }
        }
        useChatStore.getState().hydrateFromLegacy({
          allChats,
          recentChats: meta.recentChats,
          activeChatId: meta.activeChatId,
          branchDataset: meta.branchDataset,
        });
      } catch (error) {
        console.error("Failed to restore chat state:", error);
      }
    })();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let cancelPersist: (() => void) | null = null;

    const schedule = () => {
      cancelPersist?.();
      cancelPersist = schedulePersistAllChats(
        compactChatsForStorage(getAllChatsNormalized()),
        {
          recentChats: recentChatsRef.current,
          activeChatId,
          branchDataset,
        },
        isGenerating ? 900 : 200,
      );
    };

    schedule();
    const unsub = useChatStore.subscribe(schedule);

    return () => {
      unsub();
      cancelPersist?.();
    };
  }, [activeChatId, branchDataset, isGenerating]);

  const finalizeAssistantMessage = useCallback(
    (chatId: string, assistantMessageId: string) => {
      setAllChats((prev) => {
        const currentMessages = prev[chatId] || [];
        return {
          ...prev,
          [chatId]: currentMessages.map((message) =>
            message.id === assistantMessageId
              ? { ...message, isStreaming: false }
              : message,
          ),
        };
      });
    },
    [],
  );

  const finalizeThinkingTimer = useCallback(
    (chatId: string, assistantMessageId: string) => {
      setAllChats((prev) => {
        const currentMessages = prev[chatId] || [];
        return {
          ...prev,
          [chatId]: currentMessages.map((message) => {
            if (message.id !== assistantMessageId) {
              return message;
            }

            if (
              typeof message.thinkingStartedAtMs !== "number" ||
              message.thinkingDurationSeconds !== undefined
            ) {
              return message;
            }

            const durationSeconds = Math.max(
              1,
              Math.round((Date.now() - message.thinkingStartedAtMs) / 1000),
            );
            return {
              ...message,
              thinkingDurationSeconds: durationSeconds,
            };
          }),
        };
      });
    },
    [],
  );

  const stopGeneration = useCallback(() => {
    const activeRequest = activeRequestRef.current;
    const activeGeneration = activeGenerationRef.current;

    if (!activeRequest || !activeGeneration) {
      return;
    }

    activeRequest.abort();
    activeRequestRef.current = null;
    finalizeAssistantMessage(
      activeGeneration.chatId,
      activeGeneration.assistantMessageId,
    );
    activeGenerationRef.current = null;
    setIsGenerating(false);
  }, [finalizeAssistantMessage]);

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

      for (let index = 1; index <= title.length; index += 1) {
        await new Promise((resolve) => setTimeout(resolve, 28));
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
    },
    [],
  );

  const maybeGenerateChatTitle = useCallback(
    async (
      chatId: string,
      initialExchange?: { userContent: string; assistantContent: string },
    ) => {
      if (titleGenerationInProgressRef.current.has(chatId)) {
        return;
      }

      const chatMeta = recentChatsRef.current.find(
        (chat) => chat.id === chatId,
      );
      if (!chatMeta || chatMeta.titleGenerated) {
        return;
      }

      const chatMessages = allChatsRef.current[chatId] || [];
      const completedAssistants = chatMessages.filter(
        (message) =>
          message.role === "assistant" &&
          !message.isStreaming &&
          message.content.trim().length > 0,
      );
      const firstUserContent =
        initialExchange?.userContent ??
        chatMessages.find(
          (message) =>
            message.role === "user" && message.content.trim().length > 0,
        )?.content;
      const firstAssistantContent =
        initialExchange?.assistantContent ??
        (completedAssistants.length === 1
          ? completedAssistants[0].content
          : undefined);

      if (!firstUserContent?.trim() || !firstAssistantContent?.trim()) {
        return;
      }

      titleGenerationInProgressRef.current.add(chatId);
      setRecentChats((prev) => {
        const next = prev.map((chat) =>
          chat.id === chatId ? { ...chat, titleGenerated: true } : chat,
        );
        recentChatsRef.current = next;
        return next;
      });

      const userContentForTitle = stripTitleSourceText(firstUserContent);
      const assistantContentForTitle = stripTitleSourceText(
        firstAssistantContent,
      );

      try {
        const response = await fetch("/api/chat/title", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [
              { role: "user", content: userContentForTitle },
              { role: "assistant", content: assistantContentForTitle },
            ],
            thinkingEnabled: false,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to generate chat title");
        }

        const payload = (await response.json()) as { title?: string };
        const title = payload.title?.trim() || "";
        await streamChatTitle(chatId, title, {
          userContent: userContentForTitle,
          assistantContent: assistantContentForTitle,
        });
      } catch (error) {
        console.error("Failed to generate chat title:", error);
        const fallback = deriveTitleFromExchange(
          userContentForTitle,
          assistantContentForTitle,
        );
        await streamChatTitle(chatId, fallback, {
          userContent: userContentForTitle,
          assistantContent: assistantContentForTitle,
        });
      } finally {
        titleGenerationInProgressRef.current.delete(chatId);
      }
    },
    [streamChatTitle],
  );

  const startNewChat = useCallback(() => {
    setActiveChatId(null);
  }, []);

  const streamAssistantResponse = useCallback(
    async ({
      chatId,
      assistantMessageId,
      conversationForApi,
      titleUserContent,
      onCompleted,
    }: {
      chatId: string;
      assistantMessageId: string;
      conversationForApi: Array<{
        role: "user" | "assistant";
        content: string;
      }>;
      titleUserContent?: string;
      onCompleted?: () => void;
    }) => {
      const requestController = new AbortController();
      activeRequestRef.current = requestController;
      activeGenerationRef.current = {
        chatId,
        assistantMessageId,
      };
      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messages: conversationForApi,
            thinkingEnabled,
            webSearchEnabled,
          }),
          signal: requestController.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error("Failed to generate response");
        }

        let completedAnswer = "";
        let answerStarted = false;
        let streamError: string | null = null;
        const THINK_TAG_REGEX = /<\/?think>/gi;

        const applyAssistantPatch = (
          updater: (message: Message) => Message,
        ) => {
          patchAssistantMessage(chatId, assistantMessageId, updater);
        };

        const handleEvent = (event: StreamEvent) => {
          if (event.type === "thinking_delta") {
            const sawCloseThinkTag = /<\/think>/i.test(event.delta);
            const normalizedThinkingDelta = event.delta.replace(
              THINK_TAG_REGEX,
              "",
            );
            if (normalizedThinkingDelta || event.segmentId) {
              applyAssistantPatch((message) =>
                applyAgentStreamEvent(message, {
                  ...event,
                  delta: normalizedThinkingDelta,
                }),
              );
            }
            if (sawCloseThinkTag) {
              finalizeThinkingTimer(chatId, assistantMessageId);
              applyAssistantPatch((message) => ({
                ...message,
                isThinkingStreaming: false,
              }));
            }
            return;
          }

          if (event.type === "answer_delta") {
            if (!answerStarted) {
              answerStarted = true;
              finalizeThinkingTimer(chatId, assistantMessageId);
            }
            completedAnswer += event.delta;
          }

          if (event.type === "error") {
            streamError = event.message;
          }

          applyAssistantPatch((message) =>
            applyAgentStreamEvent(message, event),
          );
        };

        await streamFromResponse(
          response,
          { onEvent: handleEvent },
          requestController.signal,
        );

        if (streamError) {
          applyAssistantPatch((message) => ({
            ...message,
            content: message.content || streamError || "Generation failed.",
            isThinkingStreaming: false,
            isStreaming: false,
          }));
          finalizeThinkingTimer(chatId, assistantMessageId);
          activeRequestRef.current = null;
          activeGenerationRef.current = null;
          setIsGenerating(false);
          return;
        }

        if (activeRequestRef.current !== requestController) return;

        applyAssistantPatch((message) => {
          const nextMessage: Message = {
            ...message,
            isThinkingStreaming: false,
            isStreaming: false,
          };
          if (nextMessage.activeBranchIndex !== undefined) {
            const versions = ensureBranchVersions(nextMessage);
            const branchIndex = nextMessage.activeBranchIndex;
            const nextVersions = [...versions];
            nextVersions[branchIndex] = {
              content: nextMessage.content,
              thinkingContent: nextMessage.thinkingContent,
              hasThinking: nextMessage.hasThinking,
              thinkingDurationSeconds: nextMessage.thinkingDurationSeconds,
              agentMode: nextMessage.agentMode,
              agentFrameComplete: nextMessage.agentFrameComplete,
              agentSegments: nextMessage.agentSegments,
            };
            nextMessage.branchVersions = nextVersions;
          }
          return nextMessage;
        });
        finalizeThinkingTimer(chatId, assistantMessageId);
        activeRequestRef.current = null;
        activeGenerationRef.current = null;
        setIsGenerating(false);
        if (titleUserContent && completedAnswer.trim()) {
          void maybeGenerateChatTitle(chatId, {
            userContent: titleUserContent,
            assistantContent: completedAnswer,
          });
        }
        window.setTimeout(() => onCompleted?.(), 0);
      } catch (error: any) {
        activeRequestRef.current = null;
        const generationContext = activeGenerationRef.current;
        activeGenerationRef.current = null;

        if (error?.name === "AbortError") {
          if (generationContext) {
            finalizeThinkingTimer(
              generationContext.chatId,
              generationContext.assistantMessageId,
            );
            finalizeAssistantMessage(
              generationContext.chatId,
              generationContext.assistantMessageId,
            );
          }
          setIsGenerating(false);
          return;
        }

        console.error("Error generating response:", error);
        const errorMessage = "Sorry, I encountered an error. Please try again.";
        setAllChats((prev) => {
          const currentMessages = prev[chatId] || [];
          const updatedMessages = currentMessages.map((msg) =>
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  content: errorMessage,
                  thinkingContent: "",
                  isStreaming: false,
                  hasThinking: false,
                }
              : msg,
          );
          return { ...prev, [chatId]: updatedMessages };
        });
        setIsGenerating(false);
      }
    },
    [
      finalizeAssistantMessage,
      finalizeThinkingTimer,
      maybeGenerateChatTitle,
      streamFromResponse,
      thinkingEnabled,
      webSearchEnabled,
    ],
  );

  const handleSendMessage = async (prompt: string) => {
    const cleanPrompt = prompt?.trim();
    if (!cleanPrompt || isGenerating) return;

    setIsGenerating(true);

    let currentChatId = activeChatId;
    const isNewChat = !currentChatId;

    if (isNewChat) {
      currentChatId = `chat_${Date.now()}`;
      const newChatEntry: RecentChat = {
        id: currentChatId,
        name: "New Chat",
        titleGenerated: false,
        isTitleStreaming: false,
        updatedAt: Date.now(),
      };

      setAllChats((prev) => ({ ...prev, [currentChatId!]: [] }));
      setRecentChats((prev) => {
        const next = [newChatEntry, ...prev];
        recentChatsRef.current = next;
        return next;
      });
      setActiveChatId(currentChatId);
    } else if (currentChatId) {
      const chatId = currentChatId;
      setRecentChats((prev) => {
        const current = prev.find((chat) => chat.id === chatId);
        if (!current) return prev;
        const next = [
          { ...current, updatedAt: Date.now() },
          ...prev.filter((chat) => chat.id !== chatId),
        ];
        recentChatsRef.current = next;
        return next;
      });
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: cleanPrompt,
    };
    const conversationForApi = [...messages, userMessage]
      .filter(
        (entry) => entry.role === "user" || entry.content.trim().length > 0,
      )
      .map((entry) => ({
        role: entry.role,
        content: entry.content,
      }));

    const useAgent = shouldUseAgentPath({
      webSearchEnabled,
      thinkingType: thinkingEnabled ? "enabled" : "disabled",
    });

    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: "",
      thinkingContent: "",
      isStreaming: true,
      isThinkingStreaming: false,
      hasThinking: false,
      agentMode: useAgent,
      agentFrameComplete: false,
      agentSegments: useAgent ? [] : undefined,
    };

    setAllChats((prev) => ({
      ...prev,
      [currentChatId!]: [
        ...(prev[currentChatId!] || []),
        userMessage,
        assistantMessage,
      ],
    }));

    await streamAssistantResponse({
      chatId: currentChatId!,
      assistantMessageId: assistantMessage.id,
      conversationForApi,
      titleUserContent: isNewChat ? cleanPrompt : undefined,
    });
  };

  const switchMessageBranch = useCallback(
    (chatId: string, messageId: string, direction: "prev" | "next") => {
      setAllChats((prev) => {
        const chatMessages = prev[chatId] || [];
        const { nextChat } = switchMessageBranchHelper(
          chatMessages,
          messageId,
          direction,
        );
        return {
          ...prev,
          [chatId]: nextChat,
        };
      });
      setBranchDataset((prev) => {
        const chatEntry = prev[chatId] || {};
        const chatMessages = allChatsRef.current[chatId] || [];
        const target = chatMessages.find((m) => m.id === messageId);
        if (!target) return prev;
        const versions = ensureBranchVersions(target);
        const activeIdx = target.activeBranchIndex ?? versions.length - 1;
        const nextActive = direction === "prev" ? activeIdx - 1 : activeIdx + 1;
        if (nextActive < 0 || nextActive >= versions.length) return prev;
        return {
          ...prev,
          [chatId]: {
            ...chatEntry,
            [messageId]: {
              activeIndex: nextActive,
              totalVersions: versions.length,
              updatedAt: Date.now(),
            },
          },
        };
      });
    },
    [],
  );

  const editMessageWithBranch = useCallback(
    async (chatId: string, messageId: string, newContent: string) => {
      const trimmed = newContent.trim();
      if (!trimmed || isGenerating) return;
      const existing = allChatsRef.current[chatId] || [];

      const assistantMessageId = `${Date.now()}`;
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

      const conversationForApi = nextChat
        .filter(
          (entry) => entry.role === "user" || entry.content.trim().length > 0,
        )
        .map((entry) => ({
          role: entry.role,
          content: entry.content,
        }));

      await streamAssistantResponse({
        chatId,
        assistantMessageId,
        conversationForApi,
        onCompleted: () => {
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
          setBranchDataset((prev) => {
            const target = allChatsRef.current[chatId]?.find(
              (m) => m.id === messageId,
            );
            const versionsCount = target
              ? ensureBranchVersions(target).length
              : 1;
            return {
              ...prev,
              [chatId]: {
                ...(prev[chatId] || {}),
                [messageId]: {
                  activeIndex: Math.max(0, versionsCount - 1),
                  totalVersions: versionsCount,
                  updatedAt: Date.now(),
                },
              },
            };
          });
        },
      });
    },
    [isGenerating, streamAssistantResponse],
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

      const conversationForApi = nextChat
        .slice(0, -1)
        .filter(
          (entry) => entry.role === "user" || entry.content.trim().length > 0,
        )
        .map((entry) => ({
          role: entry.role,
          content: entry.content,
        }));

      await streamAssistantResponse({
        chatId,
        assistantMessageId,
        conversationForApi,
        onCompleted: () => {
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
          setBranchDataset((prev) => {
            const target = allChatsRef.current[chatId]?.find(
              (m) => m.id === assistantMessageId,
            );
            const versionsCount = target
              ? ensureBranchVersions(target).length
              : 1;
            return {
              ...prev,
              [chatId]: {
                ...(prev[chatId] || {}),
                [assistantMessageId]: {
                  activeIndex: Math.max(0, versionsCount - 1),
                  totalVersions: versionsCount,
                  updatedAt: Date.now(),
                },
              },
            };
          });
        },
      });
    },
    [isGenerating, streamAssistantResponse],
  );

  const handleSelectChat = useCallback(
    (chatId: string | null) => {
      if (!chatId) {
        startNewChat();
        return;
      }

      setActiveChatId(chatId);

      const store = useChatStore.getState();
      const existingIds = store.messageIdsByChatId[chatId];
      if (existingIds && existingIds.length > 0) return;

      void (async () => {
        try {
          const loaded = await loadFullChatFromIndexedDB(chatId);
          if (loaded.length === 0) return;
          store.setChatMessages(
            chatId,
            loaded.map((message) =>
              compactMessageBranchData({
                ...message,
                isStreaming: false,
                isThinkingStreaming: false,
              }),
            ),
          );
        } catch (error) {
          console.error("Failed to load chat from storage:", error);
        }
      })();
    },
    [startNewChat],
  );

  const handleDeleteChat = useCallback(
    (chatId: string) => {
      setAllChats((prev) => {
        const newChats = { ...prev };
        delete newChats[chatId];
        return newChats;
      });

      const newRecentChats = recentChats.filter((chat) => chat.id !== chatId);
      setRecentChats(newRecentChats);
      setBranchDataset((prev) => {
        const next = { ...prev };
        delete next[chatId];
        return next;
      });

      if (activeChatId === chatId) {
        if (newRecentChats.length > 0) {
          setActiveChatId(newRecentChats[0].id);
        } else {
          startNewChat();
        }
      }
    },
    [activeChatId, recentChats, startNewChat],
  );

  const handleRenameChat = useCallback((chatId: string, newName: string) => {
    setRecentChats((prev) =>
      prev.map((chat) =>
        chat.id === chatId
          ? { ...chat, name: newName, titleGenerated: true }
          : chat,
      ),
    );
  }, []);

  const handlePinChat = useCallback((chatId: string, pinned: boolean) => {
    setRecentChats((prev) =>
      prev.map((chat) =>
        chat.id === chatId ? { ...chat, pinned } : chat,
      ),
    );
  }, []);

  return {
    messages,
    recentChats,
    activeChat,
    isGenerating,
    activeChatId,
    startNewChat,
    handleSendMessage,
    stopGeneration,
    handleSelectChat,
    handleDeleteChat,
    handleRenameChat,
    handlePinChat,
    editMessageWithBranch,
    retryAssistantWithBranch,
    switchMessageBranch,
  };
}

function useChatDisabled() {
  return {
    messages: [] as Message[],
    recentChats: [] as RecentChat[],
    activeChat: null,
    activeChatId: null,
    isGenerating: false,
    loading: false,
    handleSendMessage: async () => {},
    stopGeneration: () => {},
    startNewChat: () => {},
    handleSelectChat: () => {},
    handleDeleteChat: async () => {},
    handleRenameChat: async () => {},
    handlePinChat: async () => {},
    editMessageWithBranch: async () => {},
    retryAssistantWithBranch: async () => {},
    switchMessageBranch: () => {},
    refreshChats: async () => {},
  };
}

export function useChat(options: UseChatOptions = {}) {
  const authRequiredForChat =
    process.env.NEXT_PUBLIC_AUTH_REQUIRED_FOR_CHAT === "true";

  if (options.apiEnabled) {
    return useChatApi(
      options.projectId ?? null,
      options.thinkingEnabled,
      options.webSearchEnabled,
    );
  }
  if (authRequiredForChat) {
    return useChatDisabled();
  }
  return useLocalChat(options);
}
