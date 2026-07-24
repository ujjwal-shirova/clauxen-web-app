"use client";

import React, {
  createContext,
  useContext,
  useMemo,
  useState,
} from "react";
import { useChatApi } from "@/hooks/use-chat-api";
import {
  DEFAULT_CHAT_MODEL_ID,
  type ChatModelId,
} from "@/lib/chat-models";
import {
  DEFAULT_HOMER_REASONING_EFFORT,
  type HomerReasoningEffort,
} from "@/lib/model-effort";

type ChatSessionValue = ReturnType<typeof useChatApi> & {
  chatModel: ChatModelId;
  setChatModel: (model: ChatModelId) => void;
  homerReasoningEffort: HomerReasoningEffort;
  setHomerReasoningEffort: (effort: HomerReasoningEffort) => void;
};

const ChatSessionContext = createContext<ChatSessionValue | null>(null);

/**
 * One chat session for the whole main shell (sidebar + chat view).
 * API path with device IndexedDB cache (see `device-chat-cache.ts`).
 * Offline-only `useLocalChat` stays out of this provider.
 */
export function ChatSessionProvider({
  children,
  apiEnabled: _apiEnabled,
  projectId = null,
}: {
  children: React.ReactNode;
  apiEnabled: boolean;
  projectId?: string | null;
}) {
  const [chatModel, setChatModel] = useState<ChatModelId>(DEFAULT_CHAT_MODEL_ID);
  const [homerReasoningEffort, setHomerReasoningEffort] =
    useState<HomerReasoningEffort>(DEFAULT_HOMER_REASONING_EFFORT);

  const chat = useChatApi(projectId, chatModel, homerReasoningEffort);

  // Keep a stable context object identity for method refs; only bump when
  // observable chat fields change.
  const value = useMemo<ChatSessionValue>(
    () => ({
      ...chat,
      chatModel,
      setChatModel,
      homerReasoningEffort,
      setHomerReasoningEffort,
    }),
    [
      chat.messages,
      chat.recentChats,
      chat.startedRecentChats,
      chat.activeChat,
      chat.activeChatId,
      chat.isGenerating,
      chat.generatingChatIds,
      chat.queuedMessages,
      chat.editQueuedMessage,
      chat.removeQueuedMessage,
      chat.sendQueuedMessageNow,
      chat.creatingChatPending,
      chat.loading,
      chat.messagesLoading,
      chat.handleSendMessage,
      chat.stopGeneration,
      chat.startNewChat,
      chat.handleSelectChat,
      chat.handleDeleteChat,
      chat.handleRenameChat,
      chat.handlePinChat,
      chat.editMessageWithBranch,
      chat.redoUserMessageWithBranch,
      chat.retryAssistantWithBranch,
      chat.switchMessageBranch,
      chatModel,
      homerReasoningEffort,
    ],
  );

  return (
    <ChatSessionContext.Provider value={value}>
      {children}
    </ChatSessionContext.Provider>
  );
}

export function useChatSession(): ChatSessionValue {
  const ctx = useContext(ChatSessionContext);
  if (!ctx) {
    throw new Error("useChatSession must be used within ChatSessionProvider");
  }
  return ctx;
}

export function useOptionalChatSession(): ChatSessionValue | null {
  return useContext(ChatSessionContext);
}
