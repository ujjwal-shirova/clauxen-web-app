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
      // Prefer final-answer text; fall back to narration so prior mid-turn
      // updates still ground the next user message.
      const visible = parsed.visibleText.trim();
      const narration = parsed.narration.trim();
      if (visible) texts.push(visible);
      else if (narration) texts.push(narration);
      else {
        const cleaned = stripAgentTranscriptMarkup(part.text).trim();
        if (cleaned) texts.push(cleaned);
      }
    }
  }
  return texts.join("\n\n").trim();
}

function textFromModelTurns(turns: TranscriptAgentModelTurn[]): string {
  const chunks: string[] = [];
  for (const turn of turns) {
    if (!Array.isArray(turn.assistant)) continue;
    const fromTurn = textFromParts(turn.assistant);
    if (fromTurn) chunks.push(fromTurn);
  }
  return chunks.join("\n\n").trim();
}

function summarizeAgentActions(agentUi?: TranscriptAgentUi): string {
  const actions = Array.isArray(agentUi?.actions) ? agentUi.actions : [];
  if (actions.length === 0 && Array.isArray(agentUi?.modelTurns)) {
    const names: string[] = [];
    for (const turn of agentUi.modelTurns) {
      for (const part of turn.assistant ?? []) {
        if (part.type === "tool_use" && part.name) names.push(part.name);
      }
    }
    if (names.length === 0) return "";
    return `Previous assistant tool activity in this chat:\n${names
      .slice(0, 12)
      .map((name) => `- ${name}`)
      .join("\n")}`;
  }
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

/**
 * Durable plain-text context for a prior assistant turn.
 * Never replays signed thinking / tool_use blocks (those break follow-ups when
 * signatures are missing). ChatGPT/Claude-style: prior answer text + tool summary.
 */
export function assistantContextTextFromRow(row: MessageRow): string {
  const agentUi = readAgentUi(row);
  const modelTurns = Array.isArray(agentUi?.modelTurns)
    ? agentUi.modelTurns
    : [];

  const fromTurns = stripMessageContentForModelApi(
    textFromModelTurns(modelTurns),
  );
  const fromRowContent = stripMessageContentForModelApi(row.content ?? "");
  const fromParts = stripMessageContentForModelApi(
    textFromParts(readTranscriptParts(row)),
  );

  const answer = fromRowContent || fromTurns || fromParts;
  const summary = summarizeAgentActions(agentUi);

  if (answer && summary) return `${answer}\n\n${summary}`;
  if (answer) return answer;
  if (summary) return summary;
  return "";
}

/**
 * Build durable model prompt history from DB rows so follow-up turns see
 * prior user + assistant work. Prior assistants are always plain text
 * (answer + tool summary) — never raw thinking/tool_use replay.
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

    const assistantText = assistantContextTextFromRow(row);
    if (!assistantText) continue;

    plain.push({ role: "assistant", content: assistantText });
    // Always string content for prior turns — safe for Anthropic replay and
    // keeps the model grounded on what it already did / said.
    structured.push({ role: "assistant", content: assistantText });
  }

  return { plain, structured };
}
