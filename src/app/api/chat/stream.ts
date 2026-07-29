/**
 * Chat SSE factory — agent loop via @/server/agent-core (Provider / Novita only).
 * Timeline UI: ClauxenSseStream → src/components/agent/*
 */

import {
  runAutonomousAgent,
  type AgentStreamOptions,
} from "@/server/agent-core";
import { ClauxenSseStream } from "@/server/inference/clauxen-sse-stream";
import type { IncomingMessage } from "@/server/inference/novita";
import { buildModelSystemPrompt } from "@/server/inference/system-prompt";
import {
  buildUserPersonalizationAppend,
  loadUserPersonalization,
} from "@/server/services/user-personalization.service";
import { loadFollowUpSuggestionsEnabled } from "@/server/services/follow-up-settings.service";
import { buildFollowUpSystemInstruction } from "@/lib/follow-up-prompt";
import { resolveModelRuntime, parseChatModelId, modelCatalogEnvFromProcess } from "@/lib/model-catalog";
import {
  parseHomerReasoningEffort,
  type HomerReasoningEffort,
} from "@/lib/model-effort";

export type ChatStreamOptions = {
  chatModel?: string;
  userId?: string;
  conversationId?: string;
  userCountryCode?: string;
  generateChatTitle?: boolean;
  homerReasoningEffort?: HomerReasoningEffort;
  signal?: AbortSignal;
  onPauseForUser?: () => void | Promise<void>;
  onModelTurn?: AgentStreamOptions["onModelTurn"];
  /** Structured replay history, including prior signed thinking/tool rounds. */
  modelMessages?: AgentStreamOptions["messages"];
};

/** Agent loop via @/server/agent-core (Provider / Novita only). */
export async function createChatStream(
  messages: IncomingMessage[],
  options: ChatStreamOptions = {},
): Promise<ReadableStream<Uint8Array>> {
  const catalogEnv = modelCatalogEnvFromProcess();
  const chatModelId = parseChatModelId(options.chatModel);
  const runtime = resolveModelRuntime(chatModelId, catalogEnv);

  const [personalizationAppend, followUpsEnabled, userPersonalization] =
    await Promise.all([
      buildUserPersonalizationAppend(options.userId),
      loadFollowUpSuggestionsEnabled(options.userId),
      options.userId
        ? loadUserPersonalization(options.userId)
        : Promise.resolve(null),
    ]);

  const titleInstr = options.generateChatTitle
    ? "When the conversation has a clear topic, output a short title (3-6 words) for the sidebar."
    : "";

  const followUpInstr = followUpsEnabled
    ? buildFollowUpSystemInstruction()
    : "";

  const append = [personalizationAppend, titleInstr, followUpInstr]
    .map((part) => part.trim())
    .filter(Boolean)
    .join("\n\n");

  const systemPrompt = buildModelSystemPrompt({
    model: chatModelId,
    append: append || undefined,
  });

  const sse = new ClauxenSseStream();

  const agentOptions: AgentStreamOptions = {
    messages:
      options.modelMessages ??
      messages.map((m) => ({ role: m.role, content: m.content })),
    model: runtime.modelSlug,
    chatModelId,
    homerReasoningEffort: parseHomerReasoningEffort(options.homerReasoningEffort),
    thinkingEnabled: userPersonalization?.extendedThinking ?? false,
    userId: options.userId,
    conversationId: options.conversationId,
    userCountryCode: options.userCountryCode,
    signal: options.signal,
    systemPrompt,
    temperature: 0.6,
    maxTokens: 8192,
    onPauseForUser: options.onPauseForUser,
    onModelTurn: options.onModelTurn,
  };

  // Always autonomous — tools are always armed; the model decides when to use them.
  void runAutonomousAgent(sse, agentOptions).catch(() => {
    // Errors are written to the SSE stream inside runAutonomousAgent; swallow
    // here so client disconnect / abort never surfaces as unhandledRejection.
  });

  return sse.stream;
}

/** @deprecated Use createChatStream / @/server/agent-core. */
export const streamNovitaChat = createChatStream;
export const streamAiSdkChat = createChatStream;
