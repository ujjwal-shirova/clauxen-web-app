import { env } from "@/backend/config/env";
import {
  convertAgentMessagesToOpenAi,
  prependSystemMessage,
  toOpenAiTools,
} from "@/backend/inference/openai-agent-adapter";
import { getOpenAIClient } from "@/backend/inference/openai-client";
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
import { buildStructuredOutputTool } from "@/backend/inference/openai-agent-adapter";
import { buildModelSystemPrompt } from "@/backend/inference/system-prompt";
import { buildUserPersonalizationAppend } from "@/backend/services/user-personalization.service";
import { loadFollowUpSuggestionsEnabled } from "@/backend/services/follow-up-settings.service";
import { buildFollowUpSystemInstruction } from "@/lib/follow-up-prompt";

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

type NovitaStreamDelta = {
  content?: string | null;
  reasoning_content?: string | null;
  tool_calls?: Array<{
    index?: number;
    id?: string;
    function?: { name?: string; arguments?: string };
  }>;
};

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

async function buildSystemPromptAsync(request: AgentChatRequest) {
  const logicalModel =
    (request as any).chatModel ||
    (typeof request.model === "string" ? request.model : undefined) ||
    "virgil";

  const titleInstr = request.generateChatTitle
    ? "When the conversation has a clear topic, output a short title (3-6 words) for the sidebar."
    : "";

  const userId = (request as { userId?: string }).userId;
  const [personalization, followUpsEnabled] = await Promise.all([
    buildUserPersonalizationAppend(userId),
    loadFollowUpSuggestionsEnabled(userId),
  ]);
  const followUpInstr = followUpsEnabled
    ? buildFollowUpSystemInstruction()
    : "";
  const append = [personalization, titleInstr, followUpInstr]
    .map((part) => part.trim())
    .filter(Boolean)
    .join("\n\n");

  const full = buildModelSystemPrompt({
    model: logicalModel,
    append: append || undefined,
  });
  return buildCacheableSystemPrefix(full);
}

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

type PendingToolCall = {
  id: string;
  name: string;
  arguments: string;
};

function splitThinkingFromAnswer(
  delta: string,
  state: { inThink: boolean },
): { reasoning: string; answer: string } {
  const THINK_OPEN = "<" + "think" + ">";
  const THINK_CLOSE = "<" + "/" + "think" + ">";
  let remaining = delta;
  let reasoning = "";
  let answer = "";

  while (remaining.length > 0) {
    if (state.inThink) {
      const closeIdx = remaining.indexOf(THINK_CLOSE);
      if (closeIdx === -1) {
        reasoning += remaining;
        remaining = "";
      } else {
        reasoning += remaining.slice(0, closeIdx);
        remaining = remaining.slice(closeIdx + THINK_CLOSE.length);
        state.inThink = false;
      }
      continue;
    }

    const openIdx = remaining.indexOf(THINK_OPEN);
    if (openIdx === -1) {
      answer += remaining;
      remaining = "";
    } else {
      answer += remaining.slice(0, openIdx);
      remaining = remaining.slice(openIdx + THINK_OPEN.length);
      state.inThink = true;
    }
  }

  return { reasoning, answer };
}

export type AgentStreamContext = {
  userId?: string;
  conversationId?: string;
  userCountryCode?: string;
};

