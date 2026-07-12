"use client";

import { useMemo } from "react";
import { useChat } from "@/frontend/hooks/use-chat";
import type { ChatModelId } from "@/lib/chat-models";
import { DEFAULT_CHAT_MODEL_ID } from "@/lib/chat-models";
import {
  DEFAULT_HOMER_REASONING_EFFORT,
  type HomerReasoningEffort,
} from "@/lib/model-effort";

/**
 * `apiEnabled` must be stable for this hook's mount. Callers should wait for
 * auth to resolve and remount with `key={userId}` when the user changes.
 */
export function useProjectChat(
  projectId: string,
  options: {
    apiEnabled: boolean;
    homerReasoningEffort?: HomerReasoningEffort;
    chatModel?: ChatModelId;
  },
) {
  const chat = useChat({
    apiEnabled: options.apiEnabled,
    projectId,
    homerReasoningEffort:
      options.homerReasoningEffort ?? DEFAULT_HOMER_REASONING_EFFORT,
    chatModel: options.chatModel ?? DEFAULT_CHAT_MODEL_ID,
  });

  const projectChats = useMemo(() => {
    if (options.apiEnabled) {
      return chat.startedRecentChats;
    }
    return chat.startedRecentChats.filter(
      (entry) => entry.projectId === projectId,
    );
  }, [options.apiEnabled, chat.startedRecentChats, projectId]);

  return {
    ...chat,
    projectChats,
  };
}
