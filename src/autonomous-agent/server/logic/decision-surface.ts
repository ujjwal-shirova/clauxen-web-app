/**
 * Conversation input assembly — enforces the zero-system-prompt constraint.
 *
 * Decision architecture (emergent from tool schemas, not coded branches):
 *
 * 1. Silent triage — model judges from user text + tool descriptions whether
 *    outside information is needed (web_search description covers cutoff/stability).
 * 2. Tool pecking order — encoded in per-tool descriptions (first-party before
 *    web search is a future extension; web_search is the general-world fallback).
 * 3. Skills slot — file_read/file_write + execute_code surface sandbox facts.
 * 4. Interleaved thinking — reasoning summary streams as Reasoning* events;
 *    post-tool reflection is the model's next reasoning/message turn, not a
 *    separate narration layer.
 * 5. Stop condition — loop ends when a response has no function_call items.
 */
import type { ResponseInputItem } from "openai/resources/responses/responses";

/** Build user input item — never injects system/developer messages. */
export function buildUserInputItem(content: string): ResponseInputItem {
  return {
    type: "message",
    role: "user",
    content,
  };
}

/** Build function call output for the next model turn. */
export function buildFunctionCallOutput(
  callId: string,
  output: unknown,
): ResponseInputItem {
  return {
    type: "function_call_output",
    call_id: callId,
    output: typeof output === "string" ? output : JSON.stringify(output),
  };
}

/**
 * Responses API call shape — deliberately omits `instructions`.
 * The model receives only conversation items + tool definitions.
 */
export type ResponsesTurnParams = {
  model: string;
  input: ResponseInputItem[];
  previous_response_id?: string;
  stream: true;
  store: true;
  reasoning: { summary: "auto" };
};

export function assertNoSystemInjection(items: ResponseInputItem[]): void {
  for (const item of items) {
    if (
      item.type === "message" &&
      "role" in item &&
      (item.role === "system" || item.role === "developer")
    ) {
      throw new Error(
        "System/developer messages are forbidden in the autonomous agent loop.",
      );
    }
  }
}
