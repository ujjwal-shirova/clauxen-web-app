import type { ResponseStreamEvent } from "openai/resources/responses/responses";
import { autonomousAgentConfig } from "@/autonomous-agent/server/config";
import { assertNoSystemInjection } from "@/autonomous-agent/server/logic/decision-surface";
import { getAutonomousAgentOpenAI } from "@/autonomous-agent/server/openai";
import {
  appendFunctionCallOutputs,
  clearPendingItems,
  getLastResponseId,
  getPendingItems,
  saveLastResponseId,
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
import { autonomousAgentTools } from "@/autonomous-agent/server/tools/definitions";
import {
  createNormalizerState,
  normalizeStreamEvent,
  type PendingToolCall,
} from "@/autonomous-agent/server/stream/normalizer";
import type { EventSink, RunTurnOptions } from "@/autonomous-agent/server/stream/run-turn";
import { executePendingToolCalls } from "@/autonomous-agent/server/stream/tool-loop";
import { stamp } from "@/autonomous-agent/types/events";

/**
 * OpenAI Responses API agent loop (for providers that expose /v1/responses).
 * Main chat uses Chat Completions via runAgentLoop on Novita.
 */
export async function runResponsesTurn(
  conversationId: string,
  sink: EventSink,
  options: RunTurnOptions = {},
): Promise<void> {
  const openai = getAutonomousAgentOpenAI(options.baseUrl);
  const model = options.model ?? autonomousAgentConfig.defaultModel;
  let lastResponseId = getLastResponseId(conversationId);
  let conversationItems = [...getPendingItems(conversationId)];
  assertNoSystemInjection(conversationItems);
  let iterations = 0;
  const { maxIterations } = autonomousAgentConfig;

  setConversationStatus(conversationId, "running");

  while (iterations++ < maxIterations) {
    if (!sink.isOpen()) return;

    const stream = await openai.responses.create({
      model,
      input: conversationItems,
      previous_response_id: lastResponseId ?? undefined,
      tools: autonomousAgentTools,
      stream: true,
      store: true,
      reasoning: { summary: "auto" },
    });

    const state = createNormalizerState();
    let runId: string | null = null;

    for await (const rawEvent of stream) {
      if (!sink.isOpen()) return;

      const normalized = normalizeStreamEvent(
        rawEvent as ResponseStreamEvent,
        state,
        conversationId,
      );

      for (const event of normalized) {
        if (event.type === "RunStarted") {
          runId = event.runId;
          setActiveRun(conversationId, runId);
          startRunLog(runId, conversationId);
        }
        appendRunEvent(runId ?? "unknown", event);
        sink.send(event);
      }
    }

    if (state.finalResponseId) {
      lastResponseId = state.finalResponseId;
      saveLastResponseId(conversationId, lastResponseId);
    }

    if (!state.finishedWithToolCalls) {
      const finished = stamp({
        type: "RunFinished",
        runId: lastResponseId ?? runId ?? "unknown",
        conversationId,
      });
      if (runId) appendRunEvent(runId, finished);
      sink.send(finished);
      if (runId) finishRunLog(runId);
      setActiveRun(conversationId, null);
      setConversationStatus(conversationId, "idle");
      clearPendingItems(conversationId);
      pruneOldRuns();
      return;
    }

    const toolCalls = [...state.pendingToolCalls.values()] as PendingToolCall[];
    const loggingSink: EventSink = {
      isOpen: () => sink.isOpen(),
      send(event) {
        if (runId) appendRunEvent(runId, event);
        sink.send(event);
      },
    };

    const loopResult = await executePendingToolCalls(toolCalls, loggingSink, {
      conversationId,
      userId: options.userId,
      userCountryCode: options.userCountryCode,
      onTurnToolProgress: options.onToolProgress,
    });

    if (loopResult.clarification) {
      setPendingClarification(conversationId, loopResult.clarification);
    }

    appendFunctionCallOutputs(conversationId, loopResult.responseItems);
    clearPendingItems(conversationId);

    if (loopResult.pauseForUser) {
      sink.send(
        stamp({
          type: "RunFinished",
          runId: lastResponseId ?? runId ?? "unknown",
          conversationId,
        }),
      );
      if (runId) finishRunLog(runId);
      setActiveRun(conversationId, null);
      pruneOldRuns();
      return;
    }

    conversationItems = loopResult.responseItems;
  }

  sink.send(
    stamp({
      type: "RunError",
      conversationId,
      message: `Maximum iteration limit (${maxIterations}) reached.`,
    }),
  );
  setConversationStatus(conversationId, "error");
  setActiveRun(conversationId, null);
}
