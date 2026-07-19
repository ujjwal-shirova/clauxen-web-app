/**
 * Anthropic Messages API–shaped JSONL transcript records for training export
 * and chat_messages.content_json persistence.
 *
 * Content blocks match Anthropic / Clauxen Code assistant message content:
 *   thinking | text | tool_use
 * Tool results are stored as user-role messages (Anthropic wire format), not
 * nested inside the assistant message (Cursor dump style).
 *
 * Schema also accepts legacy Cursor-style assistant records that embed
 * tool_result parts for hydrate/back-compat.
 */

export const TRANSCRIPT_SCHEMA_VERSION =
  "clauxen.transcript.anthropic.v1" as const;

/** @deprecated Prefer TRANSCRIPT_SCHEMA_VERSION — kept for reading old rows. */
export const TRANSCRIPT_SCHEMA_VERSION_LEGACY =
  "clauxen.transcript.v1" as const;

export type TranscriptTextPart = {
  type: "text";
  text: string;
};

export type TranscriptThinkingPart = {
  type: "thinking";
  thinking: string;
  /** Optional Anthropic thinking signature when present. */
  signature?: string;
};

export type TranscriptRedactedThinkingPart = {
  type: "redacted_thinking";
  data: string;
};

export type TranscriptToolUsePart = {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
};

export type TranscriptToolResultPart = {
  type: "tool_result";
  tool_use_id: string;
  content: string;
  is_error?: boolean;
};

export type TranscriptContentPart =
  | TranscriptTextPart
  | TranscriptThinkingPart
  | TranscriptRedactedThinkingPart
  | TranscriptToolUsePart
  | TranscriptToolResultPart;

export type TranscriptAgentAction = {
  id: string;
  name: string;
  input: Record<string, unknown>;
  result?: string;
  isError?: boolean;
  description?: string;
  startedAtMs?: number;
  completedAtMs?: number;
};

export type TranscriptAgentUi = {
  startedAtMs?: number;
  completedAtMs?: number;
  thinkingDurationSeconds?: number;
  actions?: TranscriptAgentAction[];
  /** Exact chronological Messages API rounds for durable transcript hydrate. */
  modelTurns?: TranscriptAgentModelTurn[];
  /**
   * Demo Razorpay test-account remaining user-message slots after this turn.
   * Only set for test-razorpay@clauxen.com.
   */
  messagesRemaining?: number;
};

export type TranscriptAgentModelTurn = {
  stopReason: string;
  startedAtMs?: number;
  assistantCompletedAtMs?: number;
  completedAtMs?: number;
  assistant: TranscriptContentPart[];
  toolResults?: TranscriptToolResultPart[];
};

export type TranscriptMessageRecord = {
  role: "user" | "assistant" | "system" | "tool";
  message: {
    content: TranscriptContentPart[];
  };
  /** Optional UI timing for agent work frames (not part of Anthropic wire). */
  agent_ui?: TranscriptAgentUi;
};

export type TranscriptMetaRecord = {
  type: "turn_ended";
  status: "success" | "error" | "cancelled";
};

export type TranscriptRecord = TranscriptMessageRecord | TranscriptMetaRecord;

export type CapturedToolCall = {
  id: string;
  name: string;
  input: Record<string, unknown>;
  result?: string;
  isError?: boolean;
  description?: string;
  startedAtMs?: number;
  completedAtMs?: number;
};

export function textPart(text: string): TranscriptTextPart {
  return { type: "text", text };
}

export function thinkingPart(
  thinking: string,
  signature?: string,
): TranscriptThinkingPart {
  return signature
    ? { type: "thinking", thinking, signature }
    : { type: "thinking", thinking };
}

export function toolUsePart(
  name: string,
  input: Record<string, unknown>,
  id: string,
): TranscriptToolUsePart {
  return { type: "tool_use", id, name, input };
}

export function toolResultPart(
  toolUseId: string,
  content: string,
  isError = false,
): TranscriptToolResultPart {
  return {
    type: "tool_result",
    tool_use_id: toolUseId,
    content,
    ...(isError ? { is_error: true } : {}),
  };
}

/** Keep only Anthropic-compatible blocks needed for replay/training. */
export function captureAnthropicContentBlocks(
  blocks: readonly unknown[],
): TranscriptContentPart[] {
  const captured: TranscriptContentPart[] = [];

  for (const value of blocks) {
    if (!value || typeof value !== "object") continue;
    const block = value as Record<string, unknown>;

    if (block.type === "thinking" && typeof block.thinking === "string") {
      captured.push(
        thinkingPart(
          block.thinking,
          typeof block.signature === "string" ? block.signature : undefined,
        ),
      );
      continue;
    }

    if (
      block.type === "redacted_thinking" &&
      typeof block.data === "string"
    ) {
      captured.push({ type: "redacted_thinking", data: block.data });
      continue;
    }

    if (block.type === "text" && typeof block.text === "string") {
      captured.push(textPart(block.text));
      continue;
    }

    if (
      block.type === "tool_use" &&
      typeof block.id === "string" &&
      typeof block.name === "string"
    ) {
      captured.push(
        toolUsePart(
          block.name,
          block.input && typeof block.input === "object"
            ? (block.input as Record<string, unknown>)
            : {},
          block.id,
        ),
      );
    }
  }

  return captured;
}

