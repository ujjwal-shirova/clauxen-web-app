import type { AskUserQuestion } from "@/frontend/components/agent/ask-user-input-card";
import type { AgentToolSegment } from "@/frontend/lib/agent-segments";
import type { Message } from "@/frontend/lib/types";

function collectTools(message: Message): AgentToolSegment[] {
  const fromFrames =
    message.agentFrames?.flatMap((frame) =>
      frame.segments.filter(
        (segment): segment is AgentToolSegment => segment.kind === "tool",
      ),
    ) ?? [];
  if (fromFrames.length > 0) return fromFrames;
  return (
    message.agentSegments?.filter(
      (segment): segment is AgentToolSegment => segment.kind === "tool",
    ) ?? []
  );
}

function questionsFromTool(tool: AgentToolSegment): AskUserQuestion[] {
  const questions = tool.args?.questions;
  if (!Array.isArray(questions) || questions.length === 0) return [];
  return questions.filter(
    (item): item is AskUserQuestion =>
      Boolean(item) &&
      typeof item === "object" &&
      typeof (item as AskUserQuestion).question === "string" &&
      Array.isArray((item as AskUserQuestion).options),
  );
}

/** Latest unanswered ask_user_input_v0 questionnaire for the active chat. */
export function findPendingAskUserInput(
  messages: Message[] | undefined,
): AskUserQuestion[] | null {
  if (!messages || messages.length === 0) return null;

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]!;
    if (message.role === "user") return null;
    if (message.role !== "assistant") continue;

    const askTools = collectTools(message).filter(
      (tool) =>
        tool.name === "ask_user_input_v0" &&
        tool.status === "done" &&
        !tool.result?.includes('"error"'),
    );
    if (askTools.length === 0) continue;

    const questions = questionsFromTool(askTools[askTools.length - 1]!);
    return questions.length > 0 ? questions : null;
  }

  return null;
}
