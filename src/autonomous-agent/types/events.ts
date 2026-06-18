/**
 * Normalized event vocabulary — protocol-agnostic between OpenAI Responses API,
 * future Anthropic/AG-UI adapters, and the frontend renderer.
 */

export type NormalizedEvent =
  | RunStartedEvent
  | RunFinishedEvent
  | RunErrorEvent
  | TextMessageStartEvent
  | TextMessageContentEvent
  | TextMessageEndEvent
  | ReasoningStartEvent
  | ReasoningMessageContentEvent
  | ReasoningEndEvent
  | ToolCallStartEvent
  | ToolCallArgsEvent
  | ToolCallEndEvent
  | ToolCallResultEvent
  | ToolCallProgressEvent
  | StepDoneEvent
  | ClarificationRequestedEvent
  | SnapshotEvent;

export type RunStartedEvent = {
  type: "RunStarted";
  runId: string;
  conversationId: string;
  timestamp: number;
};

export type RunFinishedEvent = {
  type: "RunFinished";
  runId: string;
  conversationId: string;
  timestamp: number;
};

export type RunErrorEvent = {
  type: "RunError";
  runId?: string;
  conversationId: string;
  message: string;
  timestamp: number;
};

export type TextMessageStartEvent = {
  type: "TextMessageStart";
  messageId: string;
  role: "assistant";
  timestamp: number;
};

export type TextMessageContentEvent = {
  type: "TextMessageContent";
  messageId: string;
  delta: string;
  timestamp: number;
};

export type TextMessageEndEvent = {
  type: "TextMessageEnd";
  messageId: string;
  timestamp: number;
};

export type ReasoningStartEvent = {
  type: "ReasoningStart";
  messageId: string;
  timestamp: number;
};

export type ReasoningMessageContentEvent = {
  type: "ReasoningMessageContent";
  messageId: string;
  delta: string;
  timestamp: number;
};

export type ReasoningEndEvent = {
  type: "ReasoningEnd";
  messageId: string;
  timestamp: number;
};

export type ToolCallStartEvent = {
  type: "ToolCallStart";
  toolCallId: string;
  toolCallName: string;
  timestamp: number;
};

export type ToolCallArgsEvent = {
  type: "ToolCallArgs";
  toolCallId: string;
  delta: string;
  preview: Record<string, unknown>;
  timestamp: number;
};

export type ToolCallEndEvent = {
  type: "ToolCallEnd";
  toolCallId: string;
  timestamp: number;
};

export type ToolCallResultEvent = {
  type: "ToolCallResult";
  toolCallId: string;
  content: unknown;
  timestamp: number;
};

/** Partial tool output streamed before the call completes (e.g. search hits). */
export type ToolCallProgressEvent = {
  type: "ToolCallProgress";
  toolCallId: string;
  data: Record<string, unknown>;
  timestamp: number;
};

/** Marks completion of one autonomous sub-step (tool cycle or reasoning block). */
export type StepDoneEvent = {
  type: "StepDone";
  label?: string;
  toolCallId?: string;
  timestamp: number;
};

export type ClarificationRequestedEvent = {
  type: "ClarificationRequested";
  toolCallId: string;
  question: string;
  timestamp: number;
};

/** Full state snapshot for reconnect replay. */
export type SnapshotEvent = {
  type: "Snapshot";
  conversationId: string;
  runId: string | null;
  events: NormalizedEvent[];
  timestamp: number;
};

export function stamp<T extends Omit<NormalizedEvent, "timestamp">>(
  event: T,
): T & { timestamp: number } {
  return { ...event, timestamp: Date.now() };
}

export function serializeEvent(event: NormalizedEvent): string {
  return JSON.stringify(event);
}

export function parseEvent(raw: string): NormalizedEvent | null {
  try {
    const parsed = JSON.parse(raw) as NormalizedEvent;
    if (parsed && typeof parsed === "object" && "type" in parsed) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}
