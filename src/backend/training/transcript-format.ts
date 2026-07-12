/**
 * Cursor-style JSONL transcript records for training export.
 *
 * Shape matches agent transcript dumps:
 *   {"role":"user","message":{"content":[{"type":"text","text":"..."}]}}
 *   {"role":"assistant","message":{"content":[{"type":"text","text":"..."},{"type":"tool_use",...}]}}
 *   {"type":"turn_ended","status":"success"}
 */

export const TRANSCRIPT_SCHEMA_VERSION = "clauxen.transcript.v1" as const;

export type TranscriptTextPart = {
  type: "text";
  text: string;
};

export type TranscriptThinkingPart = {
  type: "thinking";
  thinking: string;
};

export type TranscriptToolUsePart = {
  type: "tool_use";
  id?: string;
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
  | TranscriptToolUsePart
  | TranscriptToolResultPart;

export type TranscriptMessageRecord = {
  role: "user" | "assistant" | "system" | "tool";
  message: {
    content: TranscriptContentPart[];
  };
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
};

export function textPart(text: string): TranscriptTextPart {
  return { type: "text", text };
}

export function thinkingPart(thinking: string): TranscriptThinkingPart {
  return { type: "thinking", thinking };
}

export function toolUsePart(
  name: string,
  input: Record<string, unknown>,
  id?: string,
): TranscriptToolUsePart {
  return id
    ? { type: "tool_use", id, name, input }
    : { type: "tool_use", name, input };
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

export function buildAssistantTranscriptRecord(input: {
  answer: string;
  thinking?: string;
  tools?: CapturedToolCall[];
}): TranscriptMessageRecord {
  const parts: TranscriptContentPart[] = [];
  const thinking = input.thinking?.trim();
  if (thinking) parts.push(thinkingPart(thinking));

  const answer = input.answer.trim();
  if (answer) parts.push(textPart(answer));

  for (const tool of input.tools ?? []) {
    parts.push(toolUsePart(tool.name, tool.input ?? {}, tool.id));
    if (tool.result !== undefined) {
      parts.push(toolResultPart(tool.id, tool.result, Boolean(tool.isError)));
    }
  }

  // Always keep a content array so exporters never need null-guards.
  if (parts.length === 0) parts.push(textPart(""));

  return {
    role: "assistant",
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

/** Convert UI/branch Message-like objects into JSONL records. */
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
