"use client";

import React, { createContext, useContext, useMemo, useState } from "react";
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
 * `apiEnabled` must be stable for the lifetime of this mount — parent should
 * remount with a new `key` when the signed-in user changes.
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
  const [chatModel, setChatModel] = useState<ChatModelId>(DEFAULT_CHAT_MODEL_ID);
  const [homerReasoningEffort, setHomerReasoningEffort] =
    useState<HomerReasoningEffort>(DEFAULT_HOMER_REASONING_EFFORT);

  const options = useMemo<UseChatOptions>(
    () => ({
      apiEnabled,
      projectId,
      chatModel,
      homerReasoningEffort,
    }),
    [apiEnabled, projectId, chatModel, homerReasoningEffort],
  );

  const chat = useChat(options);

  const value = useMemo<ChatSessionValue>(
    () => ({
      ...chat,
      chatModel,
      setChatModel,
      homerReasoningEffort,
      setHomerReasoningEffort,
    }),
    [chat, chatModel, homerReasoningEffort],
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
