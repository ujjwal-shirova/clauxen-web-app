
'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createSseParser, type StreamEvent } from '@/frontend/lib/chat-stream';
import type { Message, MessageBranchVersion, RecentChat } from '@/frontend/lib/types';

type AllChats = { [key: string]: Message[] };
const CHAT_STORAGE_KEY = 'clauxen-chat-state-v1';
const BRANCH_DATASET_KEY = 'clauxen-branch-dataset-v1';
type BranchDataset = Record<string, Record<string, { activeIndex: number; totalVersions: number; updatedAt: number }>>;

const stripMessageForSnapshot = (message: Message): Message => ({
  id: message.id,
  role: message.role,
  content: message.content,
  thinkingContent: message.thinkingContent,
  hasThinking: message.hasThinking,
  thinkingDurationSeconds: message.thinkingDurationSeconds,
});

const createChatSnapshot = (messages: Message[]): Message[] => messages.map(stripMessageForSnapshot);

const mergeSnapshotWithBranchMeta = (snapshot: Message[], currentMessages: Message[]): Message[] => {
  const branchMetaMap = new Map(
    currentMessages.map((msg) => [msg.id, { branchVersions: msg.branchVersions, activeBranchIndex: msg.activeBranchIndex }] as const)
  );

  return snapshot.map((msg) => {
    const meta = branchMetaMap.get(msg.id);
    if (!meta) return msg;
    return {
      ...msg,
      branchVersions: meta.branchVersions,
      activeBranchIndex: meta.activeBranchIndex,
    };
  });
};

const ensureBranchVersions = (message: Message): MessageBranchVersion[] =>
  message.branchVersions?.length
    ? message.branchVersions
    : [
        {
          content: message.content,
          thinkingContent: message.thinkingContent,
          hasThinking: message.hasThinking,
          thinkingDurationSeconds: message.thinkingDurationSeconds,
        },
      ];

const hydrateMessageFromActiveBranch = (message: Message, branchIndex: number): Message => {
  const versions = ensureBranchVersions(message);
  const safeIndex = Math.max(0, Math.min(branchIndex, versions.length - 1));
  const active = versions[safeIndex];

  return {
    ...message,
    content: active.content,
    thinkingContent: active.thinkingContent,
    hasThinking: active.hasThinking,
    thinkingDurationSeconds: active.thinkingDurationSeconds,
    activeBranchIndex: safeIndex,
    branchVersions: versions,
  };
};

