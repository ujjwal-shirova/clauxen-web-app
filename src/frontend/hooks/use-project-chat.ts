"use client";

import { useMemo } from "react";
import { useAuth } from "@/frontend/hooks/use-auth";
import { useChat } from "@/frontend/hooks/use-chat";
import type { ChatModelId } from "@/lib/chat-models";
import { DEFAULT_CHAT_MODEL_ID } from "@/lib/chat-models";

export function useProjectChat(
  projectId: string,
  options?: {
    thinkingEnabled?: boolean;
    webSearchEnabled?: boolean;
    chatModel?: ChatModelId;
  },
) {
  const auth = useAuth();
  const chat = useChat({
    apiEnabled: auth.isAuthenticated,
    projectId,
    thinkingEnabled: options?.thinkingEnabled ?? false,
    webSearchEnabled: options?.webSearchEnabled ?? true,
    chatModel: options?.chatModel ?? DEFAULT_CHAT_MODEL_ID,
  });

  const projectChats = useMemo(() => {
    if (auth.isAuthenticated) {
      return chat.startedRecentChats;
    }
    return chat.startedRecentChats.filter(
      (entry) => entry.projectId === projectId,
    );
  }, [auth.isAuthenticated, chat.startedRecentChats, projectId]);

  return {
    ...chat,
    projectChats,
  };
}
