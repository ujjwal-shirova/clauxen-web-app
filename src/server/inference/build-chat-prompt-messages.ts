import type { AgentStreamOptions } from "@/server/agent-core";
import type { MessageRow } from "@/server/repositories/messages.repository";
import type { IncomingMessage } from "@/server/inference/novita";
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
} from "@/server/training/transcript-format";

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

function summarizeAskUserQuestions(input: Record<string, unknown> | undefined): string {
  const questions = input?.questions;
  if (!Array.isArray(questions) || questions.length === 0) {
    return "ask_user_input_v0";
  }
  const labels = questions
    .map((item) => {
      if (!item || typeof item !== "object") return "";
      const question = (item as { question?: unknown }).question;
      return typeof question === "string" ? question.trim() : "";
    })
    .filter(Boolean)
    .slice(0, 6);
  if (labels.length === 0) return "ask_user_input_v0";
  return `ask_user_input_v0 asked: ${labels.join(" | ")}`;
}

function summarizeAgentActions(agentUi?: TranscriptAgentUi): string {
  const actions = Array.isArray(agentUi?.actions) ? agentUi.actions : [];
  const names: string[] = [];

  if (actions.length > 0) {
    for (const action of actions.slice(0, 12)) {
      const name = action.name || "tool";
      if (name === "ask_user_input_v0") {
        names.push(summarizeAskUserQuestions(action.input));
        continue;
      }
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
      names.push(detail ? `${name}: ${detail}` : name);
    }
  } else if (Array.isArray(agentUi?.modelTurns)) {
    for (const turn of agentUi.modelTurns) {
      for (const part of turn.assistant ?? []) {
        if (part.type !== "tool_use" || !part.name) continue;
        if (part.name === "ask_user_input_v0") {
          names.push(
            summarizeAskUserQuestions(
              part.input && typeof part.input === "object"
                ? (part.input as Record<string, unknown>)
                : undefined,
            ),
          );
          continue;
        }
        names.push(part.name);
      }
    }
  }

  if (names.length === 0) return "";
  return `[Prior tools this turn: ${[...new Set(names)].slice(0, 12).join("; ")}]`;
}

/**
 * Durable plain-text context for a prior assistant turn.
 * Never replays signed thinking / tool_use blocks (those break follow-ups when
 * signatures are missing). ChatGPT/Claude-style: prior answer text + compact tool note.
 */
export function assistantContextTextFromRow(row: MessageRow): string {
  const agentUi = readAgentUi(row);
  const modelTurns = Array.isArray(agentUi?.modelTurns)
    ? agentUi.modelTurns
    : [];

  const fromRowContent = stripMessageContentForModelApi(row.content ?? "");
  const fromTurns = stripMessageContentForModelApi(
    textFromModelTurns(modelTurns),
  );
  const fromParts = stripMessageContentForModelApi(
    textFromParts(readTranscriptParts(row)),
  );

  // Prefer persisted visible answer; fall back to transcribed model text.
  const answer = fromRowContent || fromTurns || fromParts;
  const summary = summarizeAgentActions(agentUi);

  if (answer && summary) return `${answer}\n\n${summary}`;
  if (answer) return answer;
  if (summary) return summary;
  return "";
}

/**
 * Merge DB history with client turns so follow-ups never lose prior assistant
 * answers when a row is still empty / mid-persist.
 */
export function mergePromptHistories(
  primary: PromptMessage[],
  fallback: PromptMessage[],
): PromptMessage[] {
  if (primary.length === 0) return fallback;
  if (fallback.length === 0) return primary;

  const merged = [...primary];
  const fallbackAssistants = fallback.filter((m) => m.role === "assistant");
  let fallbackAssistantIdx = 0;

  for (let i = 0; i < merged.length; i += 1) {
    const msg = merged[i];
    if (msg?.role !== "assistant") continue;
    const content =
      typeof msg.content === "string" ? msg.content.trim() : "";
    if (content) {
      fallbackAssistantIdx += 1;
      continue;
    }
    const fb = fallbackAssistants[fallbackAssistantIdx];
    fallbackAssistantIdx += 1;
    if (fb && typeof fb.content === "string" && fb.content.trim()) {
      merged[i] = { role: "assistant", content: fb.content };
    }
  }

  // If DB is missing trailing history the client still has, append unique tail.
  if (fallback.length > merged.length) {
    const tail = fallback.slice(merged.length);
    for (const turn of tail) {
      const last = merged[merged.length - 1];
      if (
        last &&
        last.role === turn.role &&
        typeof last.content === "string" &&
        typeof turn.content === "string" &&
        last.content === turn.content
      ) {
        continue;
      }
      merged.push(turn);
    }
  }

  return coerceAlternatingRoles(merged);
}

/** Ensure user/assistant alternation for Anthropic Messages API. */
function coerceAlternatingRoles(messages: PromptMessage[]): PromptMessage[] {
  const out: PromptMessage[] = [];
  for (const msg of messages) {
    if (msg.role !== "user" && msg.role !== "assistant") continue;
    const content =
      typeof msg.content === "string"
        ? msg.content.trim()
        : Array.isArray(msg.content)
          ? msg.content
          : "";
    if (typeof content === "string" && !content) continue;

    const last = out[out.length - 1];
    if (last && last.role === msg.role && typeof content === "string") {
      // Merge consecutive same-role turns instead of dropping context.
      const prev =
        typeof last.content === "string" ? last.content.trim() : "";
      if (prev === content) continue;
      out[out.length - 1] = {
        role: msg.role,
        content: prev ? `${prev}\n\n${content}` : content,
      };
      continue;
    }
    out.push(
      typeof content === "string"
        ? { role: msg.role, content }
        : { role: msg.role, content: msg.content },
    );
  }
  return out;
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
    structured.push({ role: "assistant", content: assistantText });
  }

  const coerced = coerceAlternatingRoles(structured);
  const plainCoerced: IncomingMessage[] = coerced.map((m) => ({
    role: m.role as "user" | "assistant",
    content: typeof m.content === "string" ? m.content : "",
  })).filter((m) => m.content.length > 0);

  return { plain: plainCoerced, structured: coerced };
}