export function useChat() {
  const [allChats, setAllChats] = useState<AllChats>({});
  const [branchDataset, setBranchDataset] = useState<BranchDataset>({});
  const [recentChats, setRecentChats] = useState<RecentChat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const activeRequestRef = useRef<AbortController | null>(null);
  const activeGenerationRef = useRef<{ chatId: string; assistantMessageId: string } | null>(null);
  const persistTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const allChatsRef = useRef<AllChats>({});
  const recentChatsRef = useRef<RecentChat[]>([]);
  const titleGenerationInProgressRef = useRef<Set<string>>(new Set());

  const messages = activeChatId ? allChats[activeChatId] || [] : [];
  const activeChat = recentChats.find((chat) => chat.id === activeChatId) ?? null;

  useEffect(() => {
    allChatsRef.current = allChats;
  }, [allChats]);

  useEffect(() => {
    recentChatsRef.current = recentChats;
  }, [recentChats]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
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
            chatMessages.map((message) => ({ ...message, isStreaming: false, isThinkingStreaming: false })),
          ])
        );
        setAllChats(hydratedChats);
      }
      if (parsed.recentChats) {
        setRecentChats(
          parsed.recentChats.map((chat) => ({
            ...chat,
            isTitleStreaming: false,
          }))
        );
      }
      if (parsed.activeChatId !== undefined) setActiveChatId(parsed.activeChatId);
      if (parsed.branchDataset) setBranchDataset(parsed.branchDataset);
    } catch (error) {
      console.error('Failed to restore chat state:', error);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (persistTimeoutRef.current) {
      clearTimeout(persistTimeoutRef.current);
    }

    persistTimeoutRef.current = setTimeout(() => {
      window.localStorage.setItem(
        CHAT_STORAGE_KEY,
        JSON.stringify({ allChats, recentChats, activeChatId, branchDataset })
      );
      window.localStorage.setItem(BRANCH_DATASET_KEY, JSON.stringify(branchDataset));
    }, isGenerating ? 900 : 200);

    return () => {
      if (persistTimeoutRef.current) {
        clearTimeout(persistTimeoutRef.current);
      }
    };
  }, [allChats, recentChats, activeChatId, branchDataset, isGenerating]);

  const finalizeAssistantMessage = useCallback((chatId: string, assistantMessageId: string) => {
    setAllChats((prev) => {
      const currentMessages = prev[chatId] || [];
      return {
        ...prev,
        [chatId]: currentMessages.map((message) =>
          message.id === assistantMessageId ? { ...message, isStreaming: false } : message
        ),
      };
    });
  }, []);

  const finalizeThinkingTimer = useCallback((chatId: string, assistantMessageId: string) => {
    setAllChats((prev) => {
      const currentMessages = prev[chatId] || [];
      return {
        ...prev,
        [chatId]: currentMessages.map((message) => {
          if (message.id !== assistantMessageId) {
            return message;
          }

          if (typeof message.thinkingStartedAtMs !== 'number' || message.thinkingDurationSeconds !== undefined) {
            return message;
          }

          const durationSeconds = Math.max(1, Math.round((Date.now() - message.thinkingStartedAtMs) / 1000));
          return {
            ...message,
            thinkingDurationSeconds: durationSeconds,
          };
        }),
      };
    });
  }, []);

  const stopGeneration = useCallback(() => {
    const activeRequest = activeRequestRef.current;
    const activeGeneration = activeGenerationRef.current;

    if (!activeRequest || !activeGeneration) {
      return;
    }

    activeRequest.abort();
    activeRequestRef.current = null;
    finalizeAssistantMessage(activeGeneration.chatId, activeGeneration.assistantMessageId);
    activeGenerationRef.current = null;
    setIsGenerating(false);
  }, [finalizeAssistantMessage]);

  const streamChatTitle = useCallback(async (chatId: string, nextTitle: string) => {
    setRecentChats((prev) =>
      prev.map((chat) =>
        chat.id === chatId
          ? { ...chat, name: '', isTitleStreaming: true }
          : chat
      )
    );

    for (let index = 1; index <= nextTitle.length; index += 1) {
      await new Promise((resolve) => setTimeout(resolve, 28));
      const partial = nextTitle.slice(0, index);
      setRecentChats((prev) =>
        prev.map((chat) =>
          chat.id === chatId
            ? { ...chat, name: partial, isTitleStreaming: true }
            : chat
        )
      );
    }

    setRecentChats((prev) =>
      prev.map((chat) =>
        chat.id === chatId
          ? { ...chat, name: nextTitle, isTitleStreaming: false, titleGenerated: true }
          : chat
      )
    );
  }, []);

  const maybeGenerateChatTitle = useCallback(async (chatId: string) => {
    if (titleGenerationInProgressRef.current.has(chatId)) {
      return;
    }

    const chatMeta = recentChatsRef.current.find((chat) => chat.id === chatId);
    if (!chatMeta || chatMeta.titleGenerated) {
      return;
    }

    const chatMessages = allChatsRef.current[chatId] || [];
    const firstUserMessage = chatMessages.find((message) => message.role === 'user' && message.content.trim().length > 0);
    const firstAssistantMessage = chatMessages.find((message) => message.role === 'assistant' && message.content.trim().length > 0);

    if (!firstUserMessage || !firstAssistantMessage) {
      return;
    }

    titleGenerationInProgressRef.current.add(chatId);

    try {
      const response = await fetch('/api/chat/title', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'user', content: firstUserMessage.content },
            { role: 'assistant', content: firstAssistantMessage.content },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate chat title');
      }

      const payload = (await response.json()) as { title?: string };
      const title = payload.title?.trim() || 'New Chat';
      await streamChatTitle(chatId, title);
    } catch (error) {
      console.error('Failed to generate chat title:', error);
      setRecentChats((prev) =>
        prev.map((chat) =>
          chat.id === chatId
            ? { ...chat, isTitleStreaming: false, titleGenerated: false, name: chat.name || 'New Chat' }
            : chat
        )
      );
    } finally {
      titleGenerationInProgressRef.current.delete(chatId);
    }
  }, [streamChatTitle]);
  
  const startNewChat = useCallback(() => {
    setActiveChatId(null);
  }, []);

  const streamAssistantResponse = useCallback(
    async ({
      chatId,
      assistantMessageId,
      conversationForApi,
      onCompleted,
    }: {
      chatId: string;
      assistantMessageId: string;
      conversationForApi: Array<{ role: 'user' | 'assistant'; content: string }>;
      onCompleted?: () => void;
    }) => {
      const requestController = new AbortController();
      activeRequestRef.current = requestController;
      activeGenerationRef.current = {
        chatId,
        assistantMessageId,
      };

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ messages: conversationForApi }),
          signal: requestController.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error('Failed to generate response');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let pendingThinkingDelta = '';
        let pendingAnswerDelta = '';
        let frameId: number | null = null;
        const THINK_TAG_REGEX = /<\/?think>/gi;

        const applyAssistantPatch = (updater: (message: Message) => Message) => {
          setAllChats((prev) => {
            const currentMessages = prev[chatId] || [];
            return {
              ...prev,
              [chatId]: currentMessages.map((message) =>
                message.id === assistantMessageId ? updater(message) : message
              ),
            };
          });
        };

        const flushPendingDeltas = () => {
          if (!pendingThinkingDelta && !pendingAnswerDelta) {
            return;
          }

          const thinkingDelta = pendingThinkingDelta;
          const answerDelta = pendingAnswerDelta;
          pendingThinkingDelta = '';
          pendingAnswerDelta = '';

          applyAssistantPatch((message) => {
            const nextMessage: Message = {
              ...message,
              hasThinking: message.hasThinking || thinkingDelta.length > 0,
              thinkingContent: `${message.thinkingContent ?? ''}${thinkingDelta}`,
              content: `${message.content}${answerDelta}`,
              isStreaming: true,
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
              };
              nextMessage.branchVersions = nextVersions;
            }

            return nextMessage;
          });
        };

        const scheduleDeltaFlush = () => {
          if (frameId !== null) {
            return;
          }

          frameId = window.requestAnimationFrame(() => {
            frameId = null;
            flushPendingDeltas();
          });
        };

        const handleEvent = (event: StreamEvent) => {
          switch (event.type) {
            case 'start':
              applyAssistantPatch((message) => ({ ...message, isStreaming: true }));
              break;
            case 'thinking_start':
              applyAssistantPatch((message) => ({
                ...message,
                hasThinking: true,
                isThinkingStreaming: true,
                thinkingStartedAtMs: message.thinkingStartedAtMs ?? Date.now(),
                isStreaming: true,
              }));
              break;
            case 'thinking_delta':
              {
                const sawCloseThinkTag = /<\/think>/i.test(event.delta);
                const normalizedThinkingDelta = event.delta.replace(THINK_TAG_REGEX, '');
                pendingThinkingDelta += normalizedThinkingDelta;
                if (sawCloseThinkTag) {
                  finalizeThinkingTimer(chatId, assistantMessageId);
                  applyAssistantPatch((message) => ({
                    ...message,
                    isThinkingStreaming: false,
                  }));
                }
              }
              scheduleDeltaFlush();
              break;
            case 'answer_delta':
              finalizeThinkingTimer(chatId, assistantMessageId);
              applyAssistantPatch((message) => ({
                ...message,
                isThinkingStreaming: false,
              }));
              pendingAnswerDelta += event.delta;
              scheduleDeltaFlush();
              break;
            case 'done':
              if (frameId !== null) {
                window.cancelAnimationFrame(frameId);
                frameId = null;
              }
              flushPendingDeltas();
              applyAssistantPatch((message) => ({
                ...message,
                isThinkingStreaming: false,
                isStreaming: false,
              }));
              finalizeThinkingTimer(chatId, assistantMessageId);
              activeRequestRef.current = null;
              activeGenerationRef.current = null;
              setIsGenerating(false);
              void maybeGenerateChatTitle(chatId);
              onCompleted?.();
              break;
            case 'error':
              if (frameId !== null) {
                window.cancelAnimationFrame(frameId);
                frameId = null;
              }
              flushPendingDeltas();
              applyAssistantPatch((message) => ({
                ...message,
                content: message.content || event.message,
                isThinkingStreaming: false,
                isStreaming: false,
              }));
              finalizeThinkingTimer(chatId, assistantMessageId);
              activeRequestRef.current = null;
              activeGenerationRef.current = null;
              setIsGenerating(false);
              void maybeGenerateChatTitle(chatId);
              onCompleted?.();
              break;
          }
        };

        const parseChunk = createSseParser(handleEvent);

        while (true) {
          const { value, done } = await reader.read();
          if (done) {
            finalizeThinkingTimer(chatId, assistantMessageId);
            activeRequestRef.current = null;
            activeGenerationRef.current = null;
            setIsGenerating(false);
            void maybeGenerateChatTitle(chatId);
            onCompleted?.();
            break;
          }

          const textChunk = decoder.decode(value, { stream: true });
          parseChunk(textChunk);
        }
      } catch (error: any) {
        activeRequestRef.current = null;
        const generationContext = activeGenerationRef.current;
        activeGenerationRef.current = null;

        if (error?.name === 'AbortError') {
          if (generationContext) {
            finalizeThinkingTimer(generationContext.chatId, generationContext.assistantMessageId);
            finalizeAssistantMessage(generationContext.chatId, generationContext.assistantMessageId);
          }
          setIsGenerating(false);
          return;
        }

        console.error('Error generating response:', error);
        const errorMessage = 'Sorry, I encountered an error. Please try again.';
        setAllChats((prev) => {
          const currentMessages = prev[chatId] || [];
          const updatedMessages = currentMessages.map((msg) =>
            msg.id === assistantMessageId
              ? { ...msg, content: errorMessage, thinkingContent: '', isStreaming: false, hasThinking: false }
              : msg
          );
          return { ...prev, [chatId]: updatedMessages };
        });
        setIsGenerating(false);
      }
    },
    [finalizeAssistantMessage, finalizeThinkingTimer, maybeGenerateChatTitle]
  );

  const handleSendMessage = async (prompt: string) => {
    const cleanPrompt = prompt?.trim();
    if (!cleanPrompt || isGenerating) return;

    setIsGenerating(true);

    let currentChatId = activeChatId;
    const isNewChat = !currentChatId;

    if (isNewChat) {
      currentChatId = `chat_${Date.now()}`;
      const newChatEntry: RecentChat = { id: currentChatId, name: 'New Chat', titleGenerated: false, isTitleStreaming: false };
      
      setAllChats(prev => ({ ...prev, [currentChatId!]: [] }));
      setRecentChats(prev => [newChatEntry, ...prev]);
      setActiveChatId(currentChatId);
    }
    
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: cleanPrompt,
      activeBranchIndex: 0,
      branchVersions: [{ content: cleanPrompt }],
    };
    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
      thinkingContent: '',
      isStreaming: true,
      isThinkingStreaming: false,
      hasThinking: false,
      activeBranchIndex: 0,
      branchVersions: [{ content: '', thinkingContent: '', hasThinking: false }],
    };

    const conversationForApi = [...messages, userMessage]
      .filter((entry) => entry.role === 'user' || entry.content.trim().length > 0)
      .map((entry) => ({
        role: entry.role,
        content: entry.content,
      }));
    
    setAllChats(prev => ({
      ...prev,
      [currentChatId!]: [...(prev[currentChatId!] || []), userMessage, assistantMessage],
    }));

    await streamAssistantResponse({
      chatId: currentChatId!,
      assistantMessageId: assistantMessage.id,
      conversationForApi,
      onCompleted: () => {
        const finalMessages = allChatsRef.current[currentChatId!] || [];
        const snapshot = createChatSnapshot(finalMessages);
        setAllChats((prev) => {
          const chatMessages = prev[currentChatId!] || [];
          return {
            ...prev,
            [currentChatId!]: chatMessages.map((msg) => {
              if (!msg.branchVersions?.length) return msg;
              const active = msg.activeBranchIndex ?? msg.branchVersions.length - 1;
              const versions = [...msg.branchVersions];
              versions[active] = {
                ...versions[active],
                snapshot,
              };
              return { ...msg, branchVersions: versions };
            }),
          };
        });
      },
    });
  };

  const switchMessageBranch = useCallback((chatId: string, messageId: string, direction: 'prev' | 'next') => {
    setAllChats((prev) => {
      const chatMessages = prev[chatId] || [];
      const targetMessage = chatMessages.find((msg) => msg.id === messageId);
      if (!targetMessage) return prev;
      const versions = ensureBranchVersions(targetMessage);
      if (versions.length <= 1) return prev;
      const current = targetMessage.activeBranchIndex ?? versions.length - 1;
      const next = direction === 'prev' ? current - 1 : current + 1;
      if (next < 0 || next >= versions.length) return prev;
      const nextVersion = versions[next];
      const snapshot = nextVersion.snapshot;

      if (!snapshot || snapshot.length === 0) {
        return {
          ...prev,
          [chatId]: chatMessages.map((msg) =>
            msg.id === messageId ? hydrateMessageFromActiveBranch(msg, next) : msg
          ),
        };
      }

      const snapshotWithMeta = mergeSnapshotWithBranchMeta(snapshot, chatMessages).map((msg) =>
        msg.id === messageId ? hydrateMessageFromActiveBranch(msg, next) : msg
      );

      return {
        ...prev,
        [chatId]: snapshotWithMeta,
      };
    });
    setBranchDataset((prev) => {
      const chatEntry = prev[chatId] || {};
      const current = chatEntry[messageId];
      if (!current) return prev;
      const nextActive = direction === 'prev' ? current.activeIndex - 1 : current.activeIndex + 1;
      if (nextActive < 0 || nextActive >= current.totalVersions) return prev;
      return {
        ...prev,
        [chatId]: {
          ...chatEntry,
          [messageId]: {
            ...current,
            activeIndex: nextActive,
            updatedAt: Date.now(),
          },
        },
      };
    });
  }, []);

  const editMessageWithBranch = useCallback(
    async (chatId: string, messageId: string, newContent: string) => {
      const trimmed = newContent.trim();
      if (!trimmed || isGenerating) return;
      const existing = allChatsRef.current[chatId] || [];
      const targetIndex = existing.findIndex((msg) => msg.id === messageId && msg.role === 'user');
      if (targetIndex === -1) return;

      setIsGenerating(true);

      const targetMessage = existing[targetIndex];
      const targetVersions = ensureBranchVersions(targetMessage);
      const baseSnapshot = createChatSnapshot(existing);
      const normalizedTargetVersions = [...targetVersions];
      const currentTargetIndex = targetMessage.activeBranchIndex ?? normalizedTargetVersions.length - 1;
      if (!normalizedTargetVersions[currentTargetIndex]?.snapshot) {
        normalizedTargetVersions[currentTargetIndex] = {
          ...normalizedTargetVersions[currentTargetIndex],
          snapshot: baseSnapshot,
        };
      }
      const nextUserVersions = [...normalizedTargetVersions, { content: trimmed }];
      const updatedUserMessage: Message = {
        ...targetMessage,
        content: trimmed,
        branchVersions: nextUserVersions,
        activeBranchIndex: nextUserVersions.length - 1,
      };

      const assistantMessage: Message = {
        id: `${Date.now()}`,
        role: 'assistant',
        content: '',
        thinkingContent: '',
        isStreaming: true,
        isThinkingStreaming: false,
        hasThinking: false,
        activeBranchIndex: 0,
        branchVersions: [{ content: '', thinkingContent: '', hasThinking: false }],
      };

      const nextChat = [...existing.slice(0, targetIndex), updatedUserMessage, assistantMessage];
      setAllChats((prev) => ({
        ...prev,
        [chatId]: nextChat,
      }));

      const conversationForApi = nextChat
        .filter((entry) => entry.role === 'user' || entry.content.trim().length > 0)
        .map((entry) => ({
          role: entry.role,
          content: entry.content,
        }));

      await streamAssistantResponse({
        chatId,
        assistantMessageId: assistantMessage.id,
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
            const target = allChatsRef.current[chatId]?.find((m) => m.id === messageId);
            const versionsCount = target ? ensureBranchVersions(target).length : 1;
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
    [isGenerating, streamAssistantResponse]
  );

  const retryAssistantWithBranch = useCallback(
    async (chatId: string, assistantMessageId: string) => {
      if (isGenerating) return;
      const existing = allChatsRef.current[chatId] || [];
      const assistantIndex = existing.findIndex((msg) => msg.id === assistantMessageId && msg.role === 'assistant');
      if (assistantIndex === -1) return;

      setIsGenerating(true);

      const assistantMessage = existing[assistantIndex];
      const existingVersions = ensureBranchVersions(assistantMessage);
      const baseSnapshot = createChatSnapshot(existing);
      const normalizedAssistantVersions = [...existingVersions];
      const currentAssistantIndex = assistantMessage.activeBranchIndex ?? normalizedAssistantVersions.length - 1;
      if (!normalizedAssistantVersions[currentAssistantIndex]?.snapshot) {
        normalizedAssistantVersions[currentAssistantIndex] = {
          ...normalizedAssistantVersions[currentAssistantIndex],
          snapshot: baseSnapshot,
        };
      }
      const nextBranchIndex = normalizedAssistantVersions.length;
      const nextVersions = [
        ...normalizedAssistantVersions,
        {
          content: '',
          thinkingContent: '',
          hasThinking: false,
        },
      ];

      const updatedAssistant: Message = {
        ...assistantMessage,
        content: '',
        thinkingContent: '',
        hasThinking: false,
        isStreaming: true,
        isThinkingStreaming: false,
        thinkingDurationSeconds: undefined,
        thinkingStartedAtMs: undefined,
        branchVersions: nextVersions,
        activeBranchIndex: nextBranchIndex,
      };

      const nextChat = [...existing.slice(0, assistantIndex), updatedAssistant];
      setAllChats((prev) => ({
        ...prev,
        [chatId]: nextChat,
      }));

      const conversationForApi = nextChat
        .slice(0, assistantIndex)
        .filter((entry) => entry.role === 'user' || entry.content.trim().length > 0)
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
            const target = allChatsRef.current[chatId]?.find((m) => m.id === assistantMessageId);
            const versionsCount = target ? ensureBranchVersions(target).length : 1;
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
    [isGenerating, streamAssistantResponse]
  );

  const handleSelectChat = useCallback((chatId: string | null) => {
    if(chatId) {
      setActiveChatId(chatId);
    } else {
      startNewChat();
    }
  }, [startNewChat]);


  const handleDeleteChat = useCallback((chatId: string) => {
    setAllChats(prev => {
        const newChats = { ...prev };
        delete newChats[chatId];
        return newChats;
    });

    const newRecentChats = recentChats.filter(chat => chat.id !== chatId);
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
  }, [activeChatId, recentChats, startNewChat]);

  const handleRenameChat = useCallback((chatId: string, newName: string) => {
    setRecentChats(prev =>
        prev.map(chat => (chat.id === chatId ? { ...chat, name: newName, titleGenerated: true } : chat))
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
    editMessageWithBranch,
    retryAssistantWithBranch,
    switchMessageBranch,
  };
}
