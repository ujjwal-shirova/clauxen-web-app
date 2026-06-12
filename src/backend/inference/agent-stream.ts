import { env } from "@/backend/config/env";
import {
  buildStructuredOutputTool,
  convertAgentMessagesToAnthropic,
  consumeAnthropicMessageStream,
} from "@/backend/inference/anthropic-adapter";
import { getAnthropicClient } from "@/backend/inference/anthropic-client";
import {
  platformTools,
  type PlatformToolName,
} from "@/backend/inference/platform-tools";
import {
  executePlatformTool,
  type ToolEventSender,
} from "@/backend/inference/tool-executor";
import {
  extractPromptCacheStats,
  buildCacheableSystemPrefix,
} from "@/backend/inference/prompt-cache";
import { defaultStructuredSchema } from "@/backend/inference/structured-agent";
import type {
  AgentChatRequest,
  AgentMessage,
} from "@/backend/inference/novita-agent";
import {
  splitFinalAnswerContent,
  streamTextInChunks,
} from "@/lib/chat-routing";

export type AgentStreamEvent =
  | { event: "text_delta"; data: { text: string } }
  | { event: "reasoning_delta"; data: { text: string } }
  | { event: "tool_call_streaming"; data: { tool_calls: unknown } }
  | { event: "tool_calls_start"; data: { tool_calls: unknown[] } }
  | { event: "tool_executing"; data: { tool_call_id: string; name: string } }
  | {
      event: "tool_result";
      data: { tool_call_id: string; name: string; result: string };
    }
  | {
      event:
        | "file_created"
        | "file_updated"
        | "bash_stdout"
        | "bash_stderr"
        | "sandbox_ready"
        | "weather_data"
        | "places_data"
        | "code_executed";
      data: unknown;
    }
  | { event: "done"; data: { finish_reason: string; usage?: unknown } }
  | { event: "error"; data: { message: string } };

const MAX_LOOPS = 10;

