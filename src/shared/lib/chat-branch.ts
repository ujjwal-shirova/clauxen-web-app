import type { Message, MessageBranchVersion } from "@/lib/types";

// Align with POST /api/v1/chats/[chatId]/messages — cap branch edit payloads client-side
const MAX_MESSAGE_CONTENT_CHARS = 256 * 1024;

export const stripMessageForSnapshot = (message: Message): Message => ({
  id: message.id,
  // Turn identity MUST survive the round-trip: the store sorts restored
  // threads by turn, and without clientId/turnId/createdAt every restored
  // message collapses to the same sort key and users group before assistants.
  clientId: message.clientId,
  turnId: message.turnId,
  createdAt: message.createdAt,
  role: message.role,
  content: message.content,
  attachments: message.attachments,
  thinkingContent: message.thinkingContent,
  hasThinking: message.hasThinking,
  thinkingDurationSeconds: message.thinkingDurationSeconds,
  generationFailed: message.generationFailed,
  agentMode: message.agentMode,
  agentFrameComplete: message.agentFrameComplete,
  agentTrace: message.agentTrace,
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
    generationFailed: version.generationFailed,
    agentMode: version.agentMode,
    agentFrameComplete: version.agentFrameComplete,
    agentTrace: version.agentTrace,
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

const hasUsableVersions = (
  versions: readonly MessageBranchVersion[] | undefined,
): versions is readonly MessageBranchVersion[] =>
  !!versions && versions.length > 1;

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
    // Only multi-version metadata counts. Stale singletons (e.g. a leftover
    // placeholder version whose content never synced) must never override —
    // treating them as absent also auto-heals legacy state.
    const snapshotMeta = hasUsableVersions(msg.branchVersions)
      ? {
          branchVersions: msg.branchVersions,
          activeBranchIndex: msg.activeBranchIndex,
        }
      : null;
    const currentMeta = currentMetaMap.get(msg.id);
    const usableCurrentMeta = hasUsableVersions(currentMeta?.branchVersions)
      ? currentMeta
      : null;
    const meta = snapshotMeta ?? usableCurrentMeta;

    if (!meta?.branchVersions) {
      // Neither side truly branches: drop any stale singleton versions so
      // content and version metadata can never disagree downstream.
      if (!msg.branchVersions?.length) return msg;
      const clean = { ...msg };
      delete clean.branchVersions;
      delete clean.activeBranchIndex;
      return clean;
    }
    const mergedVersions = [...meta.branchVersions];
    const merged: Message = {
      ...msg,
      branchVersions: mergedVersions,
      activeBranchIndex: meta.activeBranchIndex,
    };
    // The merged versions may come from the other side than the content —
    // re-hydrate content from the merged active version so the visible text
    // and the version index always agree.
    return hydrateMessageFromActiveBranch(
      merged,
      merged.activeBranchIndex ?? mergedVersions.length - 1,
    );
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
          generationFailed: message.generationFailed,
          agentMode: message.agentMode,
          agentFrameComplete: message.agentFrameComplete,
          agentTrace: message.agentTrace,
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
    generationFailed: active.generationFailed,
    agentMode: active.agentMode,
    agentFrameComplete: active.agentFrameComplete,
    agentTrace: active.agentTrace,
    agentArtifacts: active.agentArtifacts,
    activeBranchIndex: safeIndex,
    branchVersions: versions,
    isStreaming: false,
    isThinkingStreaming: false,
  };
};

/**
 * Write the live message fields back into its active version. Forking (edit /
 * retry) calls this BEFORE appending the new version so the version being
 * left behind always holds the exact content on screen — including content
 * streamed after the version was created. No-op when the message never
 * branched (versions materialize from live content on demand instead).
 */
export function syncActiveVersionFromLive(message: Message): Message {
  const versions = message.branchVersions;
  if (!versions?.length) return message;
  const activeIndex = Math.max(
    0,
    Math.min(
      message.activeBranchIndex ?? versions.length - 1,
      versions.length - 1,
    ),
  );
  const nextVersions = [...versions];
  nextVersions[activeIndex] = {
    ...nextVersions[activeIndex],
    content: message.content,
    attachments: message.attachments,
    thinkingContent: message.thinkingContent,
    hasThinking: message.hasThinking,
    thinkingDurationSeconds: message.thinkingDurationSeconds,
    generationFailed: message.generationFailed,
    agentMode: message.agentMode,
    agentFrameComplete: message.agentFrameComplete,
    agentTrace: message.agentTrace,
    agentArtifacts: message.agentArtifacts,
  };
  return {
    ...message,
    branchVersions: nextVersions,
    activeBranchIndex: activeIndex,
  };
}

/** Pure list-level variant for post-stream sync in mutation callbacks. */
export function syncMessageActiveVersion(
  messages: Message[],
  messageId: string,
): Message[] {
  return messages.map((msg) =>
    msg.id === messageId ? syncActiveVersionFromLive(msg) : msg,
  );
}

/**
 * Refresh the active version's snapshot to the current thread.
 *
 * UNIFORM RULE: a version's snapshot always reflects the thread as last seen
 * on that version. Refreshing (overwrite) on every switch-away — instead of
 * keeping the first snapshot forever — is what keeps messages sent on a
 * restored branch (new turns, follow-ups) from being lost by the next switch.
 */
