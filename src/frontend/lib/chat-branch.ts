import type { Message, MessageBranchVersion } from "@/frontend/lib/types";

// Align with POST /api/v1/chats/[chatId]/messages — cap branch edit payloads client-side
const MAX_MESSAGE_CONTENT_CHARS = 256 * 1024;

export const stripMessageForSnapshot = (message: Message): Message => ({
  id: message.id,
  role: message.role,
  content: message.content,
  thinkingContent: message.thinkingContent,
  hasThinking: message.hasThinking,
  thinkingDurationSeconds: message.thinkingDurationSeconds,
  agentMode: message.agentMode,
  agentFrameComplete: message.agentFrameComplete,
  agentSegments: message.agentSegments,
});

export const createChatSnapshot = (messages: Message[]): Message[] =>
  messages.map(stripMessageForSnapshot);

export const compactMessageBranchData = (message: Message): Message => {
  if (!message.branchVersions?.length || message.branchVersions.length === 1) {
    const compact = { ...message };
    delete compact.branchVersions;
    delete compact.activeBranchIndex;
    return compact;
  }

  return message;
};

export const mergeSnapshotWithBranchMeta = (
  snapshot: readonly Message[],
  currentMessages: readonly Message[],
): Message[] => {
  const branchMetaMap = new Map(
    currentMessages.map(
      (msg) =>
        [
          msg.id,
          {
            branchVersions: msg.branchVersions,
            activeBranchIndex: msg.activeBranchIndex,
          },
        ] as const,
    ),
  );

  return snapshot.map((msg) => {
    const meta = branchMetaMap.get(msg.id);
    if (!meta) return msg;
    return {
      ...msg,
      branchVersions: meta.branchVersions,
      activeBranchIndex: meta.activeBranchIndex,
    };
  });
};

export const ensureBranchVersions = (
  message: Message,
): MessageBranchVersion[] =>
  message.branchVersions?.length
    ? message.branchVersions
    : [
        {
          content: message.content,
          thinkingContent: message.thinkingContent,
          hasThinking: message.hasThinking,
          thinkingDurationSeconds: message.thinkingDurationSeconds,
          agentMode: message.agentMode,
          agentFrameComplete: message.agentFrameComplete,
          agentSegments: message.agentSegments,
        },
      ];

export const hydrateMessageFromActiveBranch = (
  message: Message,
  branchIndex: number,
): Message => {
  const versions = ensureBranchVersions(message);
  const safeIndex = Math.max(0, Math.min(branchIndex, versions.length - 1));
  const active = versions[safeIndex];

  return {
    ...message,
    content: active.content,
    thinkingContent: active.thinkingContent,
    hasThinking: active.hasThinking,
    thinkingDurationSeconds: active.thinkingDurationSeconds,
    agentMode: active.agentMode,
    agentFrameComplete: active.agentFrameComplete,
    agentSegments: active.agentSegments,
    activeBranchIndex: safeIndex,
    branchVersions: versions,
  };
};

export function editMessageWithBranchHelper(
  existing: Message[],
  messageId: string,
  newContent: string,
  newAssistantId: string,
): {
  nextChat: Message[];
  updatedUserMessage: Message;
  assistantMessage: Message;
  targetIndex: number;
} {
  const targetIndex = existing.findIndex(
    (msg) => msg.id === messageId && msg.role === "user",
  );
  if (targetIndex === -1) {
    throw new Error("Target user message not found");
  }

  if (newContent.length > MAX_MESSAGE_CONTENT_CHARS) {
    throw new Error("Message content is too long");
  }

  const targetMessage = existing[targetIndex];
  const targetVersions = ensureBranchVersions(targetMessage);
  const baseSnapshot = createChatSnapshot(existing);
  const normalizedTargetVersions = [...targetVersions];
  const currentTargetIndex =
    targetMessage.activeBranchIndex ?? normalizedTargetVersions.length - 1;

  if (!normalizedTargetVersions[currentTargetIndex]?.snapshot) {
    normalizedTargetVersions[currentTargetIndex] = {
      ...normalizedTargetVersions[currentTargetIndex],
      snapshot: baseSnapshot,
    };
  }

  const nextUserVersions = [
    ...normalizedTargetVersions,
    { content: newContent },
  ];
  const updatedUserMessage: Message = {
    ...targetMessage,
    content: newContent,
    branchVersions: nextUserVersions,
    activeBranchIndex: nextUserVersions.length - 1,
  };

  const assistantMessage: Message = {
    id: newAssistantId,
    role: "assistant",
    content: "",
    thinkingContent: "",
    isStreaming: true,
    isThinkingStreaming: false,
    hasThinking: false,
    activeBranchIndex: 0,
    branchVersions: [{ content: "", thinkingContent: "", hasThinking: false }],
  };

  const nextChat = [
    ...existing.slice(0, targetIndex),
    updatedUserMessage,
    assistantMessage,
  ];
  return { nextChat, updatedUserMessage, assistantMessage, targetIndex };
}

