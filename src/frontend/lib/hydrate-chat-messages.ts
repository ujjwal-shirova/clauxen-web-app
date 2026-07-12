import type { Message } from "@/frontend/lib/types";
import type { AgentFrame } from "@/frontend/lib/agent-frames";
import type { AgentSegment } from "@/frontend/lib/agent-segments";
import type {
  TranscriptContentPart,
  TranscriptMessageRecord,
} from "@/backend/training/transcript-format";

/**
 * Hydrate a UI Message from chat_messages.content_json when it is Cursor-style
 * JSONL (`{ role, message: { content: [...] } }`).
 */
export function hydrateMessageFromContentJson(
  base: Message,
  contentJson: unknown,
): Message {
  if (!contentJson || typeof contentJson !== "object") return base;
  const record = contentJson as Partial<TranscriptMessageRecord>;
  if (!record.message || !Array.isArray(record.message.content)) return base;

  const parts = record.message.content as TranscriptContentPart[];
  let thinking = base.thinkingContent ?? "";
  const tools: AgentSegment[] = [];
  const texts: string[] = [];

  for (const part of parts) {
    if (!part || typeof part !== "object") continue;
    if (part.type === "thinking" && typeof part.thinking === "string") {
      thinking = part.thinking;
      continue;
    }
    if (part.type === "text" && typeof part.text === "string") {
      texts.push(part.text);
      continue;
    }
    if (part.type === "tool_use" && typeof part.name === "string") {
      const id =
        typeof part.id === "string" && part.id
          ? part.id
          : `tool-${tools.length + 1}`;
      const resultPart = parts.find(
        (candidate) =>
          candidate?.type === "tool_result" &&
          candidate.tool_use_id === id,
      );
      tools.push({
        kind: "tool",
        id,
        toolCallId: id,
        name: part.name,
        status: "done",
        args:
          part.input && typeof part.input === "object"
            ? part.input
            : {},
        result:
          resultPart && resultPart.type === "tool_result"
            ? resultPart.content
            : undefined,
      });
    }
  }

  const contentFromParts = texts.join("\n\n").trim();
  const content = contentFromParts || base.content;
  const hasThinking = Boolean(thinking.trim());
  const hasTools = tools.length > 0;

  if (!hasThinking && !hasTools && !contentFromParts) return base;

  const frames: AgentFrame[] | undefined = hasTools || hasThinking
    ? [
        {
          id: `hydrated-${base.id}`,
          complete: true,
          startedAtMs: base.createdAt ?? Date.now(),
          completedAtMs: Date.now(),
          segments: [
            ...(hasThinking
              ? [
                  {
                    kind: "thinking" as const,
                    id: `thinking-${base.id}`,
                    content: thinking,
                    isStreaming: false,
                  },
                ]
              : []),
            ...tools,
          ],
        },
      ]
    : undefined;

  return {
    ...base,
    content,
    thinkingContent: hasThinking ? thinking : base.thinkingContent,
    hasThinking: hasThinking || base.hasThinking,
    agentMode: hasTools || hasThinking || base.agentMode,
    agentFrameComplete: frames ? true : base.agentFrameComplete,
    agentFrames: frames ?? base.agentFrames,
    agentSegments: frames?.[0]?.segments ?? base.agentSegments,
  };
}

/** Prefer branch tree when it has real message ids; otherwise use API rows. */
export function resolveHydratedChatMessages(input: {
  apiMessages: Message[];
  branchMessages: unknown;
}): Message[] {
  const branch = Array.isArray(input.branchMessages)
    ? (input.branchMessages as Message[])
    : [];
  const branchHasIds =
    branch.length > 0 &&
    branch.every(
      (message) =>
        typeof message?.id === "string" &&
        message.id.length > 0 &&
        (message.role === "user" || message.role === "assistant"),
    );

  if (branchHasIds) {
    // Dedupe by id while preserving order — guards against corrupt trees.
    const seen = new Set<string>();
    const deduped: Message[] = [];
    for (const message of branch) {
      if (seen.has(message.id)) continue;
      seen.add(message.id);
      deduped.push(message);
    }
    return deduped;
  }

  return input.apiMessages;
}
