
'use client';

import { useEffect, useState, useCallback } from 'react';
import { createSseParser, type StreamEvent } from '@/frontend/lib/chat-stream';
import type { Message } from '@/frontend/lib/types';

type AllChats = { [key: string]: Message[] };
type RecentChat = { id: string; name: string };
const CHAT_STORAGE_KEY = 'clauxen-chat-state-v1';

export function useChat() {
  const [allChats, setAllChats] = useState<AllChats>({});
  const [recentChats, setRecentChats] = useState<RecentChat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const messages = activeChatId ? allChats[activeChatId] || [] : [];

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
            chatMessages.map((message) => ({ ...message, isStreaming: false })),
          ])
        );
        setAllChats(hydratedChats);
      }
      if (parsed.recentChats) setRecentChats(parsed.recentChats);
      if (parsed.activeChatId !== undefined) setActiveChatId(parsed.activeChatId);
    } catch (error) {
      console.error('Failed to restore chat state:', error);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    window.localStorage.setItem(
      CHAT_STORAGE_KEY,
      JSON.stringify({ allChats, recentChats, activeChatId })
    );
  }, [allChats, recentChats, activeChatId]);
  
  const startNewChat = useCallback(() => {
    setActiveChatId(null);
  }, []);

  const handleSendMessage = async (prompt: string) => {
    const cleanPrompt = prompt?.trim();
    if (!cleanPrompt || isGenerating) return;

    setIsGenerating(true);

    let currentChatId = activeChatId;
    let isNewChat = !currentChatId;
    const title = cleanPrompt.length > 48 ? `${cleanPrompt.slice(0, 48)}...` : cleanPrompt;

    if (isNewChat) {
      currentChatId = `chat_${Date.now()}`;
      const newChatEntry = { id: currentChatId, name: title };
      
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


    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messages: conversationForApi }),
      });

      if (!response.ok || !response.body) {
        throw new Error('Failed to generate response');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
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

      const handleEvent = (event: StreamEvent) => {
        switch (event.type) {
          case 'start':
            applyAssistantPatch((message) => ({ ...message, isStreaming: true }));
            break;
          case 'thinking_start':
            applyAssistantPatch((message) => ({
              ...message,
              hasThinking: true,
              isStreaming: true,
            }));
            break;
          case 'thinking_delta':
            applyAssistantPatch((message) => ({
              ...message,
              hasThinking: true,
              thinkingContent: `${message.thinkingContent ?? ''}${event.delta}`,
              isStreaming: true,
            }));
            break;
          case 'answer_delta':
            applyAssistantPatch((message) => ({
              ...message,
              content: `${message.content}${event.delta}`,
              isStreaming: true,
            }));
            break;
          case 'done':
            applyAssistantPatch((message) => ({
              ...message,
              isStreaming: false,
            }));
            setIsGenerating(false);
            break;
          case 'error':
            applyAssistantPatch((message) => ({
              ...message,
              content: message.content || event.message,
              isStreaming: false,
            }));
            setIsGenerating(false);
            break;
        }
      };

      const parseChunk = createSseParser(handleEvent);

      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          setIsGenerating(false);
          break;
        }

        const textChunk = decoder.decode(value, { stream: true });
        parseChunk(textChunk);
      }

    } catch (error: any) {
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
        prev.map(chat => (chat.id === chatId ? { ...chat, name: newName } : chat))
    );
  }, []);

  return {
    messages,
    recentChats,
    isGenerating,
    activeChatId,
    startNewChat,
    handleSendMessage,
    handleSelectChat,
    handleDeleteChat,
    handleRenameChat,
    updateMessage,
  };
}
