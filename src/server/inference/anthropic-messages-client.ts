/**
 * Provider / Novita Messages API streaming client for Clauxen Web.
 *
 * Auth: Provider_API_Key only (Vercel). Base URL from Provider_BASE_URL
 * (`…/openai` → `…/anthropic`). No Anthropic OAuth / Bedrock / Vertex / Foundry.
 *
 * Used by @/server/agent-core. Protocol: Anthropic Messages
 * via @anthropic-ai/sdk against the Provider gateway.
 */

import Anthropic from "@anthropic-ai/sdk";
import {
  requireProviderApiKey,
  requireAnthropicBaseUrl,
} from "@/server/config/env";

export type AnthropicToolDefinition = {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
};

export type AnthropicChatMessage = {
  role: "user" | "assistant";
  content: string | Anthropic.ContentBlockParam[];
};

export type AnthropicStreamPart =
  | { type: "reasoning-delta"; delta: string }
  | { type: "text-delta"; delta: string }
  | { type: "tool-call-start"; toolCallId: string; toolName: string }
  | {
      type: "tool-call-delta";
      toolCallId: string;
      argumentsDelta: string;
    }
  | {
      type: "tool-call-end";
      toolCallId: string;
      toolName: string;
      arguments: string;
    }
  | {
      type: "finish";
      reason: string;
      /** Exact API blocks, including signed/redacted thinking, for replay. */
      content: Anthropic.ContentBlock[];
    }
  | { type: "error"; error: string }
  | { type: "abort" };

export type AnthropicCompletionOptions = {
  model: string;
  system?: string;
  messages: AnthropicChatMessage[];
  tools?: AnthropicToolDefinition[];
  max_tokens?: number;
  temperature?: number;
  signal?: AbortSignal;
  /** Extended thinking budget tokens (0 = off). */
  thinkingBudgetTokens?: number;
};

function createClient(): Anthropic {
  return new Anthropic({
    apiKey: requireProviderApiKey(),
    baseURL: requireAnthropicBaseUrl(),
  });
}

/**
 * Stream one Anthropic Messages turn. Yields the same part shapes the
 * autonomous agent engine already understands (reasoning/text/tools).
 */
export async function* streamAnthropicMessages(
  options: AnthropicCompletionOptions,
): AsyncGenerator<AnthropicStreamPart> {
  const client = createClient();
  const maxTokens = options.max_tokens ?? 8192;

  const tools =
    options.tools && options.tools.length > 0
      ? options.tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          input_schema: tool.input_schema as Anthropic.Tool.InputSchema,
        }))
      : undefined;

  const thinking =
    options.thinkingBudgetTokens && options.thinkingBudgetTokens > 0
      ? ({
          type: "enabled" as const,
          budget_tokens: options.thinkingBudgetTokens,
        } as const)
      : undefined;

  let stream: ReturnType<typeof client.messages.stream>;
  try {
    stream = client.messages.stream(
      {
        model: options.model,
        max_tokens: maxTokens,
        system: options.system,
        messages: options.messages as Anthropic.MessageParam[],
        tools,
        ...(thinking ? { thinking } : {}),
        // Anthropic does not allow temperature changes with extended thinking.
        ...(!thinking && typeof options.temperature === "number"
          ? { temperature: options.temperature }
          : {}),
      },
      {
        signal: options.signal,
        ...(thinking
          ? {
              headers: {
                "anthropic-beta": "interleaved-thinking-2025-05-14",
              },
            }
          : {}),
      },
    );
  } catch (error) {
    if (options.signal?.aborted) {
      yield { type: "abort" };
      return;
    }
    yield {
      type: "error",
      error: error instanceof Error ? error.message : String(error),
    };
    return;
  }

  // Track open content blocks for tool_use argument accumulation.
  const openTools = new Map<
    number,
    { id: string; name: string; args: string }
  >();
  let stopReason = "end_turn";

  try {
    for await (const event of stream) {
      if (options.signal?.aborted) {
        yield { type: "abort" };
        return;
      }

      switch (event.type) {
        case "content_block_start": {
          const block = event.content_block;
          if (block.type === "thinking") {
            // thinking deltas arrive as thinking_delta
            break;
          }
          if (block.type === "text") {
            break;
          }
          if (block.type === "tool_use") {
            openTools.set(event.index, {
              id: block.id,
              name: block.name,
              args: "",
            });
            yield {
              type: "tool-call-start",
              toolCallId: block.id,
              toolName: block.name,
            };
          }
          break;
        }

        case "content_block_delta": {
          const delta = event.delta;
          if (delta.type === "thinking_delta") {
            yield { type: "reasoning-delta", delta: delta.thinking };
            break;
          }
          if (delta.type === "text_delta") {
            yield { type: "text-delta", delta: delta.text };
            break;
          }
          if (delta.type === "input_json_delta") {
            const entry = openTools.get(event.index);
            if (entry) {
              entry.args += delta.partial_json;
              yield {
                type: "tool-call-delta",
                toolCallId: entry.id,
                argumentsDelta: delta.partial_json,
              };
            }
          }
          break;
        }

        case "content_block_stop": {
          const entry = openTools.get(event.index);
          if (entry) {
            yield {
              type: "tool-call-end",
              toolCallId: entry.id,
              toolName: entry.name,
              arguments: entry.args || "{}",
            };
            openTools.delete(event.index);
          }
          break;
        }

        case "message_delta": {
          if (event.delta.stop_reason) {
            stopReason = event.delta.stop_reason;
          }
          break;
        }

        case "message_stop":
          break;

        default:
          break;
      }
    }

    const finalMessage = await stream.finalMessage();
    yield {
      type: "finish",
      reason: finalMessage.stop_reason ?? stopReason,
      content: finalMessage.content,
    };
  } catch (error) {
    if (options.signal?.aborted) {
      yield { type: "abort" };
      return;
    }
    yield {
      type: "error",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Build Anthropic tool defs from the web autonomous tool catalog shape. */
export function toAnthropicTools(
  tools: Array<{
    name: string;
    description?: string | null;
    parameters: Record<string, unknown>;
  }>,
): AnthropicToolDefinition[] {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description ?? tool.name,
    input_schema: {
      type: "object",
      ...(tool.parameters ?? {}),
    },
  }));
}
