"use client";

import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  useRef,
} from "react";
import { useChat, type UseChatOptions } from "@/frontend/hooks/use-chat";
import {
  DEFAULT_CHAT_MODEL_ID,
  type ChatModelId,
} from "@/lib/chat-models";
import {
  DEFAULT_HOMER_REASONING_EFFORT,
  type HomerReasoningEffort,
} from "@/lib/model-effort";

type ChatSessionValue = ReturnType<typeof useChat> & {
  chatModel: ChatModelId;
  setChatModel: (model: ChatModelId) => void;
  homerReasoningEffort: HomerReasoningEffort;
  setHomerReasoningEffort: (effort: HomerReasoningEffort) => void;
};

const ChatSessionContext = createContext<ChatSessionValue | null>(null);

/**
 * One chat session for the whole main shell (sidebar + chat view).
 * `apiEnabled` is locked on first render of this provider instance.
 */
export function ChatSessionProvider({
  children,
  apiEnabled,
  projectId = null,
}: {
  children: React.ReactNode;
  apiEnabled: boolean;
  projectId?: string | null;
}) {
  // Freeze the mode for this mount — prevents mid-session hook graph flips.
  const lockedApi = useRef(apiEnabled).current;

  const [chatModel, setChatModel] = useState<ChatModelId>(DEFAULT_CHAT_MODEL_ID);
  const [homerReasoningEffort, setHomerReasoningEffort] =
    useState<HomerReasoningEffort>(DEFAULT_HOMER_REASONING_EFFORT);

  const options = useMemo<UseChatOptions>(
    () => ({
      apiEnabled: lockedApi,
      projectId,
      chatModel,
      homerReasoningEffort,
    }),
    [lockedApi, projectId, chatModel, homerReasoningEffort],
  );

  const chat = useChat(options);

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
      chat.hasMoreMessages,
      chat.isLoadingOlderMessages,
      chat.loadOlderMessages,
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
