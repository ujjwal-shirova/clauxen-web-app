import { env, requireNovitaApiKey } from "@/backend/config/env";
import { extractUpstreamError } from "@/backend/inference/novita";
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

export type AgentStreamEvent =
  | { event: "text_delta"; data: { text: string } }
  | { event: "reasoning_delta"; data: { text: string } }
  | { event: "tool_call_streaming"; data: { tool_calls: unknown } }
  | { event: "tool_calls_start"; data: { tool_calls: unknown[] } }
  | { event: "tool_executing"; data: { tool_call_id: string; name: string } }
  | { event: "tool_result"; data: { tool_call_id: string; name: string; result: string } }
  | { event: "file_created" | "file_updated" | "bash_stdout" | "bash_stderr" | "sandbox_ready" | "weather_data" | "places_data" | "code_executed"; data: unknown }
  | { event: "done"; data: { finish_reason: string; usage?: unknown } }
  | { event: "error"; data: { message: string } };

const MAX_LOOPS = 10;

function encodeAgentSse(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function novitaHeaders(apiKey: string) {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

function buildResponseFormat(request: AgentChatRequest) {
  if (request.mode !== "structured") return undefined;
  return {
    type: "json_schema",
    json_schema: {
      name: "clauxen_agent_result",
      strict: true,
      schema: request.responseSchema ?? defaultStructuredSchema(),
    },
  };
}

function buildSystemPrompt(request: AgentChatRequest) {
  const toolNames = platformTools().map((t) => t.function.name);
  return buildCacheableSystemPrefix(
    [
      "You are Clauxen Agent, a production AI assistant on Novita AI (Kimi K2.6).",
      "Use tools for coding, sandbox execution, web research, and file artifacts.",
      "When creating files, use create_file — they appear in the user's artifact panel.",
      "For shell work use bash_tool. For edits use str_replace after view.",
      "Never provide malware, credential theft, or abuse guidance.",
      `Available tools: ${toolNames.join(", ")}.`,
      request.enableTools === false ? "Tools are disabled for this turn." : "",
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

type AccumulatedToolCall = {
  id: string;
  type: string;
  function: { name: string; arguments: string };
  index: number;
};

export async function streamNovitaAgentChat(
  request: AgentChatRequest,
  send: ToolEventSender,
  signal?: AbortSignal,
  context?: { userId?: string; conversationId?: string },
) {
  const apiKey = requireNovitaApiKey();
  const model = request.model?.trim() || env.defaultModel;
  const tools = request.enableTools === false ? undefined : platformTools();

  const conversation: AgentMessage[] = [
    { role: "system", content: buildSystemPrompt(request) },
    ...(request.messages ?? []),
  ];

  let loopCount = 0;
  let finalUsage: unknown = null;

  while (loopCount < MAX_LOOPS) {
    loopCount += 1;

    const upstream = await fetch(env.novitaChatUrl, {
      method: "POST",
      headers: novitaHeaders(apiKey),
      signal,
      body: JSON.stringify({
        model,
        messages: conversation,
        tools,
        tool_choice: tools ? "auto" : undefined,
        stream: true,
        max_tokens: 8192,
        temperature: 0.7,
        response_format: buildResponseFormat(request),
        enable_thinking: Boolean(request.enableThinking),
        separate_reasoning: Boolean(request.enableThinking),
        reasoning_split: Boolean(request.reasoningSplit ?? request.enableThinking),
      }),
    });

    if (!upstream.ok || !upstream.body) {
      const body = await upstream.json().catch(() => null);
      throw new Error(extractUpstreamError(body, "Novita agent stream failed."));
    }

    let accumulatedContent = "";
    let accumulatedReasoning = "";
    const accumulatedToolCalls: Record<number, AccumulatedToolCall> = {};
    let finishReason: string | null = null;
    let reasoningDetails: Array<Record<string, unknown>> = [];

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const payload = line.slice(6).trim();
        if (!payload || payload === "[DONE]") continue;

        let parsed: {
          choices?: Array<{
            finish_reason?: string;
            delta?: {
              content?: string;
              reasoning_content?: string;
              reasoning_details?: Array<{ type: string; text: string }>;
              tool_calls?: Array<{
                index: number;
                id?: string;
                type?: string;
                function?: { name?: string; arguments?: string };
              }>;
            };
          }>;
          usage?: unknown;
        };

        try {
          parsed = JSON.parse(payload) as typeof parsed;
        } catch {
          continue;
        }

        if (parsed.usage) {
          finalUsage = parsed.usage;
          send("cache_usage", extractPromptCacheStats(parsed.usage));
        }

        const choice = parsed.choices?.[0];
        const delta = choice?.delta;
        if (!delta) continue;

        if (delta.content) {
          accumulatedContent += delta.content;
          send("text_delta", { text: delta.content });
        }

        if (delta.reasoning_content) {
          accumulatedReasoning += delta.reasoning_content;
          send("reasoning_delta", { text: delta.reasoning_content });
        }

        if (delta.reasoning_details) {
          for (const detail of delta.reasoning_details) {
            reasoningDetails.push(detail as Record<string, unknown>);
            if (detail.text) {
              accumulatedReasoning += detail.text;
              send("reasoning_delta", { text: detail.text });
            }
          }
        }

        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            if (!accumulatedToolCalls[tc.index]) {
              accumulatedToolCalls[tc.index] = {
                id: tc.id ?? "",
                type: tc.type ?? "function",
                function: { name: tc.function?.name ?? "", arguments: "" },
                index: tc.index,
              };
            }
            const slot = accumulatedToolCalls[tc.index];
            if (tc.id) slot.id = tc.id;
            if (tc.function?.name) slot.function.name = tc.function.name;
            if (tc.function?.arguments) {
              slot.function.arguments += tc.function.arguments;
            }
          }
          send("tool_call_streaming", { tool_calls: delta.tool_calls });
        }

        if (choice.finish_reason) finishReason = choice.finish_reason;
      }
    }

    const toolCallsArray = Object.values(accumulatedToolCalls);

    conversation.push({
      role: "assistant",
      content: accumulatedContent || null,
      tool_calls:
        toolCallsArray.length > 0
          ? toolCallsArray.map((tc) => ({
              id: tc.id,
              type: "function" as const,
              function: {
                name: tc.function.name,
                arguments: tc.function.arguments,
              },
            }))
          : undefined,
      reasoning_content: accumulatedReasoning || undefined,
      reasoning_details:
        reasoningDetails.length > 0 ? reasoningDetails : undefined,
    });

    if (finishReason === "tool_calls" && toolCallsArray.length > 0) {
      send("tool_calls_start", {
        tool_calls: toolCallsArray.map((tc) => ({
          id: tc.id,
          name: tc.function.name,
          input: tc.function.arguments,
        })),
      });

      for (const tc of toolCallsArray) {
        send("tool_executing", {
          tool_call_id: tc.id,
          name: tc.function.name,
        });

        try {
          const result = await executePlatformTool(
            tc.function.name as PlatformToolName,
            tc.function.arguments,
            send,
            context,
          );
          send("tool_result", {
            tool_call_id: tc.id,
            name: tc.function.name,
            result,
          });
          conversation.push({
            role: "tool",
            tool_call_id: tc.id,
            content: result,
          });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Tool execution failed";
          send("tool_result", {
            tool_call_id: tc.id,
            name: tc.function.name,
            result: JSON.stringify({ error: message }),
          });
          conversation.push({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify({ error: message }),
          });
        }
      }
      continue;
    }

    send("done", {
      finish_reason: finishReason ?? "stop",
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
        const message = error instanceof Error ? error.message : "Stream failed";
        send("error", { message });
        controller.close();
      }
    },
  });
}