function encodeAgentSse(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function resolveAgentTools(request: AgentChatRequest) {
  if (request.enableTools === false) return undefined;
  const all = platformTools();
  if (request.allowedTools?.length) {
    const allowed = new Set(request.allowedTools);
    return all.filter((tool) => allowed.has(tool.name as PlatformToolName));
  }
  return all;
}

function buildSystemPrompt(_request: AgentChatRequest) {
  return buildCacheableSystemPrefix("You are Clauxen.");
}

type AccumulatedToolUse = {
  id: string;
  name: string;
  inputJson: string;
};

function resolveStructuredTools(request: AgentChatRequest) {
  if (request.mode !== "structured") return undefined;
  return [
    buildStructuredOutputTool(
      "clauxen_agent_result",
      (request.responseSchema ?? defaultStructuredSchema()) as Record<
        string,
        unknown
      >,
    ),
  ];
}

export async function streamNovitaAgentChat(
  request: AgentChatRequest,
  send: ToolEventSender,
  signal?: AbortSignal,
  context?: { userId?: string; conversationId?: string },
) {
  const client = getAnthropicClient();
  const model = request.model?.trim() || env.defaultModel;
  const platformToolList = resolveAgentTools(request);
  const structuredTools = resolveStructuredTools(request);
  const tools = structuredTools ?? platformToolList;

  const conversation: AgentMessage[] = [
    { role: "system", content: buildSystemPrompt(request) },
    ...(request.messages ?? []),
  ];

  let loopCount = 0;
  let finalUsage: unknown = null;

  while (loopCount < MAX_LOOPS) {
    loopCount += 1;

    const { system, messages } = convertAgentMessagesToAnthropic(conversation);
    const stream = client.messages.stream(
      {
        model,
        max_tokens: 8192,
        temperature: 0.7,
        system,
        messages,
        tools: tools?.length ? tools : undefined,
        tool_choice:
          structuredTools?.length === 1
            ? { type: "tool", name: "clauxen_agent_result" }
            : tools?.length
              ? { type: "auto" }
              : undefined,
        thinking: request.enableThinking
          ? { type: "enabled", budget_tokens: 8192 }
          : undefined,
        stream: true,
      },
      { signal },
    );

    let accumulatedContent = "";
    let accumulatedReasoning = "";
    let pendingInterleaved = "";
    let streamedInterleavedChars = 0;
    const accumulatedToolUses: AccumulatedToolUse[] = [];
    let finishReason: string | null = null;

    const flushInterleaved = (text: string) => {
      if (!text) return;
      send("reasoning_delta", { text });
      streamedInterleavedChars += text.length;
    };

    await consumeAnthropicMessageStream(
      stream,
      {
        onUsage: (usage) => {
          finalUsage = usage;
          send("cache_usage", extractPromptCacheStats(usage));
        },
        onTextDelta: (delta) => {
          accumulatedContent += delta;
          const hasToolCallsInTurn = accumulatedToolUses.length > 0;
          if (hasToolCallsInTurn) {
            flushInterleaved(delta);
          } else {
            pendingInterleaved += delta;
          }
        },
        onThinkingDelta: (delta) => {
          accumulatedReasoning += delta;
          send("reasoning_delta", { text: delta });
        },
        onToolUseStart: (tool) => {
          if (pendingInterleaved.trim()) {
            flushInterleaved(pendingInterleaved);
            pendingInterleaved = "";
          }
          accumulatedToolUses.push({
            id: tool.id,
            name: tool.name,
            inputJson: "",
          });
          send("tool_call_streaming", {
            tool_calls: [{ id: tool.id, name: tool.name }],
          });
        },
        onToolInputDelta: (partial) => {
          const slot = accumulatedToolUses[accumulatedToolUses.length - 1];
          if (slot) {
            slot.inputJson += partial;
          }
        },
        onStopReason: (reason) => {
          finishReason = reason;
        },
      },
      signal,
    );

    const toolUsesArray = accumulatedToolUses;

    conversation.push({
      role: "assistant",
      content: accumulatedContent || null,
      thinking: accumulatedReasoning || undefined,
      tool_uses:
        toolUsesArray.length > 0
          ? toolUsesArray.map((toolUse) => {
              let input: Record<string, unknown> = {};
              try {
                input = JSON.parse(toolUse.inputJson || "{}") as Record<
                  string,
                  unknown
                >;
              } catch {
                input = {};
              }
              return {
                id: toolUse.id,
                name: toolUse.name,
                input,
              };
            })
          : undefined,
    });

    if (finishReason === "tool_use" && toolUsesArray.length > 0) {
      if (pendingInterleaved.trim()) {
        flushInterleaved(pendingInterleaved);
        pendingInterleaved = "";
      }

      send("tool_calls_start", {
        tool_calls: toolUsesArray.map((toolUse) => ({
          id: toolUse.id,
          name: toolUse.name,
          input: toolUse.inputJson,
        })),
      });

      for (const toolUse of toolUsesArray) {
        let parsedArgs: Record<string, unknown> = {};
        try {
          parsedArgs = JSON.parse(toolUse.inputJson || "{}") as Record<
            string,
            unknown
          >;
        } catch {
          parsedArgs = {};
        }

        send("tool_executing", {
          tool_call_id: toolUse.id,
          name: toolUse.name,
          args: parsedArgs,
          description:
            typeof parsedArgs.description === "string"
              ? parsedArgs.description
              : undefined,
        });

        try {
          const result = await executePlatformTool(
            toolUse.name as PlatformToolName,
            toolUse.inputJson,
            send,
            context,
          );
          send("tool_result", {
            tool_call_id: toolUse.id,
            name: toolUse.name,
            result,
          });
          conversation.push({
            role: "tool",
            tool_use_id: toolUse.id,
            content: result,
          });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Tool execution failed";
          send("tool_result", {
            tool_call_id: toolUse.id,
            name: toolUse.name,
            result: JSON.stringify({ error: message }),
          });
          conversation.push({
            role: "tool",
            tool_use_id: toolUse.id,
            content: JSON.stringify({ error: message }),
          });
        }
      }
      continue;
    }

    const finalTurnText = accumulatedContent.slice(streamedInterleavedChars);
    const { preamble, answer } = splitFinalAnswerContent(finalTurnText);
    if (preamble) {
      flushInterleaved(preamble);
    }

    send("frame_complete", {});
    streamTextInChunks(answer, (chunk) => {
      send("text_delta", { text: chunk });
    });

    send("done", {
      finish_reason: finishReason ?? "end_turn",
      usage: finalUsage,
      cache: extractPromptCacheStats(finalUsage),
    });
    return {
      content: accumulatedContent,
      reasoning: accumulatedReasoning,
      usage: finalUsage,
      model,
    };
  }

  send("frame_complete", {});
  send("done", { finish_reason: "max_loops", usage: finalUsage });
  return { content: "", reasoning: "", usage: finalUsage, model };
}

export function createAgentSseStream(
  request: AgentChatRequest,
  signal?: AbortSignal,
  context?: { userId?: string; conversationId?: string },
) {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const send: ToolEventSender = (event, data) => {
        controller.enqueue(encoder.encode(encodeAgentSse(event, data)));
      };

      try {
        await streamNovitaAgentChat(request, send, signal, context);
        controller.close();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Stream failed";
        send("error", { message });
        controller.close();
      }
    },
  });
}
