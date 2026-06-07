import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat/completions";
import { getNovitaClient, DEFAULT_MODEL } from "@/backend/inference/novita-client";
import { extractPromptCacheStats } from "@/backend/inference/prompt-cache";

export type FunctionCallingStep = {
  type: "assistant" | "tool" | "final";
  message?: unknown;
  toolName?: string;
  toolResult?: string;
};

export async function runFunctionCallingLoop(opts: {
  model?: string;
  messages: ChatCompletionMessageParam[];
  tools: ChatCompletionTool[];
  executeTool: (
    name: string,
    args: Record<string, unknown>,
  ) => Promise<string>;
  maxRounds?: number;
  signal?: AbortSignal;
  onStep?: (step: FunctionCallingStep) => void;
}) {
  const client = getNovitaClient();
  const model = opts.model ?? DEFAULT_MODEL;
  const conversation = [...opts.messages];
  const steps: FunctionCallingStep[] = [];
  const maxRounds = opts.maxRounds ?? 8;

  for (let round = 0; round < maxRounds; round += 1) {
    const response = await client.chat.completions.create(
      {
        model,
        messages: conversation,
        tools: opts.tools,
        tool_choice: "auto",
        stream: false,
      },
      { signal: opts.signal },
    );

    const choice = response.choices[0];
    const message = choice.message;
    const usage = extractPromptCacheStats(response.usage);

    conversation.push(message as ChatCompletionMessageParam);
    steps.push({ type: "assistant", message });

    if (choice.finish_reason === "tool_calls" && message.tool_calls?.length) {
      for (const toolCall of message.tool_calls) {
        if (toolCall.type !== "function") continue;
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
        } catch {
          args = {};
        }

        const result = await opts.executeTool(toolCall.function.name, args);
        const toolMessage: ChatCompletionMessageParam = {
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

    steps.push({ type: "final", message });
    opts.onStep?.({ type: "final", message });

    return {
      message,
      conversation,
      steps,
      usage,
      model,
    };
  }

  throw new Error("Function calling exceeded maximum rounds.");
}

/** Final answer turn omits tools per Novita function-calling guide. */
export async function runFunctionCallingFinalAnswer(opts: {
  model?: string;
  messages: ChatCompletionMessageParam[];
  signal?: AbortSignal;
}) {
  const client = getNovitaClient();
  const response = await client.chat.completions.create(
    {
      model: opts.model ?? DEFAULT_MODEL,
      messages: opts.messages,
      stream: false,
    },
    { signal: opts.signal },
  );
  return {
    message: response.choices[0].message,
    usage: extractPromptCacheStats(response.usage),
  };
}
