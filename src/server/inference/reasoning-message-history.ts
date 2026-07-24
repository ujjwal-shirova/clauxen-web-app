import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { stripMessageContentForModelApi } from "@/lib/model-context";

export type ReasoningToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export type AssistantTurn = {
  content: string | null;
  reasoning_content?: string;
  reasoning_details?: unknown[];
  tool_calls?: ReasoningToolCall[];
};

/** Novita / DeepSeek assistant message shape with interleaved thinking fields. */
export type ReasoningAssistantMessage = ChatCompletionMessageParam & {
  reasoning_content?: string;
  reasoning_details?: unknown[];
};

export function appendAssistantTurn(
  history: ChatCompletionMessageParam[],
  turn: AssistantTurn,
): ChatCompletionMessageParam[] {
  const message: ReasoningAssistantMessage = {
    role: "assistant",
    content: turn.content ?? null,
  };

  if (turn.reasoning_content?.trim()) {
    message.reasoning_content = turn.reasoning_content;
  }
  if (turn.reasoning_details?.length) {
    message.reasoning_details = turn.reasoning_details;
  }
  if (turn.tool_calls?.length) {
    message.tool_calls = turn.tool_calls;
  }

  return [...history, message];
}

export function appendToolResults(
  history: ChatCompletionMessageParam[],
  results: Array<{ tool_call_id: string; content: string }>,
): ChatCompletionMessageParam[] {
  const toolMessages: ChatCompletionMessageParam[] = results.map((result) => ({
    role: "tool",
    tool_call_id: result.tool_call_id,
    content: result.content,
  }));
  return [...history, ...toolMessages];
}

export function incomingMessagesToOpenAi(
  messages: Array<{ role: string; content: string }>,
): ChatCompletionMessageParam[] {
  return messages
    .filter((m) => m.content.trim().length > 0)
    .map((m) => ({
      role: m.role as "user" | "assistant" | "system",
      content: stripMessageContentForModelApi(m.content),
    }));
}
