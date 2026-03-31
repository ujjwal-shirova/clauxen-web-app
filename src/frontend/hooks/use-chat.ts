
'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createSseParser, type StreamEvent } from '@/frontend/lib/chat-stream';
import type { Message, RecentChat } from '@/frontend/lib/types';

type AllChats = { [key: string]: Message[] };
const CHAT_STORAGE_KEY = 'clauxen-chat-state-v1';

export function useChat() {
  const [allChats, setAllChats] = useState<AllChats>({});
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
        JSON.stringify({ allChats, recentChats, activeChatId })
      );
    }, isGenerating ? 900 : 200);

    return () => {
      if (persistTimeoutRef.current) {
        clearTimeout(persistTimeoutRef.current);
      }
    };
  }, [allChats, recentChats, activeChatId, isGenerating]);

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
    
    const userMessage: Message = { id: Date.now().toString(), role: 'user', content: cleanPrompt };
    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
      thinkingContent: '',
      isStreaming: true,
      isThinkingStreaming: false,
      hasThinking: false,
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

    const requestController = new AbortController();
    activeRequestRef.current = requestController;
    activeGenerationRef.current = {
      chatId: currentChatId!,
      assistantMessageId: assistantMessage.id,
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
        setAllChats(prev => {
          const currentMessages = prev[currentChatId!] || [];
          return {
            ...prev,
            [currentChatId!]: currentMessages.map((message) =>
              message.id === assistantMessage.id ? updater(message) : message
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

        applyAssistantPatch((message) => ({
          ...message,
          hasThinking: message.hasThinking || thinkingDelta.length > 0,
          thinkingContent: `${message.thinkingContent ?? ''}${thinkingDelta}`,
          content: `${message.content}${answerDelta}`,
          isStreaming: true,
        }));
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
                finalizeThinkingTimer(currentChatId!, assistantMessage.id);
                applyAssistantPatch((message) => ({
                  ...message,
                  isThinkingStreaming: false,
                }));
              }
            }
            scheduleDeltaFlush();
            break;
          case 'answer_delta':
            finalizeThinkingTimer(currentChatId!, assistantMessage.id);
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
            finalizeThinkingTimer(currentChatId!, assistantMessage.id);
            activeRequestRef.current = null;
            activeGenerationRef.current = null;
            setIsGenerating(false);
            void maybeGenerateChatTitle(currentChatId!);
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
            finalizeThinkingTimer(currentChatId!, assistantMessage.id);
            activeRequestRef.current = null;
            activeGenerationRef.current = null;
            setIsGenerating(false);
            void maybeGenerateChatTitle(currentChatId!);
            break;
        }
      };

      const parseChunk = createSseParser(handleEvent);

      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          finalizeThinkingTimer(currentChatId!, assistantMessage.id);
          activeRequestRef.current = null;
          activeGenerationRef.current = null;
          setIsGenerating(false);
          void maybeGenerateChatTitle(currentChatId!);
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

      console.error("Error generating response:", error);
      const errorMessage = "Sorry, I encountered an error. Please try again.";
      setAllChats(prev => {
        const currentMessages = prev[currentChatId!] || [];
        const updatedMessages = currentMessages.map(msg => 
          msg.id === assistantMessage.id
            ? { ...msg, content: errorMessage, thinkingContent: '', isStreaming: false, hasThinking: false }
            : msg
        );
        return { ...prev, [currentChatId!]: updatedMessages };
      });
      setIsGenerating(false);
    }
  };

  const updateMessage = useCallback((chatId: string, messageId: string, newContent: string) => {
    setAllChats(prev => {
      const chatMessages = prev[chatId] || [];
      return {
        ...prev,
        [chatId]: chatMessages.map(msg => 
          msg.id === messageId ? { ...msg, content: newContent } : msg
        )
      };
    });
  }, []);

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
    updateMessage,
  };
}
