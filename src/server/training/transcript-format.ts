/**
 * OpenAI Responses API–shaped JSONL transcript records for training export
 * and chat_messages.content_json persistence. Legacy block names remain
 * readable so existing conversations continue to hydrate.
 */

export const TRANSCRIPT_SCHEMA_VERSION =
  "clauxen.transcript.openai.v2" as const;

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
  /** Optional provider reasoning signature when present. */
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

export type TranscriptSource = {
  title: string;
  url: string;
  snippet: string;
  publishedDate?: string;
  favicon?: string;
  highlights?: string[];
};

/** Canonical UI timeline persisted in the same order it streamed. */
export type TranscriptAgentSegment =
  | {
      type: "thinking";
      id: string;
      content: string;
      startedAtMs?: number;
      completedAtMs?: number;
      durationSeconds?: number;
    }
  | {
      type: "narration";
      id: string;
      content: string;
      isFinal?: boolean;
      startedAtMs?: number;
      completedAtMs?: number;
    }
  | {
      type: "tool";
      id: string;
      toolCallId: string;
      name: string;
      status: "running" | "done" | "error" | "cancelled";
      input: Record<string, unknown>;
      result?: string;
      description?: string;
      searchQuery?: string;
      sources?: TranscriptSource[];
      startedAtMs?: number;
      completedAtMs?: number;
    };

export type TranscriptAgentUi = {
  model?: string;
  status?: "streaming" | "complete" | "failed" | "cancelled";
  startedAtMs?: number;
  completedAtMs?: number;
  thinkingDurationSeconds?: number;
  actions?: TranscriptAgentAction[];
  /** Lossless ordered SSE timeline used directly by chat hydration. */
  segments?: TranscriptAgentSegment[];
  /** Deduplicated source-card data for citations and training export. */
  sources?: TranscriptSource[];
  /** Exact chronological Responses API rounds for durable transcript hydrate. */
  modelTurns?: TranscriptAgentModelTurn[];
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
  schema_version?: typeof TRANSCRIPT_SCHEMA_VERSION | string;
  role: "user" | "assistant" | "system" | "tool";
  message: {
    content: TranscriptContentPart[];
  };
  /** Optional UI timing for agent work frames. */
  agent_ui?: TranscriptAgentUi;
};

export type TranscriptMetaRecord = {
  schema_version?: typeof TRANSCRIPT_SCHEMA_VERSION | string;
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

/** Capture OpenAI Responses output items for durable replay/training. */
export function captureOpenAIOutputItems(
  items: readonly unknown[],
): TranscriptContentPart[] {
  const captured: TranscriptContentPart[] = [];

  for (const value of items) {
    if (!value || typeof value !== "object") continue;
    const item = value as Record<string, unknown>;

    if (item.type === "reasoning" && Array.isArray(item.summary)) {
      const summary = item.summary
        .map((part) =>
          part &&
          typeof part === "object" &&
          typeof (part as { text?: unknown }).text === "string"
            ? String((part as { text: string }).text)
            : "",
        )
        .join("");
      if (summary) captured.push(thinkingPart(summary));
      continue;
    }

    if (item.type === "message" && Array.isArray(item.content)) {
      for (const content of item.content) {
        if (
          content &&
          typeof content === "object" &&
          (content as { type?: unknown }).type === "output_text" &&
          typeof (content as { text?: unknown }).text === "string"
        ) {
          captured.push(textPart(String((content as { text: string }).text)));
        }
      }
      continue;
    }

    if (
      item.type === "function_call" &&
      typeof item.call_id === "string" &&
      typeof item.name === "string"
    ) {
      let input: Record<string, unknown> = {};
      if (typeof item.arguments === "string") {
        try {
          input = JSON.parse(item.arguments) as Record<string, unknown>;
        } catch {
          input = {};
        }
      }
      captured.push(toolUsePart(item.name, input, item.call_id));
    }
  }

  return captured;
}

export function buildUserTranscriptRecord(
  content: string,
): TranscriptMessageRecord {
  return {
    schema_version: TRANSCRIPT_SCHEMA_VERSION,
    role: "user",
    message: {
      content: [textPart(content)],
    },
  };
}

/** Canonical order follows the exact streamed segment chronology. */
export function buildAssistantTranscriptRecord(input: {
  answer: string;
  thinking?: string;
  tools?: CapturedToolCall[];
  agentUi?: TranscriptAgentUi;
}): TranscriptMessageRecord {
  const parts: TranscriptContentPart[] = [];
  const segments = input.agentUi?.segments ?? [];

  if (segments.length > 0) {
    for (const segment of segments) {
      if (segment.type === "thinking" && segment.content.trim()) {
        parts.push(thinkingPart(segment.content));
      } else if (segment.type === "narration" && segment.content.trim()) {
        parts.push(textPart(segment.content));
      } else if (segment.type === "tool") {
        parts.push(
          toolUsePart(segment.name, segment.input, segment.toolCallId),
        );
      }
    }
  } else {
    const thinking = input.thinking?.trim();
    if (thinking) parts.push(thinkingPart(thinking));

    for (const tool of input.tools ?? []) {
      parts.push(toolUsePart(tool.name, tool.input ?? {}, tool.id));
    }
  }

  const answer = input.answer.trim();
  const finalNarrationAlreadyStored = segments.some(
    (segment) =>
      segment.type === "narration" &&
      segment.isFinal === true &&
      segment.content.trim() === answer,
  );
  if (answer && !finalNarrationAlreadyStored) parts.push(textPart(answer));

  if (parts.length === 0) parts.push(textPart(""));

  return {
    schema_version: TRANSCRIPT_SCHEMA_VERSION,
    role: "assistant",
    message: { content: parts },
    ...(input.agentUi ? { agent_ui: input.agentUi } : {}),
  };
}

/** Tool-output message emitted after a function-call round. */
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
    schema_version: TRANSCRIPT_SCHEMA_VERSION,
    role: "user",
    message: { content: parts },
  };
}

export function buildTurnEndedRecord(
  status: TranscriptMetaRecord["status"] = "success",
): TranscriptMetaRecord {
  return {
    schema_version: TRANSCRIPT_SCHEMA_VERSION,
    type: "turn_ended",
    status,
  };
}

export function transcriptRoleOf(
  record: TranscriptRecord,
): "user" | "assistant" | "system" | "tool" | "meta" {
  if ("type" in record) return "meta";
  return record.role;
}

/** Convert UI/branch Message-like objects into canonical JSONL records. */
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
