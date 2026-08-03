import type { Message, MessageBranchVersion } from "@/lib/types";

// Align with POST /api/v1/chats/[chatId]/messages — cap branch edit payloads client-side
const MAX_MESSAGE_CONTENT_CHARS = 256 * 1024;

export const stripMessageForSnapshot = (message: Message): Message => ({
  id: message.id,
  role: message.role,
  content: message.content,
  attachments: message.attachments,
  thinkingContent: message.thinkingContent,
  hasThinking: message.hasThinking,
  thinkingDurationSeconds: message.thinkingDurationSeconds,
  agentMode: message.agentMode,
  agentFrameComplete: message.agentFrameComplete,
  agentSegments: message.agentSegments,
  agentFrames: message.agentFrames,
  agentArtifacts: message.agentArtifacts,
});

const stripNestedSnapshots = (
  versions: readonly MessageBranchVersion[],
): MessageBranchVersion[] =>
  versions.map((version) => ({
    content: version.content,
    attachments: version.attachments,
    thinkingContent: version.thinkingContent,
    hasThinking: version.hasThinking,
    thinkingDurationSeconds: version.thinkingDurationSeconds,
    agentMode: version.agentMode,
    agentFrameComplete: version.agentFrameComplete,
    agentSegments: version.agentSegments,
    agentFrames: version.agentFrames,
    agentArtifacts: version.agentArtifacts,
  }));

export const createChatSnapshot = (messages: Message[]): Message[] =>
  messages.map((message) => {
    const base = stripMessageForSnapshot(message);
    if (!message.branchVersions?.length || message.branchVersions.length <= 1) {
      return base;
    }
    return {
      ...base,
      branchVersions: stripNestedSnapshots(message.branchVersions),
      activeBranchIndex: message.activeBranchIndex,
    };
  });

