import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type { ResponseInputItem } from "openai/resources/responses/responses";
import { buildFunctionCallOutput } from "@/autonomous-agent/server/logic/decision-surface";
import { toolLabelForUi } from "@/autonomous-agent/server/logic/tool-steering";
import {
  executeTool,
  type ToolExecutionContext,
} from "@/autonomous-agent/server/tools/executor";
import type { EventSink } from "@/autonomous-agent/server/stream/run-turn";
import { parseToolCallArgs } from "@/autonomous-agent/server/stream/normalizer";
import type { PendingToolCall } from "@/autonomous-agent/server/stream/normalizer";
import { stamp } from "@/autonomous-agent/types/events";

export type ToolLoopResult = {
  pauseForUser: boolean;
  clarification?: { toolCallId: string; question: string };
  /** Chat Completions tool messages to append. */
  chatMessages: ChatCompletionMessageParam[];
  /** Responses API function_call_output items to append. */
  responseItems: ResponseInputItem[];
};

export type ToolLoopOptions = ToolExecutionContext & {
  onTurnToolProgress?: (
    toolCallId: string,
    data: Record<string, unknown>,
  ) => void;
};

/**
 * Execute every tool call from a completed model turn.
 * Errors become function_call_output — never crash the loop.
 */
export async function executePendingToolCalls(
  toolCalls: PendingToolCall[],
  sink: EventSink,
  options: ToolLoopOptions,
): Promise<ToolLoopResult> {
  const chatMessages: ChatCompletionMessageParam[] = [];
  const responseItems: ResponseInputItem[] = [];
  let pauseForUser = false;
  let clarification: { toolCallId: string; question: string } | undefined;

  for (const call of toolCalls) {
    if (!call.id || !call.name) continue;

    sink.send(stamp({ type: "ToolCallEnd", toolCallId: call.id }));

    const args = parseToolCallArgs(call.argsBuffer);
    let output: unknown;

    try {
      const result = await executeTool(call.name, args, {
        conversationId: options.conversationId,
        userId: options.userId,
        userCountryCode: options.userCountryCode,
        toolCallId: call.id,
        onToolProgress: (data) => {
          sink.send(
            stamp({
              type: "ToolCallProgress",
              toolCallId: call.id,
              data,
            }),
          );
          options.onTurnToolProgress?.(call.id, data);
        },
      });
      output = result.output;

      if (result.pauseForUser && result.clarificationQuestion) {
        pauseForUser = true;
        clarification = {
          toolCallId: call.id,
          question: result.clarificationQuestion,
        };
        sink.send(
          stamp({
            type: "ClarificationRequested",
            toolCallId: call.id,
            question: result.clarificationQuestion,
          }),
        );
      }
    } catch (err) {
      output = { error: err instanceof Error ? err.message : String(err) };
    }

    sink.send(
      stamp({
        type: "ToolCallResult",
        toolCallId: call.id,
        content: output,
      }),
    );

    sink.send(
      stamp({
        type: "StepDone",
        toolCallId: call.id,
        label: toolLabelForUi(call.name),
      }),
    );

    const serialized =
      typeof output === "string" ? output : JSON.stringify(output);

    chatMessages.push({
      role: "tool",
      tool_call_id: call.id,
      content: serialized,
    });

    responseItems.push(buildFunctionCallOutput(call.id, output));
  }

  return {
    pauseForUser,
    clarification,
    chatMessages,
    responseItems,
  };
}
