
'use client';

import { useState, useCallback } from 'react';
import type { Message } from '@/frontend/lib/types';

type AllChats = { [key: string]: Message[] };
type RecentChat = { id: string; name: string };

export function useChat() {
  const [allChats, setAllChats] = useState<AllChats>({});
  const [recentChats, setRecentChats] = useState<RecentChat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const messages = activeChatId ? allChats[activeChatId] || [] : [];
  
  const startNewChat = useCallback(() => {
    setActiveChatId(null);
  }, []);

  const handleSendMessage = async (prompt: string) => {
    const cleanPrompt = prompt?.trim();
    if (!cleanPrompt || isGenerating) return;

    setIsGenerating(true);

    let currentChatId = activeChatId;
    let isNewChat = !currentChatId;

    if (isNewChat) {
      currentChatId = `chat_${Date.now()}`;
      const newChatEntry = { id: currentChatId, name: "New Chat" };
      
      setAllChats(prev => ({ ...prev, [currentChatId!]: [] }));
      setRecentChats(prev => [newChatEntry, ...prev]);
      setActiveChatId(currentChatId);
    }
    
    const userMessage: Message = { id: Date.now().toString(), role: 'user', content: cleanPrompt };
    const assistantMessage: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: '' };
    
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
        body: JSON.stringify({ message: cleanPrompt }),
      });

      if (!response.ok || !response.body) {
        throw new Error('Failed to generate response');
      }

      const stream = response.body;
      const reader = stream.getReader();
      const decoder = new TextDecoder();
      
      let accumulatedContent = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          setIsGenerating(false);
          break;
        }

        const textChunk = decoder.decode(value, { stream: true });
        accumulatedContent += textChunk;
        
        setAllChats(prev => {
          const currentMessages = prev[currentChatId!] || [];
          const updatedMessages = currentMessages.map(msg => 
            msg.id === assistantMessage.id ? { ...msg, content: accumulatedContent } : msg
          );
          return {
            ...prev,
            [currentChatId!]: updatedMessages,
          };
        });
      }

    } catch (error: any) {
      console.error("Error generating response:", error);
      const errorMessage = "Sorry, I encountered an error. Please try again.";
      setAllChats(prev => {
        const currentMessages = prev[currentChatId!] || [];
        const updatedMessages = currentMessages.map(msg => 
          msg.id === assistantMessage.id ? { ...msg, content: errorMessage } : msg
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
