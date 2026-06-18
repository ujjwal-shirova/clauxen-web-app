import type { NormalizedEvent } from "@/autonomous-agent/types/events";

export type ToolCallStatus = "pending" | "running" | "done" | "error";

export type AgentToolCallState = {
  id: string;
  name: string;
  args: Record<string, unknown>;
  argsRaw: string;
  status: ToolCallStatus;
  result: unknown;
};

export type AgentMessageState = {
  id: string;
  role: "assistant";
  content: string;
  complete: boolean;
};

export type AgentReasoningState = {
  id: string;
  content: string;
  expanded: boolean;
  complete: boolean;
};

export type AgentTurnItem =
  | { kind: "message"; data: AgentMessageState }
  | { kind: "reasoning"; data: AgentReasoningState }
  | { kind: "tool"; data: AgentToolCallState };

export type AgentRunState = {
  runId: string | null;
  status: "idle" | "running" | "finished" | "error" | "waiting_for_user";
  error: string | null;
  items: AgentTurnItem[];
  clarification: { toolCallId: string; question: string } | null;
  eventCount: number;
};

export const initialAgentRunState: AgentRunState = {
  runId: null,
  status: "idle",
  error: null,
  items: [],
  clarification: null,
  eventCount: 0,
};

function findTool(items: AgentTurnItem[], id: string): AgentToolCallState | null {
  for (const item of items) {
    if (item.kind === "tool" && item.data.id === id) return item.data;
  }
  return null;
}

function findMessage(items: AgentTurnItem[], id: string): AgentMessageState | null {
  for (const item of items) {
    if (item.kind === "message" && item.data.id === id) return item.data;
  }
  return null;
}

function findReasoning(
  items: AgentTurnItem[],
  id: string,
): AgentReasoningState | null {
  for (const item of items) {
    if (item.kind === "reasoning" && item.data.id === id) return item.data;
  }
  return null;
}

function upsertItem(
  items: AgentTurnItem[],
  item: AgentTurnItem,
): AgentTurnItem[] {
  const idx = items.findIndex(
    (i) =>
      (i.kind === "message" && item.kind === "message" && i.data.id === item.data.id) ||
      (i.kind === "reasoning" && item.kind === "reasoning" && i.data.id === item.data.id) ||
      (i.kind === "tool" && item.kind === "tool" && i.data.id === item.data.id),
  );
  if (idx === -1) return [...items, item];
  const next = [...items];
  next[idx] = item;
  return next;
}

function applyEventToItems(
  items: AgentTurnItem[],
  event: NormalizedEvent,
): AgentTurnItem[] {
  switch (event.type) {
    case "TextMessageStart":
      return upsertItem(items, {
        kind: "message",
        data: { id: event.messageId, role: "assistant", content: "", complete: false },
      });

    case "TextMessageContent": {
      const msg = findMessage(items, event.messageId);
      if (!msg) return items;
      return upsertItem(items, {
        kind: "message",
        data: { ...msg, content: msg.content + event.delta },
      });
    }

    case "TextMessageEnd": {
      const msg = findMessage(items, event.messageId);
      if (!msg) return items;
      return upsertItem(items, {
        kind: "message",
        data: { ...msg, complete: true },
      });
    }

    case "ReasoningStart":
      return upsertItem(items, {
        kind: "reasoning",
        data: { id: event.messageId, content: "", expanded: true, complete: false },
      });

    case "ReasoningMessageContent": {
      const r = findReasoning(items, event.messageId);
      if (!r) return items;
      return upsertItem(items, {
        kind: "reasoning",
        data: { ...r, content: r.content + event.delta, expanded: true },
      });
    }

    case "ReasoningEnd": {
      const r = findReasoning(items, event.messageId);
      if (!r) return items;
      return upsertItem(items, {
        kind: "reasoning",
        data: { ...r, complete: true, expanded: true },
      });
    }

    case "ToolCallStart":
      return upsertItem(items, {
        kind: "tool",
        data: {
          id: event.toolCallId,
          name: event.toolCallName,
          args: {},
          argsRaw: "",
          status: "running",
          result: null,
        },
      });

    case "ToolCallArgs": {
      const tool = findTool(items, event.toolCallId);
      if (!tool) return items;
      return upsertItem(items, {
        kind: "tool",
        data: {
          ...tool,
          args: event.preview,
          argsRaw: tool.argsRaw + event.delta,
          status: "running",
        },
      });
    }

    case "ToolCallEnd": {
      const tool = findTool(items, event.toolCallId);
      if (!tool) return items;
      return upsertItem(items, {
        kind: "tool",
        data: { ...tool, status: "done" },
      });
    }

    case "ToolCallResult": {
      const tool = findTool(items, event.toolCallId);
      if (!tool) return items;
      return upsertItem(items, {
        kind: "tool",
        data: { ...tool, result: event.content, status: "done" },
      });
    }

    case "ToolCallProgress": {
      const tool = findTool(items, event.toolCallId);
      if (!tool) return items;
      const data = event.data;
      const next: AgentToolCallState = { ...tool };
      if (Array.isArray(data.results)) {
        next.result = { ...((tool.result as object) ?? {}), results: data.results };
      }
      if (typeof data.query === "string") {
        next.args = { ...next.args, query: data.query };
      }
      return upsertItem(items, { kind: "tool", data: next });
    }

    case "StepDone":
      return items;

    default:
      return items;
  }
}

export function reduceAgentEvent(
  state: AgentRunState,
  event: NormalizedEvent,
): AgentRunState {
  if (event.type === "Snapshot") {
    let next = { ...state, eventCount: state.eventCount };
    for (const e of event.events) {
      next = reduceAgentEvent(next, e);
    }
    return { ...next, runId: event.runId ?? next.runId };
  }

  const eventCount = state.eventCount + 1;
  let next: AgentRunState = {
    ...state,
    eventCount,
    items: applyEventToItems(state.items, event),
  };

  switch (event.type) {
    case "RunStarted":
      return {
        ...next,
        runId: event.runId,
        status: "running",
        error: null,
        clarification: null,
      };

    case "RunFinished":
      return {
        ...next,
        status: next.clarification ? "waiting_for_user" : "finished",
      };

    case "RunError":
      return {
        ...next,
        status: "error",
        error: event.message,
      };

    case "ClarificationRequested":
      return {
        ...next,
        status: "waiting_for_user",
        clarification: {
          toolCallId: event.toolCallId,
          question: event.question,
        },
      };

    default:
      return next;
  }
}

export function collapseReasoningItems(
  items: AgentTurnItem[],
  messageId: string,
): AgentTurnItem[] {
  return items.map((item) => {
    if (item.kind === "reasoning" && item.data.id === messageId) {
      return {
        kind: "reasoning",
        data: { ...item.data, expanded: false },
      };
    }
    return item;
  });
}
