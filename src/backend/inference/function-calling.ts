import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import {
  buildStructuredOutputTool,
  convertAgentMessagesToOpenAi,
  isFunctionToolCall,
  prependSystemMessage,
  toOpenAiTools,
} from "@/backend/inference/openai-agent-adapter";
import {
  DEFAULT_MODEL,
  getOpenAIClient,
} from "@/backend/inference/openai-client";
import { extractPromptCacheStats } from "@/backend/inference/prompt-cache";
import type { PlatformTool } from "@/backend/inference/platform-tools";

export type OpenAiMessageParam = ChatCompletionMessageParam;
export type OpenAiTool = PlatformTool;

export type FunctionCallingStep = {
  type: "assistant" | "tool" | "final";
  message?: unknown;
  toolName?: string;
  toolResult?: string;
};

export async function runFunctionCallingLoop(opts: {
  model?: string;
  messages: OpenAiMessageParam[];
  tools: OpenAiTool[];
  executeTool: (name: string, args: Record<string, unknown>) => Promise<string>;
  maxRounds?: number;
  signal?: AbortSignal;
  onStep?: (step: FunctionCallingStep) => void;
}) {
  const client = getOpenAIClient();
  const model = opts.model ?? DEFAULT_MODEL;
  const conversation = [...opts.messages];
  const steps: FunctionCallingStep[] = [];
  const maxRounds = opts.maxRounds ?? 8;
  const openAiTools = toOpenAiTools(opts.tools);

  for (let round = 0; round < maxRounds; round += 1) {
    const response = await client.chat.completions.create(
      {
        model,
        max_tokens: 8192,
        messages: conversation,
        tools: openAiTools,
        tool_choice: "auto",
      },
      { signal: opts.signal },
    );

    const choice = response.choices[0]?.message;
    if (!choice) break;

    const usage = extractPromptCacheStats(response.usage);
    const text = choice.content ?? "";
    const toolCalls = choice.tool_calls ?? [];

    const assistantMessage: OpenAiMessageParam = {
      role: "assistant",
      content: text || null,
      ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
    };
    conversation.push(assistantMessage);
    steps.push({ type: "assistant", message: assistantMessage });

    if (toolCalls.length > 0) {
      for (const toolCall of toolCalls.filter(isFunctionToolCall)) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(toolCall.function.arguments || "{}") as Record<
            string,
            unknown
          >;
        } catch {
          args = {};
        }
        const result = await opts.executeTool(toolCall.function.name, args);
        const toolMessage: OpenAiMessageParam = {
          role: "tool",
          tool_call_id: toolCall.id,
          content: result,
        };
        conversation.push(toolMessage);
        steps.push({
          type: "tool",
          toolName: toolCall.function.name,
          toolResult: result,
          message: toolMessage,
        });
        opts.onStep?.({
          type: "tool",
          toolName: toolCall.function.name,
          toolResult: result,
        });
      }
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

  throw new Error("Function calling loop exceeded max rounds.");
}

export async function runStructuredFunctionCall(opts: {
  model?: string;
  schemaName: string;
  schema: Record<string, unknown>;
  prompt: string;
  systemPrompt?: string;
  signal?: AbortSignal;
}) {
  const tool = buildStructuredOutputTool(opts.schemaName, opts.schema);
  const messages = prependSystemMessage(
    opts.systemPrompt,
    [{ role: "user", content: opts.prompt }],
  );

  return runFunctionCallingLoop({
    model: opts.model ?? DEFAULT_MODEL,
    messages,
    tools: [tool],
    executeTool: async () => "",
    maxRounds: 1,
    signal: opts.signal,
  });
}

export { convertAgentMessagesToOpenAi };
