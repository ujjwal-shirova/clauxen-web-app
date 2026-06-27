import type { IncomingMessage } from "@/backend/inference/novita";
import { createClauxenUiMessageStream } from "@/backend/inference/clauxen-ui-stream";
import { resolveAutonomousAgentModel } from "@/autonomous-agent/server/config";
import { createClauxenEventSink } from "@/autonomous-agent/server/stream/clauxen-bridge";
import {
  incomingToChatMessages,
  runAgentLoop,
} from "@/autonomous-agent/server/stream/run-turn";

export type AutonomousAgentChatOptions = {
  userId?: string;
  conversationId?: string;
  userCountryCode?: string;
  chatModel?: string;
  model?: string;
  baseUrl?: string;
  thinkingEnabled?: boolean;
  webSearchEnabled?: boolean;
};

/**
 * Autonomous agent byte stream for the main chat UI (Novita Chat Completions).
 * No system prompt — tool descriptions steer behavior.
 */
export function streamAutonomousAgentChat(
  messages: IncomingMessage[],
  signal?: AbortSignal,
  options: AutonomousAgentChatOptions = {},
): ReadableStream<Uint8Array> {
  const routed = resolveAutonomousAgentModel(options.chatModel);
  const chatMessages = incomingToChatMessages(messages);

  return createClauxenUiMessageStream(async (bridge) => {
    bridge.writeStart(false);
    const sink = createClauxenEventSink(bridge, signal);
    try {
      await runAgentLoop(chatMessages, sink, {
        model: options.model ?? routed.model,
        baseUrl: options.baseUrl ?? routed.baseUrl,
        userId: options.userId,
        userCountryCode: options.userCountryCode,
        conversationId: options.conversationId,
        thinkingEnabled: options.thinkingEnabled === true,
        webSearchEnabled: options.webSearchEnabled === true,
        signal,
        onToolProgress: (toolCallId, data) => {
          bridge.onToolData({ tool_call_id: toolCallId, ...data });
        },
      });
    } catch (error) {
      bridge.onError(
        error instanceof Error ? error.message : "Autonomous agent failed",
      );
    } finally {
      bridge.finalize();
    }
  });
}