export function buildUserTranscriptRecord(
  content: string,
): TranscriptMessageRecord {
  return {
    role: "user",
    message: {
      content: [textPart(content)],
    },
  };
}

/** Anthropic order: thinking → tool_use* → text (no tool_result on assistant). */
export function buildAssistantTranscriptRecord(input: {
  answer: string;
  thinking?: string;
  tools?: CapturedToolCall[];
  agentUi?: TranscriptAgentUi;
}): TranscriptMessageRecord {
  const parts: TranscriptContentPart[] = [];
  const thinking = input.thinking?.trim();
  if (thinking) parts.push(thinkingPart(thinking));

  for (const tool of input.tools ?? []) {
    parts.push(toolUsePart(tool.name, tool.input ?? {}, tool.id));
  }

  const answer = input.answer.trim();
  if (answer) parts.push(textPart(answer));

  if (parts.length === 0) parts.push(textPart(""));

  return {
    role: "assistant",
    message: { content: parts },
    ...(input.agentUi ? { agent_ui: input.agentUi } : {}),
  };
}

/** Anthropic user message carrying tool_result blocks after a tool_use turn. */
export function buildToolResultUserRecord(
  tools: CapturedToolCall[],
): TranscriptMessageRecord | null {
  const parts: TranscriptToolResultPart[] = [];
  for (const tool of tools) {
    if (tool.result === undefined) continue;
    parts.push(toolResultPart(tool.id, tool.result, Boolean(tool.isError)));
  }
  if (parts.length === 0) return null;
  return {
    role: "user",
    message: { content: parts },
  };
}

export function buildTurnEndedRecord(
  status: TranscriptMetaRecord["status"] = "success",
): TranscriptMetaRecord {
  return { type: "turn_ended", status };
}

export function transcriptRoleOf(
  record: TranscriptRecord,
): "user" | "assistant" | "system" | "tool" | "meta" {
  if ("type" in record) return "meta";
  return record.role;
}

/** Convert UI/branch Message-like objects into Anthropic-shaped JSONL records. */
export function messagesToTranscriptRecords(
  messages: Array<{
    id?: string;
    role: string;
    content?: string;
    thinkingContent?: string;
    agentSegments?: Array<{
      kind: string;
      toolCallId?: string;
      name?: string;
      args?: Record<string, unknown>;
      result?: string;
      status?: string;
    }>;
    agentFrames?: Array<{
      segments?: Array<{
        kind: string;
        toolCallId?: string;
        name?: string;
        args?: Record<string, unknown>;
        result?: string;
        status?: string;
      }>;
    }>;
  }>,
): Array<{
  role: "user" | "assistant" | "system" | "tool" | "meta";
  record: TranscriptRecord;
  messageId?: string | null;
}> {
  const lines: Array<{
    role: "user" | "assistant" | "system" | "tool" | "meta";
    record: TranscriptRecord;
    messageId?: string | null;
  }> = [];

  for (const message of messages) {
    if (message.role === "user") {
      const record = buildUserTranscriptRecord(message.content ?? "");
      lines.push({
        role: "user",
        record,
        messageId: message.id ?? null,
      });
      continue;
    }

    if (message.role !== "assistant") continue;

    const tools: CapturedToolCall[] = [];
    const segments =
      message.agentFrames?.flatMap((frame) => frame.segments ?? []) ??
      message.agentSegments ??
      [];

    for (const segment of segments) {
      if (segment.kind !== "tool" || !segment.name || !segment.toolCallId) {
        continue;
      }
      tools.push({
        id: segment.toolCallId,
        name: segment.name,
        input: segment.args ?? {},
        result: segment.result,
        isError: segment.status === "error",
      });
    }

    const record = buildAssistantTranscriptRecord({
      answer: message.content ?? "",
      thinking: message.thinkingContent,
      tools,
    });
    lines.push({
      role: "assistant",
      record,
      messageId: message.id ?? null,
    });

    const toolResults = buildToolResultUserRecord(tools);
    if (toolResults) {
      lines.push({
        role: "user",
        record: toolResults,
        messageId: message.id ?? null,
      });
    }
  }

  if (lines.length > 0) {
    lines.push({
      role: "meta",
      record: buildTurnEndedRecord("success"),
      messageId: null,
    });
  }

  return lines;
}

export function recordsToJsonl(records: TranscriptRecord[]): string {
  return records.map((record) => JSON.stringify(record)).join("\n");
}
