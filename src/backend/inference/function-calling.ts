import type Anthropic from "@anthropic-ai/sdk";
import {
  buildStructuredOutputTool,
  convertAgentMessagesToAnthropic,
  extractAnthropicText,
} from "@/backend/inference/anthropic-adapter";
import {
  getAnthropicClient,
  DEFAULT_MODEL,
} from "@/backend/inference/anthropic-client";
import { extractPromptCacheStats } from "@/backend/inference/prompt-cache";

export type AnthropicMessageParam = Anthropic.MessageParam;
export type AnthropicTool = Anthropic.Messages.Tool;

export type FunctionCallingStep = {
  type: "assistant" | "tool" | "final";
  message?: unknown;
  toolName?: string;
  toolResult?: string;
};

export async function runFunctionCallingLoop(opts: {
  model?: string;
  messages: AnthropicMessageParam[];
  tools: AnthropicTool[];
  executeTool: (name: string, args: Record<string, unknown>) => Promise<string>;
  maxRounds?: number;
  signal?: AbortSignal;
  onStep?: (step: FunctionCallingStep) => void;
}) {
  const client = getAnthropicClient();
  const model = opts.model ?? DEFAULT_MODEL;
  const conversation = [...opts.messages];
  const steps: FunctionCallingStep[] = [];
  const maxRounds = opts.maxRounds ?? 8;

  for (let round = 0; round < maxRounds; round += 1) {
    const response = await client.messages.create(
      {
        model,
        max_tokens: 8192,
        messages: conversation,
        tools: opts.tools,
        tool_choice: { type: "auto" },
      },
      { signal: opts.signal },
    );

    const usage = extractPromptCacheStats(response.usage);
    const text = extractAnthropicText(response.content);
    const toolUses = response.content.filter(
      (block) => block.type === "tool_use",
    );

    const assistantMessage: AnthropicMessageParam = {
      role: "assistant",
      content: response.content,
    };
    conversation.push(assistantMessage);
    steps.push({ type: "assistant", message: assistantMessage });

    if (response.stop_reason === "tool_use" && toolUses.length > 0) {
      const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];

      for (const toolUse of toolUses) {
        const args = toolUse.input as Record<string, unknown>;
        const result = await opts.executeTool(toolUse.name, args);
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: result,
        });
        steps.push({
          type: "tool",
          toolName: toolUse.name,
          toolResult: result,
          message: toolResults[toolResults.length - 1],
        });
        opts.onStep?.({
          type: "tool",
          toolName: toolUse.name,
          toolResult: result,
        });
      }

      conversation.push({ role: "user", content: toolResults });
      continue;
    }

    const finalMessage = { role: "assistant" as const, content: text };
    steps.push({ type: "final", message: finalMessage });
    opts.onStep?.({ type: "final", message: finalMessage });

    return {
      message: finalMessage,
      conversation,
      steps,
      usage,
      model,
    };
  }

  throw new Error("Function calling exceeded maximum rounds.");
}

/** Final answer turn omits tools. */
export async function runFunctionCallingFinalAnswer(opts: {
  model?: string;
  messages: AnthropicMessageParam[];
  signal?: AbortSignal;
}) {
  const client = getAnthropicClient();
  const response = await client.messages.create(
    {
      model: opts.model ?? DEFAULT_MODEL,
      max_tokens: 8192,
      messages: opts.messages,
    },
    { signal: opts.signal },
  );
  return {
    message: {
      role: "assistant" as const,
      content: extractAnthropicText(response.content),
    },
    usage: extractPromptCacheStats(response.usage),
  };
}

export { convertAgentMessagesToAnthropic, buildStructuredOutputTool };
