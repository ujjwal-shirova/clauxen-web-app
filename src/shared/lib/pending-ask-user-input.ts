import type { AskUserQuestion } from "@/components/agent/ask-user-input-card";
import type { AgentToolStep } from "@/lib/agent-trace";
import type { Message } from "@/lib/types";

function collectTools(message: Message): AgentToolStep[] {
  return (message.agentTrace?.steps ?? []).filter(
    (step): step is AgentToolStep => step.kind === "tool",
  );
}

function coerceQuestionList(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function questionsFromTool(tool: AgentToolStep): AskUserQuestion[] {
  const questions = coerceQuestionList(tool.args?.questions);
  if (questions.length === 0) return [];
  return questions.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const question =
      typeof record.question === "string" ? record.question.trim() : "";
    if (!question) return [];
    const optionsRaw = Array.isArray(record.options)
      ? record.options
      : Array.isArray(record.choices)
        ? record.choices
        : [];
    const options = optionsRaw
      .filter((option): option is string => typeof option === "string")
      .map((option) => option.trim())
      .filter(Boolean);
    if (options.length === 0) return [];
    const type =
      record.type === "multi_select" ||
      record.type === "rank_priorities" ||
      record.type === "single_select"
        ? record.type
        : undefined;
    return [{ question, options, ...(type ? { type } : {}) }];
  });
}

function isPendingAskTool(tool: AgentToolStep): boolean {
  if (tool.name !== "ask_user_input_v0") return false;
  if (tool.status === "error") return false;
  // Accept done (normal pause) and running (args landed, tool_end in flight).
  if (tool.status !== "done" && tool.status !== "running") return false;
  if (tool.result?.includes('"error"')) return false;
  return true;
}

/** Latest unanswered ask_user_input_v0 questionnaire for the active chat. */
export function findPendingAskUserInput(
  messages: Message[] | undefined,
): AskUserQuestion[] | null {
  if (!messages || messages.length === 0) return null;

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]!;
    // A newer user message means the questionnaire was already answered
    // (or the turn moved on).
    if (message.role === "user") return null;
    if (message.role !== "assistant") continue;

    const askTools = collectTools(message).filter(isPendingAskTool);
    if (askTools.length === 0) continue;

    const questions = questionsFromTool(askTools[askTools.length - 1]!);
    // Args may still be streaming in — keep scanning rather than giving up.
    if (questions.length === 0) continue;
    return questions;
  }

  return null;
}
