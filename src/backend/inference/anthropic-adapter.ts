import type Anthropic from "@anthropic-ai/sdk";
import type { IncomingMessage } from "@/backend/inference/novita";
import type {
  AgentContentPart,
  AgentMessage,
} from "@/backend/inference/novita-agent";

export type AgentToolUse = {
  id: string;
  name: string;
  input: Record<string, unknown>;
};
import { env } from "@/backend/config/env";
import type { ThinkingType } from "@/backend/inference/novita";

export type AnthropicTool = Anthropic.Messages.Tool;

export type AnthropicStreamHandlers = {
  onTextDelta?: (delta: string) => void;
  onThinkingDelta?: (delta: string) => void;
  onToolInputDelta?: (partial: string) => void;
  onToolUseStart?: (tool: { id: string; name: string }) => void;
  onToolUseComplete?: (tool: {
    id: string;
    name: string;
    inputJson: string;
  }) => void;
  onUsage?: (usage: unknown) => void;
  onStopReason?: (reason: string | null) => void;
};

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function convertUserContentParts(
  parts: AgentContentPart[],
): Anthropic.Messages.ContentBlockParam[] {
  const blocks: Anthropic.Messages.ContentBlockParam[] = [];

  for (const part of parts) {
    if (part.type === "text") {
      blocks.push({ type: "text", text: part.text });
      continue;
    }

    if (part.type === "image_url") {
      const url = part.image_url.url;
      if (url.startsWith("data:")) {
        const match = url.match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i);
        if (match) {
          blocks.push({
            type: "image",
            source: {
              type: "base64",
              media_type: match[1] as
                | "image/jpeg"
                | "image/png"
                | "image/gif"
                | "image/webp",
              data: match[2],
            },
          });
        }
      } else if (isHttpUrl(url)) {
        blocks.push({
          type: "image",
          source: { type: "url", url },
        });
      }
      continue;
    }

    if (part.type === "video_url" || part.type === "input_audio") {
      blocks.push({
        type: "text",
        text: `[Attached ${part.type}: ${part.type === "video_url" ? part.video_url.url : part.input_audio.format}]`,
      });
    }
  }

  return blocks;
}

export function convertIncomingToAnthropic(messages: IncomingMessage[]): {
  system?: string;
  messages: Anthropic.MessageParam[];
} {
  const systemParts: string[] = [];
  const result: Anthropic.MessageParam[] = [];
  let hasSystem = false;

  for (const message of messages) {
    if (message.role === "system") {
      hasSystem = true;
      systemParts.push(message.content);
      continue;
    }
    result.push({ role: message.role, content: message.content });
  }

  if (!hasSystem) {
    systemParts.push("Be a helpful assistant.");
  }

  return {
    system: systemParts.join("\n\n"),
    messages: result,
  };
}

export function convertAgentMessagesToAnthropic(messages: AgentMessage[]): {
  system?: string;
  messages: Anthropic.MessageParam[];
} {
  const systemParts: string[] = [];
  const result: Anthropic.MessageParam[] = [];

  let index = 0;
  while (index < messages.length) {
    const message = messages[index];

    if (message.role === "system") {
      if (typeof message.content === "string") {
        systemParts.push(message.content);
      }
      index += 1;
      continue;
    }

    if (message.role === "tool") {
      const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];
      while (index < messages.length && messages[index].role === "tool") {
        const toolMessage = messages[index];
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolMessage.tool_use_id ?? toolMessage.tool_call_id ?? "",
          content:
            typeof toolMessage.content === "string"
              ? toolMessage.content
              : JSON.stringify(toolMessage.content),
        });
        index += 1;
      }
      result.push({ role: "user", content: toolResults });
      continue;
    }

    if (message.role === "assistant") {
      const blocks: Anthropic.Messages.ContentBlockParam[] = [];

      if (message.thinking) {
        blocks.push({
          type: "thinking",
          thinking: message.thinking,
          signature: "",
        });
      }

      if (typeof message.content === "string" && message.content) {
        blocks.push({ type: "text", text: message.content });
      }

      if (message.tool_uses?.length) {
        for (const toolUse of message.tool_uses) {
          blocks.push({
            type: "tool_use",
            id: toolUse.id,
            name: toolUse.name,
            input: toolUse.input,
          });
        }
      }

      result.push({
        role: "assistant",
        content: blocks.length > 0 ? blocks : [{ type: "text", text: "" }],
      });
      index += 1;
      continue;
    }

    if (typeof message.content === "string") {
      result.push({ role: "user", content: message.content });
    } else if (Array.isArray(message.content)) {
      const blocks = convertUserContentParts(message.content);
      if (blocks.length > 0) {
        result.push({ role: "user", content: blocks });
      }
    }
    index += 1;
  }

  return {
    system: systemParts.length > 0 ? systemParts.join("\n\n") : undefined,
    messages: result,
  };
}