export function retryAssistantWithBranchHelper(
  existing: Message[],
  assistantMessageId: string,
): {
  nextChat: Message[];
  updatedAssistant: Message;
  assistantIndex: number;
} {
  const assistantIndex = existing.findIndex(
    (msg) => msg.id === assistantMessageId && msg.role === "assistant",
  );
  if (assistantIndex === -1) {
    throw new Error("Assistant message not found");
  }

  const assistantMessage = existing[assistantIndex];
  const existingVersions = ensureBranchVersions(assistantMessage);
  const baseSnapshot = createChatSnapshot(existing);
  const normalizedAssistantVersions = [...existingVersions];
  const currentAssistantIndex =
    assistantMessage.activeBranchIndex ??
    normalizedAssistantVersions.length - 1;

  if (!normalizedAssistantVersions[currentAssistantIndex]?.snapshot) {
    normalizedAssistantVersions[currentAssistantIndex] = {
      ...normalizedAssistantVersions[currentAssistantIndex],
      snapshot: baseSnapshot,
    };
  }

  const nextBranchIndex = normalizedAssistantVersions.length;
  const nextVersions = [
    ...normalizedAssistantVersions,
    {
      content: "",
      thinkingContent: "",
      hasThinking: false,
    },
  ];

  const updatedAssistant: Message = {
    ...assistantMessage,
    content: "",
    thinkingContent: "",
    hasThinking: false,
    isStreaming: true,
    isThinkingStreaming: false,
    thinkingDurationSeconds: undefined,
    thinkingStartedAtMs: undefined,
    branchVersions: nextVersions,
    activeBranchIndex: nextBranchIndex,
  };

  const nextChat = [...existing.slice(0, assistantIndex), updatedAssistant];
  return { nextChat, updatedAssistant, assistantIndex };
}

export function switchMessageBranchHelper(
  chatMessages: Message[],
  messageId: string,
  direction: "prev" | "next",
): {
  nextChat: Message[];
  nextActiveIndex: number;
  totalVersions: number;
} {
  const targetMessage = chatMessages.find((msg) => msg.id === messageId);
  if (!targetMessage) {
    return { nextChat: chatMessages, nextActiveIndex: 0, totalVersions: 1 };
  }
  const versions = ensureBranchVersions(targetMessage);
  if (versions.length <= 1) {
    return {
      nextChat: chatMessages,
      nextActiveIndex: 0,
      totalVersions: versions.length,
    };
  }
  const current = targetMessage.activeBranchIndex ?? versions.length - 1;
  const next = direction === "prev" ? current - 1 : current + 1;
  if (next < 0 || next >= versions.length) {
    return {
      nextChat: chatMessages,
      nextActiveIndex: current,
      totalVersions: versions.length,
    };
  }
  const nextVersion = versions[next];
  const snapshot = nextVersion.snapshot;

  if (!snapshot || snapshot.length === 0) {
    const nextChat = chatMessages.map((msg) =>
      msg.id === messageId ? hydrateMessageFromActiveBranch(msg, next) : msg,
    );
    return { nextChat, nextActiveIndex: next, totalVersions: versions.length };
  }

  const snapshotWithMeta = mergeSnapshotWithBranchMeta(
    snapshot,
    chatMessages,
  ).map((msg) =>
    msg.id === messageId ? hydrateMessageFromActiveBranch(msg, next) : msg,
  );

  return {
    nextChat: snapshotWithMeta,
    nextActiveIndex: next,
    totalVersions: versions.length,
  };
}
