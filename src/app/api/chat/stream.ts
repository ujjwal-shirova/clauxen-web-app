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
import { buildModelSystemPrompt, buildTemporalContextAppend } from "@/server/inference/system-prompt";
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

export type ChatStreamPersonalizationBundle = {
  personalizationAppend: string;
  followUpsEnabled: boolean;
  extendedThinkingDefault: boolean;
};

export type ChatStreamOptions = {
  chatModel?: string;
  userId?: string;
  conversationId?: string;
  userCountryCode?: string;
  /** IANA timezone from the client (e.g. Asia/Kolkata). */
  clientTimezone?: string;
  generateChatTitle?: boolean;
  homerReasoningEffort?: HomerReasoningEffort;
  /** Composer Thinking toggle — when false, upstream gets enable_thinking: false. */
  extendedThinking?: boolean;
  /** Incognito: no durable chat/history; strip memory references from the prompt. */
  incognito?: boolean;
  signal?: AbortSignal;
  onPauseForUser?: () => void | Promise<void>;
  onModelTurn?: AgentStreamOptions["onModelTurn"];
  /** Structured replay history, including prior signed thinking/tool rounds. */
  modelMessages?: AgentStreamOptions["messages"];
  /**
   * Optional preloaded personalization — when provided, the stream body starts
   * without waiting on a second personalization round-trip.
   */
  personalization?: ChatStreamPersonalizationBundle;
};

/** Load personalization bits used to build the system prompt (cacheable). */
export async function loadChatStreamPersonalization(
  userId: string | undefined,
): Promise<ChatStreamPersonalizationBundle> {
  const [personalizationAppend, followUpsEnabled, userPersonalization] =
    await Promise.all([
      buildUserPersonalizationAppend(userId),
      loadFollowUpSuggestionsEnabled(userId),
      userId ? loadUserPersonalization(userId) : Promise.resolve(null),
    ]);
  return {
    personalizationAppend,
    followUpsEnabled,
    extendedThinkingDefault: userPersonalization?.extendedThinking === true,
  };
}

/** Agent loop via @/server/agent-core (Provider / Novita only). */
export async function createChatStream(
  messages: IncomingMessage[],
  options: ChatStreamOptions = {},
): Promise<ReadableStream<Uint8Array>> {
  const catalogEnv = modelCatalogEnvFromProcess();
  const chatModelId = parseChatModelId(options.chatModel);
  const runtime = resolveModelRuntime(chatModelId, catalogEnv);
  const sse = new ClauxenSseStream();

  // Return the ReadableStream immediately so the HTTP response can flush
  // headers + early SSE frames while personalization / Novita warm up.
  // Previously we awaited DB personalization before returning, which delayed
  // first-byte and made the client sit on a blank optimistic orb.
  void (async () => {
    try {
      const personalization =
        options.personalization ??
        (await loadChatStreamPersonalization(options.userId));

      if (options.signal?.aborted) {
        sse.finalize();
        return;
      }

      const titleInstr = options.generateChatTitle
        ? [
            "<chat_title_instruction>",
            "EXCEPTION to the no-tags rule: when the conversation has a clear topic, begin your FIRST response of this conversation with exactly one line: <chat_title>3-6 word sidebar title</chat_title>",
            "Then continue normally. Never emit this tag again and never mention it.",
            "</chat_title_instruction>",
          ].join("\n")
        : "";

      const followUpInstr = personalization.followUpsEnabled
        ? buildFollowUpSystemInstruction()
        : "";

      const personalizationForPrompt = options.incognito
        ? personalization.personalizationAppend
            .replace(/<memory_and_tools>[\s\S]*?<\/memory_and_tools>/g, "")
            .trim()
        : personalization.personalizationAppend;

      const incognitoInstr = options.incognito
        ? [
            "<incognito_mode>",
            "This is an Incognito conversation. It is not saved to history, memory, or training.",
            "Do not reference saved memories or prior chats outside this session.",
            "Treat the user as having no durable history beyond the messages in this request.",
            "</incognito_mode>",
          ].join("\n")
        : "";

      const temporalInstr = buildTemporalContextAppend({
        timezone: options.clientTimezone,
      });

      const append = [
        temporalInstr,
        personalizationForPrompt,
        incognitoInstr,
        titleInstr,
        followUpInstr,
      ]
        .map((part) => part.trim())
        .filter(Boolean)
        .join("\n\n");

      const systemPrompt = buildModelSystemPrompt({
        model: chatModelId,
        append: append || undefined,
      });

      const thinkingEnabled =
        options.extendedThinking ?? personalization.extendedThinkingDefault;

      const agentOptions: AgentStreamOptions = {
        messages:
          options.modelMessages ??
          messages.map((m) => ({ role: m.role, content: m.content })),
        model: runtime.modelSlug,
        chatModelId,
        homerReasoningEffort: parseHomerReasoningEffort(
          options.homerReasoningEffort,
        ),
        thinkingEnabled,
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
      await runAutonomousAgent(sse, agentOptions);
    } catch {
      // Errors are written to the SSE stream inside runAutonomousAgent; swallow
      // here so client disconnect / abort never surfaces as unhandledRejection.
      try {
        sse.finalize();
      } catch {
        // already closed
      }
    }
  })();

  return sse.stream;
}

/** @deprecated Use createChatStream / @/server/agent-core. */
export const streamNovitaChat = createChatStream;
export const streamAiSdkChat = createChatStream;
