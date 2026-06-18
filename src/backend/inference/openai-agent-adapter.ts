import type {
  ChatCompletionMessageParam,
  ChatCompletionMessageFunctionToolCall,
  ChatCompletionMessageToolCall,
  ChatCompletionTool,
} from "openai/resources/chat/completions";
import type { AgentMessage } from "@/backend/inference/novita-agent";
import type { PlatformTool } from "@/backend/inference/platform-tools";
import type { ReasoningAssistantMessage } from "@/backend/inference/reasoning-message-history";

export type AgentToolUse = {
  id: string;
  name: string;
  input: Record<string, unknown>;
};

export function buildStructuredOutputTool(
  schemaName: string,
  schema: Record<string, unknown>,
): PlatformTool {
  return {
    name: schemaName,
    description: "Return structured JSON matching the schema.",
    input_schema: schema as PlatformTool["input_schema"],
  };
}

export function toOpenAiTools(tools: PlatformTool[]): ChatCompletionTool[] {
  return tools.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.input_schema,
    },
  }));
}

export function convertAgentMessagesToOpenAi(messages: AgentMessage[]): {
  system?: string;
  messages: ChatCompletionMessageParam[];
} {
  const systemParts: string[] = [];
  const result: ChatCompletionMessageParam[] = [];

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
      while (index < messages.length && messages[index].role === "tool") {
        const toolMessage = messages[index];
        result.push({
          role: "tool",
          tool_call_id:
            toolMessage.tool_use_id ?? toolMessage.tool_call_id ?? "",
          content:
            typeof toolMessage.content === "string"
              ? toolMessage.content
              : JSON.stringify(toolMessage.content),
        });
        index += 1;
      }
      continue;
    }

    if (message.role === "assistant") {
      const text =
        typeof message.content === "string" ? message.content : "";
      const toolCalls = (message.tool_uses ?? []).map((toolUse) => ({
        id: toolUse.id,
        type: "function" as const,
        function: {
          name: toolUse.name,
          arguments: JSON.stringify(toolUse.input ?? {}),
        },
      }));

      const assistantMessage: ReasoningAssistantMessage = {
        role: "assistant",
        content: text || null,
        ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
      };

      if (message.reasoning_content?.trim()) {
        assistantMessage.reasoning_content = message.reasoning_content;
      }
      if (
        Array.isArray(message.reasoning_details) &&
        message.reasoning_details.length > 0
      ) {
        assistantMessage.reasoning_details = message.reasoning_details;
      } else if (message.thinking?.trim()) {
        assistantMessage.reasoning_content =
          message.reasoning_content ?? message.thinking;
      }

      result.push(assistantMessage);
      index += 1;
      continue;
    }

    if (typeof message.content === "string") {
      result.push({ role: "user", content: message.content });
    } else if (Array.isArray(message.content)) {
      const parts = message.content.map((part) => {
        if (part.type === "text") {
          return { type: "text" as const, text: part.text };
        }
        if (part.type === "image_url") {
          return {
            type: "image_url" as const,
            image_url: part.image_url,
          };
        }
        return { type: "text" as const, text: JSON.stringify(part) };
      });
      if (parts.length > 0) {
        result.push({ role: "user", content: parts });
      }
    }
    index += 1;
  }

  return {
    system: systemParts.length > 0 ? systemParts.join("\n\n") : undefined,
    messages: result,
  };
}

export function isFunctionToolCall(
  call: ChatCompletionMessageToolCall,
): call is ChatCompletionMessageFunctionToolCall {
  return call.type === "function";
}

export function extractOpenAiToolUses(
  toolCalls: ChatCompletionMessageToolCall[] | null | undefined,
): AgentToolUse[] {
  if (!toolCalls?.length) return [];
  return toolCalls.filter(isFunctionToolCall).map((call) => {
    let input: Record<string, unknown> = {};
    try {
      input = JSON.parse(call.function.arguments || "{}") as Record<
        string,
        unknown
      >;
    } catch {
      input = {};
    }
    return {
      id: call.id,
      name: call.function.name,
      input,
    };
  });
}

export function buildAssistantAgentMessageFromOpenAi(response: {
  content?: string | null;
  tool_calls?: ChatCompletionMessageToolCall[];
  reasoning_content?: string | null;
  reasoning_details?: unknown;
}): AgentMessage {
  const reasoningMessage = response as {
    reasoning_content?: string | null;
    reasoning_details?: unknown;
  };

  return {
    role: "assistant",
    content: response.content ?? null,
    tool_uses: extractOpenAiToolUses(response.tool_calls),
    reasoning_content: reasoningMessage.reasoning_content ?? null,
    reasoning_details: reasoningMessage.reasoning_details,
    thinking: reasoningMessage.reasoning_content ?? null,
  };
}

export function prependSystemMessage(
  system: string | undefined,
  messages: ChatCompletionMessageParam[],
): ChatCompletionMessageParam[] {
  if (!system?.trim()) return messages;
  return [{ role: "system", content: system }, ...messages];
}
