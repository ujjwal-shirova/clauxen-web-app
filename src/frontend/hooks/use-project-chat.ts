"use client";

import { useMemo } from "react";
import { useAuth } from "@/frontend/hooks/use-auth";
import { useChat } from "@/frontend/hooks/use-chat";
import type { ChatModelId } from "@/lib/chat-models";
import { DEFAULT_CHAT_MODEL_ID } from "@/lib/chat-models";
import {
  DEFAULT_HOMER_REASONING_EFFORT,
  type HomerReasoningEffort,
} from "@/lib/model-effort";

export function useProjectChat(
  projectId: string,
  options?: {
    homerReasoningEffort?: HomerReasoningEffort;
    chatModel?: ChatModelId;
  },
) {
  const auth = useAuth();
  const chat = useChat({
    apiEnabled: auth.isAuthenticated,
    projectId,
    homerReasoningEffort:
      options?.homerReasoningEffort ?? DEFAULT_HOMER_REASONING_EFFORT,
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