export async function streamNovitaAgentChat(
  request: AgentChatRequest,
  send: ToolEventSender,
  signal?: AbortSignal,
  context?: AgentStreamContext,
) {
  const client = getOpenAIClient();
  const model = request.model?.trim() || env.defaultModel;
  const platformToolList = resolveAgentTools(request);
  const structuredTools = resolveStructuredTools(request);
  const tools = structuredTools ?? platformToolList;
  const openAiTools = tools?.length ? toOpenAiTools(tools) : undefined;
  const thinkingEnabled = Boolean(request.enableThinking);
  const thinkState = { inThink: false };

  const conversation: AgentMessage[] = [
    { role: "system", content: await buildSystemPromptAsync({
      ...request,
      ...(context?.userId ? { userId: context.userId } : {}),
    } as AgentChatRequest) },
    ...(request.messages ?? []),
  ];

  let loopCount = 0;
  let finalUsage: unknown = null;
  let accumulatedContent = "";

  while (loopCount < MAX_LOOPS) {
    if (signal?.aborted) break;
    loopCount += 1;

    const { system, messages } = convertAgentMessagesToOpenAi(conversation);
    const stream = await client.chat.completions.create(
      {
        model,
        max_tokens: 8192,
        temperature: thinkingEnabled ? 1 : 0.6,
        messages: prependSystemMessage(system, messages),
        stream: true,
        tools: openAiTools,
        tool_choice:
          structuredTools?.length === 1
            ? { type: "function", function: { name: "clauxen_agent_result" } }
            : openAiTools?.length
              ? "auto"
              : undefined,
      },
      { signal },
    );

    const pendingByIndex = new Map<number, PendingToolCall>();
    let assistantContent = "";
    let reasoningContent = "";

    for await (const chunk of stream) {
      if (signal?.aborted) break;
      if (chunk.usage) {
        finalUsage = chunk.usage;
        send("cache_usage", extractPromptCacheStats(chunk.usage));
      }

      const delta = chunk.choices[0]?.delta as NovitaStreamDelta | undefined;
      if (!delta) continue;

      if (delta.reasoning_content) {
        reasoningContent += delta.reasoning_content;
        send("reasoning_delta", { text: delta.reasoning_content });
      }

      if (delta.content) {
        assistantContent += delta.content;
        accumulatedContent += delta.content;
        if (thinkingEnabled && !delta.reasoning_content) {
          const split = splitThinkingFromAnswer(delta.content, thinkState);
          if (split.reasoning) {
            send("reasoning_delta", { text: split.reasoning });
          }
          if (split.answer) {
            send("text_delta", { text: split.answer });
          }
        } else {
          send("text_delta", { text: delta.content });
        }
      }

      if (delta.tool_calls) {
        for (const toolDelta of delta.tool_calls) {
          const index = toolDelta.index ?? 0;
          const current = pendingByIndex.get(index) ?? {
            id: toolDelta.id ?? "",
            name: toolDelta.function?.name ?? "",
            arguments: "",
          };
          if (toolDelta.id) current.id = toolDelta.id;
          if (toolDelta.function?.name) current.name = toolDelta.function.name;
          if (toolDelta.function?.arguments) {
            current.arguments += toolDelta.function.arguments;
          }
          pendingByIndex.set(index, current);
          send("tool_call_streaming", {
            tool_calls: [
              {
                id: current.id,
                name: current.name,
                input: current.arguments,
              },
            ],
          });
        }
      }
    }

    const toolCalls = [...pendingByIndex.entries()]
      .sort(([a], [b]) => a - b)
      .map(([, call]) => call)
      .filter((call) => call.id && call.name);

    if (toolCalls.length === 0) {
      send("done", {
        finish_reason: "stop",
        usage: finalUsage,
        cache: extractPromptCacheStats(finalUsage),
      });
      return {
        content: accumulatedContent,
        reasoning: "",
        usage: finalUsage,
        model,
      };
    }

    conversation.push({
      role: "assistant",
      content: assistantContent || null,
      ...(reasoningContent ? { reasoning_content: reasoningContent } : {}),
      tool_uses: toolCalls.map((call) => {
        let input: Record<string, unknown> = {};
        try {
          input = JSON.parse(call.arguments || "{}") as Record<string, unknown>;
        } catch {
          input = {};
        }
        return { id: call.id, name: call.name, input };
      }),
    });

    send("tool_calls_start", {
      tool_calls: toolCalls.map((call) => ({
        id: call.id,
        name: call.name,
        input: call.arguments,
      })),
    });

    for (const call of toolCalls) {
      if (signal?.aborted) break;
      let parsedArgs: Record<string, unknown> = {};
      try {
        parsedArgs = JSON.parse(call.arguments || "{}") as Record<
          string,
          unknown
        >;
      } catch {
        parsedArgs = {};
      }

      send("tool_executing", {
        tool_call_id: call.id,
        name: call.name,
        args: parsedArgs,
        description:
          typeof parsedArgs.description === "string"
            ? parsedArgs.description
            : undefined,
      });

      try {
        const result = await executePlatformTool(
          call.name as PlatformToolName,
          call.arguments,
          send,
          { ...context, toolCallId: call.id },
        );
        send("tool_result", {
          tool_call_id: call.id,
          name: call.name,
          result,
        });
        conversation.push({
          role: "tool",
          tool_use_id: call.id,
          content: result,
        });

        if (call.name === "ask_user_input_v0") {
          send("done", {
            finish_reason: "stop",
            usage: finalUsage,
            cache: extractPromptCacheStats(finalUsage),
          });
          return {
            content: accumulatedContent,
            reasoning: "",
            usage: finalUsage,
            model,
          };
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Tool execution failed";
        send("tool_result", {
          tool_call_id: call.id,
          name: call.name,
          result: JSON.stringify({ error: message }),
        });
        conversation.push({
          role: "tool",
          tool_use_id: call.id,
          content: JSON.stringify({ error: message }),
        });
      }
    }
  }

  send("done", { finish_reason: "max_loops", usage: finalUsage });
  return { content: accumulatedContent, reasoning: "", usage: finalUsage, model };
}

export function createAgentSseStream(
  request: AgentChatRequest,
  signal?: AbortSignal,
  context?: AgentStreamContext,
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
