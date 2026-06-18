import type { ResponseInputItem } from "openai/resources/responses/responses";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import {
  clearPendingItems,
  getPendingItems,
  setActiveRun,
  setConversationStatus,
  setPendingClarification,
} from "@/autonomous-agent/server/store/conversation-store";
import {
  appendRunEvent,
  finishRunLog,
  pruneOldRuns,
  startRunLog,
} from "@/autonomous-agent/server/store/event-log";
import {
  runAgentLoop,
  type EventSink,
  type RunTurnOptions,
} from "@/autonomous-agent/server/stream/run-turn";
import type { NormalizedEvent } from "@/autonomous-agent/types/events";

/** Map stored conversation items to Chat Completions messages. */
export function pendingItemsToChatMessages(
  items: ResponseInputItem[],
): ChatCompletionMessageParam[] {
  const out: ChatCompletionMessageParam[] = [];
  for (const item of items) {
    if (item.type === "message") {
      const role = item.role;
      if (role === "user" || role === "assistant") {
        out.push({
          role,
          content:
            typeof item.content === "string"
              ? item.content
              : JSON.stringify(item.content),
        });
      }
    } else if (item.type === "function_call_output") {
      const output =
        typeof item.output === "string"
          ? item.output
          : JSON.stringify(item.output);
      out.push({
        role: "tool",
        tool_call_id: item.call_id,
        content: output,
      });
    }
  }
  return out;
}

function wrapSinkWithEventLog(
  conversationId: string,
  sink: EventSink,
): EventSink {
  let runId: string | null = null;

  return {
    isOpen: () => sink.isOpen(),
    send(event: NormalizedEvent) {
      if (event.type === "RunStarted") {
        runId = event.runId;
        setActiveRun(conversationId, runId);
        startRunLog(runId, conversationId);
      }
      if (runId) appendRunEvent(runId, event);

      if (event.type === "ClarificationRequested") {
        setPendingClarification(conversationId, {
          toolCallId: event.toolCallId,
          question: event.question,
        });
        setConversationStatus(conversationId, "waiting_for_user");
      }

      if (event.type === "RunFinished") {
        if (runId) finishRunLog(runId);
        setActiveRun(conversationId, null);
        setConversationStatus(conversationId, "idle");
        clearPendingItems(conversationId);
        pruneOldRuns();
      }

      if (event.type === "RunError") {
        if (runId) finishRunLog(runId);
        setActiveRun(conversationId, null);
        setConversationStatus(conversationId, "error");
      }

      sink.send(event);
    },
  };
}

/**
 * Conversation-scoped agent turn — used by SSE API and WebSocket server.
 * Loads pending items from the store, runs the completions loop, logs events for replay.
 */
export async function runConversationTurn(
  conversationId: string,
  sink: EventSink,
  options: Omit<RunTurnOptions, "conversationId"> = {},
): Promise<void> {
  const messages = pendingItemsToChatMessages(getPendingItems(conversationId));
  if (messages.length === 0) {
    sink.send({
      type: "RunError",
      conversationId,
      message: "No messages in conversation.",
      timestamp: Date.now(),
    });
    return;
  }

  setConversationStatus(conversationId, "running");
  const loggingSink = wrapSinkWithEventLog(conversationId, sink);

  await runAgentLoop(messages, loggingSink, {
    ...options,
    conversationId,
  });
}