export function buildAnthropicChatParams(
  messages: IncomingMessage[],
  options: {
    stream?: boolean;
    thinkingType?: ThinkingType;
    maxTokens?: number;
    temperature?: number;
  } = {},
): Anthropic.MessageCreateParams {
  const { system, messages: anthropicMessages } =
    convertIncomingToAnthropic(messages);
  const thinkingEnabled = (options.thinkingType ?? "disabled") === "enabled";

  return {
    model: env.defaultModel,
    max_tokens: options.maxTokens ?? 131072,
    temperature: options.temperature ?? 1,
    system,
    messages: anthropicMessages,
    stream: options.stream ?? true,
    thinking: thinkingEnabled
      ? { type: "enabled", budget_tokens: 8192 }
      : undefined,
  };
}

export function buildStructuredOutputTool(
  schemaName: string,
  schema: Record<string, unknown>,
): AnthropicTool {
  return {
    name: schemaName,
    description: "Return structured JSON matching the schema.",
    input_schema: schema as Anthropic.Messages.Tool.InputSchema,
  };
}

export function extractAnthropicText(
  content: Anthropic.Messages.ContentBlock[] | undefined,
): string {
  if (!content?.length) return "";
  return content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");
}

export function extractAnthropicThinking(
  content: Anthropic.Messages.ContentBlock[] | undefined,
): string {
  if (!content?.length) return "";
  return content
    .filter((block) => block.type === "thinking")
    .map((block) => block.thinking)
    .join("");
}

export function extractAnthropicToolUses(
  content: Anthropic.Messages.ContentBlock[] | undefined,
): AgentToolUse[] {
  if (!content?.length) return [];
  return content
    .filter((block) => block.type === "tool_use")
    .map((block) => ({
      id: block.id,
      name: block.name,
      input: (block.input ?? {}) as Record<string, unknown>,
    }));
}

export function buildAssistantAgentMessage(
  content: Anthropic.Messages.ContentBlock[],
): AgentMessage {
  return {
    role: "assistant",
    content: extractAnthropicText(content) || null,
    thinking: extractAnthropicThinking(content) || null,
    tool_uses: extractAnthropicToolUses(content),
  };
}

export async function consumeAnthropicMessageStream(
  stream: AsyncIterable<Anthropic.Messages.RawMessageStreamEvent>,
  handlers: AnthropicStreamHandlers,
  signal?: AbortSignal,
) {
  let currentTool: { id: string; name: string; inputJson: string } | null =
    null;

  try {
    for await (const event of stream) {
      if (signal?.aborted) return;
      if (event.type === "message_start" && event.message.usage) {
        handlers.onUsage?.(event.message.usage);
      }

      if (event.type === "content_block_start") {
        if (event.content_block.type === "tool_use") {
          currentTool = {
            id: event.content_block.id,
            name: event.content_block.name,
            inputJson: "",
          };
          handlers.onToolUseStart?.({
            id: currentTool.id,
            name: currentTool.name,
          });
        }
      }

      if (event.type === "content_block_delta") {
        if (event.delta.type === "text_delta") {
          handlers.onTextDelta?.(event.delta.text);
        }
        if (event.delta.type === "thinking_delta") {
          handlers.onThinkingDelta?.(event.delta.thinking);
        }
        if (event.delta.type === "input_json_delta" && currentTool) {
          currentTool.inputJson += event.delta.partial_json;
          handlers.onToolInputDelta?.(event.delta.partial_json);
        }
      }

      if (event.type === "content_block_stop" && currentTool) {
        handlers.onToolUseComplete?.({ ...currentTool });
        currentTool = null;
      }

      if (event.type === "message_delta") {
        handlers.onStopReason?.(event.delta.stop_reason ?? null);
        if (event.usage) {
          handlers.onUsage?.(event.usage);
        }
      }
    }
  } catch (error) {
    if (signal?.aborted) return;
    throw error;
  }
}
