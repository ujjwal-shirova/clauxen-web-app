import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type { IncomingMessage } from "@/backend/inference/novita";
import { autonomousAgentConfig } from "@/autonomous-agent/server/config";
import { getAutonomousAgentOpenAI } from "@/autonomous-agent/server/openai";
import { resolveToolsForAgentRequest } from "@/autonomous-agent/server/tools/chat-tools";
import { NOVITA_STREAM_OPTIONS } from "@/backend/inference/novita-stream";
import {
  buildAssistantToolCallMessage,
  createCompletionStreamState,
  finalizeCompletionStream,
  processCompletionChunk,
} from "@/autonomous-agent/server/stream/completion-stream";
import { executePendingToolCalls } from "@/autonomous-agent/server/stream/tool-loop";
import type { NormalizedEvent } from "@/autonomous-agent/types/events";
import { stamp } from "@/autonomous-agent/types/events";

const MAX_TOKENS = 8192;

export type EventSink = {
  send: (event: NormalizedEvent) => void;
  isOpen: () => boolean;
};

export type RunTurnOptions = {
  model?: string;
  baseUrl?: string;
  userId?: string;
  userCountryCode?: string;
  conversationId?: string;
  signal?: AbortSignal;
  thinkingEnabled?: boolean;
  webSearchEnabled?: boolean;
  onToolProgress?: (
    toolCallId: string,
    data: Record<string, unknown>,
  ) => void;
};

/** Convert client chat history — no system/developer messages. */
export function incomingToChatMessages(
  messages: IncomingMessage[],
): ChatCompletionMessageParam[] {
  return messages
    .filter(
      (m) =>
        (m.role === "user" || m.role === "assistant") &&
        m.content.trim().length > 0,
    )
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));
}

/**
 * Autonomous agent loop via Chat Completions (Novita-compatible).
 * Tool schemas are the only steering; the model decides when to call tools.
 */
export async function runAgentLoop(
  messages: ChatCompletionMessageParam[],
  sink: EventSink,
  options: RunTurnOptions = {},
): Promise<void> {
  const client = getAutonomousAgentOpenAI(options.baseUrl);
  const model = options.model ?? autonomousAgentConfig.defaultModel;
  const thinkingEnabled = options.thinkingEnabled === true;
  const conversation: ChatCompletionMessageParam[] = [...messages];
  const runId = `run-${Date.now()}`;
  const conversationId = options.conversationId ?? "chat";

  sink.send(stamp({ type: "RunStarted", runId, conversationId }));

  try {
    for (let iteration = 0; iteration < autonomousAgentConfig.maxIterations; iteration++) {
      if (!sink.isOpen() || options.signal?.aborted) return;

      const tools = resolveToolsForAgentRequest({
        iteration,
        thinkingEnabled,
      });

      const stream = await client.chat.completions.create(
        {
          model,
          messages: conversation,
          ...(tools ? { tools } : {}),
          max_tokens: MAX_TOKENS,
          temperature: 0.6,
          ...NOVITA_STREAM_OPTIONS,
        },
        { signal: options.signal },
      );

      const streamState = createCompletionStreamState();

      for await (const chunk of stream) {
        if (!sink.isOpen() || options.signal?.aborted) return;
        processCompletionChunk(chunk, streamState, sink);
      }

      const toolCalls = finalizeCompletionStream(streamState, sink);

      if (toolCalls.length === 0) {
        sink.send(stamp({ type: "RunFinished", runId, conversationId }));
        return;
      }

      conversation.push(
        buildAssistantToolCallMessage(streamState, toolCalls),
      );

      const { pauseForUser, chatMessages } = await executePendingToolCalls(
        toolCalls,
        sink,
        {
          conversationId,
          userId: options.userId,
          userCountryCode: options.userCountryCode,
          onTurnToolProgress: options.onToolProgress,
        },
      );

      conversation.push(...chatMessages);

      if (pauseForUser) {
        sink.send(stamp({ type: "RunFinished", runId, conversationId }));
        return;
      }
    }

    sink.send(
      stamp({
        type: "RunError",
        conversationId,
        message: `Maximum iteration limit (${autonomousAgentConfig.maxIterations}) reached.`,
        runId,
      }),
    );
  } catch (err) {
    if (options.signal?.aborted) return;
    const message =
      err instanceof Error ? err.message : "Autonomous agent failed";
    sink.send(stamp({ type: "RunError", conversationId, message, runId }));
  }
}