export function refreshSnapshotForActiveBranch(
  chatMessages: Message[],
  messageId: string,
): Message[] {
  const targetMessage = chatMessages.find((msg) => msg.id === messageId);
  if (!targetMessage) return chatMessages;

  const versions = ensureBranchVersions(targetMessage);
  const activeIndex = Math.max(
    0,
    Math.min(
      targetMessage.activeBranchIndex ?? versions.length - 1,
      versions.length - 1,
    ),
  );

  const snapshot = createChatSnapshot(chatMessages);
  return chatMessages.map((msg) => {
    if (msg.id !== messageId) return msg;
    const nextVersions = [...versions];
    nextVersions[activeIndex] = {
      ...nextVersions[activeIndex],
      snapshot,
    };
    return {
      ...msg,
      branchVersions: nextVersions,
      activeBranchIndex: activeIndex,
    };
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
    const active = Math.max(
      0,
      Math.min(
        msg.activeBranchIndex ?? versions.length - 1,
        versions.length - 1,
      ),
    );
    const nextVersions = [...versions];
    nextVersions[active] = {
      ...nextVersions[active],
      snapshot,
    };
    return { ...msg, branchVersions: nextVersions, activeBranchIndex: active };
  });
}

function stampSnapshotOnCurrentBranchVersion(
  message: Message,
  snapshot: Message[],
): Message {
  const versions = ensureBranchVersions(message);
  const normalizedVersions = [...versions];
  const currentIndex = Math.max(
    0,
    Math.min(
      message.activeBranchIndex ?? normalizedVersions.length - 1,
      normalizedVersions.length - 1,
    ),
  );

  // Overwrite, never keep-if-exists: the version being forked from must
  // remember the pre-fork thread (including turns sent since the version was
  // created or last restored), not the state from an earlier visit.
  normalizedVersions[currentIndex] = {
    ...normalizedVersions[currentIndex],
    snapshot,
  };

  return {
    ...message,
    branchVersions: normalizedVersions,
    activeBranchIndex: currentIndex,
  };
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
  // Settle the live content into the version being left before forking, then
  // stamp the pre-fork thread on it.
  const targetWithSnapshot = stampSnapshotOnCurrentBranchVersion(
    syncActiveVersionFromLive(targetMessage),
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

  // No placeholder versions: the fresh answer carries no branch metadata
  // until it actually branches, at which point v1 materializes from the real
  // streamed content. (A placeholder empty v1 used to clobber the streamed
  // answer on the first retry of an edited turn.)
  const assistantMessage: Message = {
    id: newAssistantId,
    role: "assistant",
    content: "",
    thinkingContent: "",
    isStreaming: true,
    isThinkingStreaming: false,
    hasThinking: false,
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
  // Settle the live answer into the version being regenerated from — without
  // this the previous answer is lost the moment the new stream overwrites it.
  const assistantWithSnapshot = stampSnapshotOnCurrentBranchVersion(
    syncActiveVersionFromLive(assistantMessage),
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
  const targetMessage = chatMessages.find((msg) => msg.id === messageId);
  if (!targetMessage) {
    return { nextChat: chatMessages, nextActiveIndex: 0, totalVersions: 1 };
  }

  const versions = ensureBranchVersions(targetMessage);
  const current = Math.max(
    0,
    Math.min(
      targetMessage.activeBranchIndex ?? versions.length - 1,
      versions.length - 1,
    ),
  );
  const next = direction === "prev" ? current - 1 : current + 1;

  // No-op switches return the input untouched — capturing a snapshot on a
  // dead-end click would stamp misleading restore state for no reason.
  if (versions.length <= 1 || next < 0 || next >= versions.length) {
    return {
      nextChat: chatMessages,
      nextActiveIndex: current,
      totalVersions: versions.length,
    };
  }

  // Real switch: refresh the version being left to the exact thread on
  // screen (this is what preserves turns sent on a restored branch), settle
  // live content into it, then restore the target.
  const settledMessages = chatMessages.map((msg) =>
    msg.id === messageId ? syncActiveVersionFromLive(msg) : msg,
  );
  const messagesWithSnapshot = refreshSnapshotForActiveBranch(
    settledMessages,
    messageId,
  );
  const refreshedTarget = messagesWithSnapshot.find(
    (msg) => msg.id === messageId,
  );
  const refreshedVersions = refreshedTarget
    ? ensureBranchVersions(refreshedTarget)
    : versions;
  const nextVersion = refreshedVersions[next];
  const snapshot = nextVersion?.snapshot;

  if (snapshot && snapshot.length > 0) {
    // mergeSnapshotWithBranchMeta re-hydrates every branched message from its
    // merged active version; the switch target is then pinned to `next`.
    const snapshotWithMeta = mergeSnapshotWithBranchMeta(
      snapshot,
      messagesWithSnapshot,
    ).map((msg) =>
      msg.id === messageId ? hydrateMessageFromActiveBranch(msg, next) : msg,
    );

    return {
      nextChat: snapshotWithMeta,
      nextActiveIndex: next,
      totalVersions: refreshedVersions.length,
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
    totalVersions: refreshedVersions.length,
  };
}
