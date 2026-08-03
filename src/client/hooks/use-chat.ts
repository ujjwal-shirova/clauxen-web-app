"use client";

import { useChatApi } from "@/hooks/use-chat-api";
import type { ChatModelId } from "@/lib/chat-models";
import type { HomerReasoningEffort } from "@/lib/model-effort";

export type UseChatOptions = {
  apiEnabled?: boolean;
  projectId?: string | null;
  homerReasoningEffort?: HomerReasoningEffort;
  chatModel?: ChatModelId;
};

/**
 * Unified Chat controller hook. Delegated to `useChatApi` which manages
 * chat generation, streaming, device cache, and Supabase synchronization.
 */
export function useChat(options: UseChatOptions = {}) {
  return useChatApi(
    options.projectId ?? null,
    options.chatModel,
    options.homerReasoningEffort,
  );
}
