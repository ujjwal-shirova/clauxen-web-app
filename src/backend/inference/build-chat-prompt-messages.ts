import type { AgentStreamOptions } from "@/backend/inference/agent-engine";
import type { MessageRow } from "@/backend/repositories/messages.repository";
import type { IncomingMessage } from "@/backend/inference/novita";
import { stripMessageContentForModelApi } from "@/lib/model-context";
import {
  parseAgentTextMarkup,
  stripAgentTranscriptMarkup,
} from "@/lib/agent-transcript-markup";
import type {
  TranscriptAgentModelTurn,
  TranscriptAgentUi,
  TranscriptContentPart,
  TranscriptMessageRecord,
} from "@/backend/training/transcript-format";

type PromptMessage = AgentStreamOptions["messages"][number];

function readAgentUi(row: MessageRow): TranscriptAgentUi | undefined {
  const json = row.content_json as Partial<TranscriptMessageRecord> | null;
  if (!json || typeof json !== "object") return undefined;
  return json.agent_ui;
}

function readTranscriptParts(row: MessageRow): TranscriptContentPart[] {
  const json = row.content_json as Partial<TranscriptMessageRecord> | null;
  if (!json?.message || !Array.isArray(json.message.content)) return [];
  return json.message.content as TranscriptContentPart[];
}

function userModelContent(row: MessageRow): string {
  const meta = row.metadata as { model_content?: unknown } | null;
  if (typeof meta?.model_content === "string" && meta.model_content.trim()) {
    return meta.model_content.trim();
  }
  return (row.content ?? "").trim();
}

function textFromParts(parts: TranscriptContentPart[]): string {
  const texts: string[] = [];
  for (const part of parts) {
    if (part?.type === "text" && typeof part.text === "string") {
      const parsed = parseAgentTextMarkup(part.text);
      const visible = [parsed.narration, parsed.visibleText]
        .map((value) => value.trim())
        .filter(Boolean)
        .join("\n\n");
      if (visible) texts.push(visible);
      else {
        const cleaned = stripAgentTranscriptMarkup(part.text).trim();
        if (cleaned) texts.push(cleaned);
      }
    }
  }
  return texts.join("\n\n").trim();
}

function summarizeAgentActions(agentUi?: TranscriptAgentUi): string {
  const actions = Array.isArray(agentUi?.actions) ? agentUi.actions : [];
  if (actions.length === 0) return "";
  const lines = actions.slice(0, 12).map((action) => {
    const name = action.name || "tool";
    const detail =
      typeof action.description === "string" && action.description.trim()
        ? action.description.trim()
        : typeof action.input?.query === "string"
          ? String(action.input.query)
          : typeof action.input?.path === "string"
            ? String(action.input.path)
            : typeof action.input?.command === "string"
              ? String(action.input.command)
              : "";
    return detail ? `- ${name}: ${detail}` : `- ${name}`;
  });
  return `Previous assistant actions in this chat:\n${lines.join("\n")}`;
}

function assistantPlainContent(row: MessageRow): string {
  const direct = stripMessageContentForModelApi(row.content ?? "");
  if (direct) return direct;

  const fromParts = stripMessageContentForModelApi(
    textFromParts(readTranscriptParts(row)),
  );
  if (fromParts) return fromParts;

  const agentUi = readAgentUi(row);
  const summary = summarizeAgentActions(agentUi);
  if (summary) return summary;

  return "";
}

function pushModelTurns(
  messages: PromptMessage[],
  turns: TranscriptAgentModelTurn[],
) {
  for (const turn of turns) {
    const assistantBlocks = Array.isArray(turn.assistant)
      ? turn.assistant.filter((part) => part.type !== "tool_result")
      : [];
    if (assistantBlocks.length > 0) {
      messages.push({
        role: "assistant",
        content: assistantBlocks as PromptMessage["content"],
      });
    }
    if (Array.isArray(turn.toolResults) && turn.toolResults.length > 0) {
      messages.push({
        role: "user",
        content: turn.toolResults as PromptMessage["content"],
      });
    }
  }
}

/**
 * Build durable model prompt history from DB rows so follow-up turns see
 * prior user + assistant work (including tool rounds), not only user text.
 */
export function buildPromptMessagesFromDbRows(
  rows: MessageRow[],
): {
  plain: IncomingMessage[];
  structured: PromptMessage[];
} {
  const plain: IncomingMessage[] = [];
  const structured: PromptMessage[] = [];

  for (const row of rows) {
    if (row.role !== "user" && row.role !== "assistant") continue;
    // Skip the in-flight empty assistant placeholder for the current turn.
    if (
      row.role === "assistant" &&
      (row.status === "streaming" || row.status === "pending") &&
      !(row.content ?? "").trim()
    ) {
      const agentUi = readAgentUi(row);
      const hasTurns =
        Array.isArray(agentUi?.modelTurns) && agentUi.modelTurns.length > 0;
      if (!hasTurns) continue;
    }

    if (row.role === "user") {
      const content = userModelContent(row);
      if (!content) continue;
      plain.push({ role: "user", content });
      structured.push({ role: "user", content });
      continue;
    }

    const agentUi = readAgentUi(row);
    const modelTurns = Array.isArray(agentUi?.modelTurns)
      ? agentUi.modelTurns
      : [];

    if (modelTurns.length > 0) {
      pushModelTurns(structured, modelTurns);
      const plainAnswer = assistantPlainContent(row);
      if (plainAnswer) {
        plain.push({ role: "assistant", content: plainAnswer });
      } else {
        const summary = summarizeAgentActions(agentUi);
        if (summary) plain.push({ role: "assistant", content: summary });
      }
      continue;
    }

    const plainAnswer = assistantPlainContent(row);
    if (!plainAnswer) continue;
    plain.push({ role: "assistant", content: plainAnswer });
    structured.push({ role: "assistant", content: plainAnswer });
  }

  return { plain, structured };
}
