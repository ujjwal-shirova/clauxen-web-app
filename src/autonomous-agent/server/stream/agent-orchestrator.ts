import { autonomousAgentConfig } from "@/autonomous-agent/server/config";
import { getAutonomousAgentOpenAI } from "@/autonomous-agent/server/openai";
import { runConversationTurn } from "@/autonomous-agent/server/stream/conversation-turn";
import { runResponsesTurn } from "@/autonomous-agent/server/stream/responses-turn";
import { runAgentLoop, type EventSink, type RunTurnOptions } from "@/autonomous-agent/server/stream/run-turn";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

export type AgentBackend = "completions" | "responses" | "auto";

function resolveBackend(requested?: AgentBackend): AgentBackend {
  const env = process.env.AUTONOMOUS_AGENT_BACKEND?.trim().toLowerCase();
  if (requested && requested !== "auto") return requested;
  if (env === "responses" || env === "completions") return env;
  // Novita and most OpenAI-compatible proxies expose /v1/chat/completions only.
  return "completions";
}

async function responsesApiAvailable(baseUrl?: string): Promise<boolean> {
  const root = (baseUrl ?? autonomousAgentConfig.defaultBaseUrl).replace(
    /\/$/,
    "",
  );
  try {
    const response = await fetch(`${root}/responses`, {
      method: "OPTIONS",
      signal: AbortSignal.timeout(3000),
    });
    return response.status !== 404;
  } catch {
    return false;
  }
}

export type OrchestratorTurnOptions = RunTurnOptions & {
  backend?: AgentBackend;
  /** Pre-built messages for stateless chat integration. */
  messages?: ChatCompletionMessageParam[];
};

/**
 * Unified autonomous turn entry — routes to Chat Completions (Novita) or
 * Responses API when available. No system prompt on either path.
 */
export async function runAutonomousTurn(
  conversationId: string,
  sink: EventSink,
  options: OrchestratorTurnOptions = {},
): Promise<void> {
  let backend = resolveBackend(options.backend);

  if (backend === "auto") {
    backend = (await responsesApiAvailable(options.baseUrl))
      ? "responses"
      : "completions";
  }

  if (backend === "responses") {
    await runResponsesTurn(conversationId, sink, options);
    return;
  }

  if (options.messages?.length) {
    await runAgentLoop(options.messages, sink, {
      ...options,
      conversationId,
    });
    return;
  }

  await runConversationTurn(conversationId, sink, options);
}

/** Stateless chat stream helper — completions path only. */
export async function runAutonomousChatTurn(
  messages: ChatCompletionMessageParam[],
  sink: EventSink,
  options: Omit<OrchestratorTurnOptions, "messages"> = {},
): Promise<void> {
  await runAgentLoop(messages, sink, options);
}

export { getAutonomousAgentOpenAI };