export const compactMessageBranchData = (message: Message): Message => {
  const versionCount = message.branchVersions?.length ?? 0;
  const hasBranchSnapshots = message.branchVersions?.some(
    (version) => version.snapshot && version.snapshot.length > 0,
  );

  if (versionCount <= 1 && !hasBranchSnapshots) {
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
  const currentMetaMap = new Map(
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
    const snapshotMeta =
      msg.branchVersions && msg.branchVersions.length > 1
        ? {
            branchVersions: msg.branchVersions,
            activeBranchIndex: msg.activeBranchIndex,
          }
        : null;
    const currentMeta = currentMetaMap.get(msg.id);
    const meta =
      snapshotMeta?.branchVersions?.length
        ? snapshotMeta
        : currentMeta?.branchVersions?.length
          ? currentMeta
          : null;

    if (!meta?.branchVersions?.length) return msg;
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
          attachments: message.attachments,
          thinkingContent: message.thinkingContent,
          hasThinking: message.hasThinking,
          thinkingDurationSeconds: message.thinkingDurationSeconds,
          agentMode: message.agentMode,
          agentFrameComplete: message.agentFrameComplete,
          agentSegments: message.agentSegments,
          agentFrames: message.agentFrames,
          agentArtifacts: message.agentArtifacts,
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
    attachments: active.attachments ?? message.attachments,
    thinkingContent: active.thinkingContent,
    hasThinking: active.hasThinking,
    thinkingDurationSeconds: active.thinkingDurationSeconds,
    agentMode: active.agentMode,
    agentFrameComplete: active.agentFrameComplete,
    agentSegments: active.agentSegments,
    agentFrames: active.agentFrames,
    agentArtifacts: active.agentArtifacts,
    activeBranchIndex: safeIndex,
    branchVersions: versions,
    isStreaming: false,
    isThinkingStreaming: false,
  };
};

export function captureSnapshotForActiveBranch(
  chatMessages: Message[],
  messageId: string,
): Message[] {
  const targetMessage = chatMessages.find((msg) => msg.id === messageId);
  if (!targetMessage) return chatMessages;

  const versions = ensureBranchVersions(targetMessage);
  const activeIndex =
    targetMessage.activeBranchIndex ?? versions.length - 1;
  if (versions[activeIndex]?.snapshot?.length) {
    return chatMessages;
  }

  const snapshot = createChatSnapshot(chatMessages);
  return chatMessages.map((msg) => {
    if (msg.id !== messageId) return msg;
    const nextVersions = [...versions];
    nextVersions[activeIndex] = {
      ...nextVersions[activeIndex],
      snapshot,
    };
    return { ...msg, branchVersions: nextVersions };
  });
}

export function attachSnapshotToBranchVersion(
  messages: Message[],
  branchMessageId: string,
  snapshot: Message[] = createChatSnapshot(messages),
): Message[] {
  return messages.map((msg) => {
    if (msg.id !== branchMessageId) return msg;
    const versions = ensureBranchVersions(msg);
    const active = msg.activeBranchIndex ?? versions.length - 1;
    const nextVersions = [...versions];
    nextVersions[active] = {
      ...nextVersions[active],
      snapshot,
    };
    return { ...msg, branchVersions: nextVersions };
  });
}

function saveSnapshotOnCurrentBranchVersion(
  message: Message,
  snapshot: Message[],
): Message {
  const versions = ensureBranchVersions(message);
  const normalizedVersions = [...versions];
  const currentIndex =
    message.activeBranchIndex ?? normalizedVersions.length - 1;

  if (!normalizedVersions[currentIndex]?.snapshot?.length) {
    normalizedVersions[currentIndex] = {
      ...normalizedVersions[currentIndex],
      snapshot,
    };
  }

  return { ...message, branchVersions: normalizedVersions };
}

function rebuildChatWithoutSnapshot(
  chatMessages: Message[],
  messageId: string,
  nextBranchIndex: number,
): Message[] {
  const targetMessage = chatMessages.find((msg) => msg.id === messageId);
  if (!targetMessage) return chatMessages;

  if (targetMessage.role === "user") {
    const userIndex = chatMessages.findIndex((msg) => msg.id === messageId);
    if (userIndex === -1) return chatMessages;
    return chatMessages
      .slice(0, userIndex + 1)
      .map((msg) =>
        msg.id === messageId
          ? hydrateMessageFromActiveBranch(msg, nextBranchIndex)
          : msg,
      );
  }

  return chatMessages.map((msg) =>
    msg.id === messageId
      ? hydrateMessageFromActiveBranch(msg, nextBranchIndex)
      : msg,
  );
}

export function editMessageWithBranchHelper(
  existing: Message[],
  messageId: string,
  newContent: string,
  newAssistantId: string,
  attachments?: Message["attachments"],
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
  const nextAttachments =
    attachments !== undefined ? attachments : targetMessage.attachments;
  const baseSnapshot = createChatSnapshot(existing);
  const targetWithSnapshot = saveSnapshotOnCurrentBranchVersion(
    targetMessage,
    baseSnapshot,
  );
  const targetVersions = ensureBranchVersions(targetWithSnapshot);

  const nextUserVersions = [
    ...targetVersions,
    { content: newContent, attachments: nextAttachments },
  ];
  const updatedUserMessage: Message = {
    ...targetWithSnapshot,
    content: newContent,
    attachments: nextAttachments,
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

export function redoUserMessageWithBranchHelper(
  existing: Message[],
  messageId: string,
  newAssistantId: string,
) {
  const targetMessage = existing.find(
    (msg) => msg.id === messageId && msg.role === "user",
  );
  if (!targetMessage) {
    throw new Error("Target user message not found");
  }
  return editMessageWithBranchHelper(
    existing,
    messageId,
    targetMessage.content,
    newAssistantId,
  );
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
  const baseSnapshot = createChatSnapshot(existing);
  const assistantWithSnapshot = saveSnapshotOnCurrentBranchVersion(
    assistantMessage,
    baseSnapshot,
  );
  const existingVersions = ensureBranchVersions(assistantWithSnapshot);

  const nextBranchIndex = existingVersions.length;
  const nextVersions = [
    ...existingVersions,
    {
      content: "",
      thinkingContent: "",
      hasThinking: false,
    },
  ];

  const updatedAssistant: Message = {
    ...assistantWithSnapshot,
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
  const messagesWithSnapshot = captureSnapshotForActiveBranch(
    chatMessages,
    messageId,
  );
  const targetMessage = messagesWithSnapshot.find((msg) => msg.id === messageId);
  if (!targetMessage) {
    return { nextChat: chatMessages, nextActiveIndex: 0, totalVersions: 1 };
  }

  const versions = ensureBranchVersions(targetMessage);
  if (versions.length <= 1) {
    return {
      nextChat: messagesWithSnapshot,
      nextActiveIndex: 0,
      totalVersions: versions.length,
    };
  }

  const current = targetMessage.activeBranchIndex ?? versions.length - 1;
  const next = direction === "prev" ? current - 1 : current + 1;
  if (next < 0 || next >= versions.length) {
    return {
      nextChat: messagesWithSnapshot,
      nextActiveIndex: current,
      totalVersions: versions.length,
    };
  }

  const nextVersion = versions[next];
  const snapshot = nextVersion.snapshot;

  if (snapshot && snapshot.length > 0) {
    const snapshotWithMeta = mergeSnapshotWithBranchMeta(
      snapshot,
      messagesWithSnapshot,
    ).map((msg) =>
      msg.id === messageId ? hydrateMessageFromActiveBranch(msg, next) : msg,
    );

    return {
      nextChat: snapshotWithMeta,
      nextActiveIndex: next,
      totalVersions: versions.length,
    };
  }

  const nextChat = rebuildChatWithoutSnapshot(
    messagesWithSnapshot,
    messageId,
    next,
  );

  return {
    nextChat,
    nextActiveIndex: next,
    totalVersions: versions.length,
  };
}
