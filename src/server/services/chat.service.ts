import { AppError, notFound } from "@/server/db/errors";
import * as chatsRepo from "@/server/repositories/chats.repository";
import * as pinnedChatsRepo from "@/server/repositories/pinned-chats.repository";
import * as messagesRepo from "@/server/repositories/messages.repository";
import type { MessageTranscriptLine } from "@/server/repositories/messages.repository";
import * as branchesRepo from "@/server/repositories/branches.repository";
import * as transcriptRepo from "@/server/repositories/transcript.repository";
import { createChatStream, loadChatStreamPersonalization } from "@/app/api/chat/stream";
import type { AgentStreamOptions } from "@/server/agent-core";
import type { HomerReasoningEffort } from "@/lib/model-effort";
import {
  encodeSseEvent,
  sanitizeMessages,
  tapChatSseStream,
  type IncomingMessage,
} from "@/server/inference/novita";
import { generateOpenAiTitle } from "@/server/inference/openai-stream";
import { resolveInferenceRoute } from "@/lib/inference-routing";
import { parseChatModelId } from "@/lib/model-catalog";
import { logInferenceTelemetry } from "@/server/telemetry/inference-log";
import { query } from "@/server/db/pool";
import * as billingService from "@/server/services/billing.service";
import {
  normalizeInlineChatTitle,
  finalizeChatTitleStrippedAnswer,
  resolveGenerateChatTitle,
  deriveTitleFromExchange,
} from "@/lib/chat-title";
import {
  buildAssistantTranscriptRecord,
  buildToolResultUserRecord,
  buildTurnEndedRecord,
  buildUserTranscriptRecord,
  messagesToTranscriptRecords,
  recordsToJsonl,
  type CapturedToolCall,
  type TranscriptAgentModelTurn,
} from "@/server/training/transcript-format";
import {
  buildPromptMessagesFromDbRows,
  mergePromptHistories,
} from "@/server/inference/build-chat-prompt-messages";
import {
  resolveVisionImageBlocks,
  withVisionUserContent,
  type ClientVisionImage,
} from "@/server/inference/vision-attachments";
import {
  toUserFacingChatError,
  EMPTY_ASSISTANT_RESPONSE_FALLBACK,
} from "@/lib/assistant-generation-error";

/**
 * Build all export/training lines for one assistant turn. The repository
 * commits these beside chat_messages.content_json in one transaction.
 */
function buildAssistantTranscriptLines(input: {
  assistantRecord: ReturnType<typeof buildAssistantTranscriptRecord>;
  tools: CapturedToolCall[];
  status: "success" | "error" | "cancelled";
}): MessageTranscriptLine[] {
  const lines: MessageTranscriptLine[] = [
    {
      role: "assistant",
      record: input.assistantRecord,
    },
  ];
  const toolResults = buildToolResultUserRecord(input.tools);
  if (toolResults) lines.push({ role: "user", record: toolResults });
  lines.push({
    role: "meta",
    record: buildTurnEndedRecord(
      input.status === "success"
        ? "success"
        : input.status === "cancelled"
          ? "cancelled"
          : "error",
    ),
  });
  return lines;
}

export async function listRecentChats(userId: string, projectId?: string) {
  const [chats, pinned] = await Promise.all([
    chatsRepo.listChatsForUser(userId, {
      projectId: projectId ?? undefined,
    }),
    pinnedChatsRepo.listPinnedChats(userId),
  ]);
  const pinnedIds = new Set(pinned.map((p) => p.chat_id));

  return chats.map((chat) => ({
    id: chat.id,
    name: chat.title,
    projectId: chat.project_id,
    starred: chat.starred,
    pinned: pinnedIds.has(chat.id),
    updatedAt: chat.updated_at,
  }));
}

export async function getChatWithMessages(chatId: string, userId: string) {
  const chat = await chatsRepo.getChatForUser(chatId, userId);
  if (!chat) throw notFound("Chat not found.");
  await messagesRepo.finalizeStaleStreamingMessages(chatId).catch(() => 0);
  const messages = await messagesRepo.listMessagesForChat(chatId);
  return { chat, messages };
}

/** Keyset page for conversation UI (default latest page). */
export async function getChatMessagesPage(
  chatId: string,
  userId: string,
  input?: {
    cursorId?: string | null;
    cursorCreatedAt?: string | null;
    limit?: number;
    accessToken?: string | null;
  },
) {
  const chat = await chatsRepo.getChatForUser(chatId, userId);
  if (!chat) throw notFound("Chat not found.");
  // Do not await — a write must not sit on the GET hydrate path (pool.max=1).
  void messagesRepo.finalizeStaleStreamingMessages(chatId).catch(() => 0);
  const { listMessagesPagePreferEdge } =
    await import("@/server/chat/list-messages-page");
  const page = await listMessagesPagePreferEdge({
    chatId,
    userId,
    accessToken: input?.accessToken,
    cursorId: input?.cursorId,
    cursorCreatedAt: input?.cursorCreatedAt,
    limit: input?.limit,
  });
  return { chat, ...page };
}

/** Recent chronological messages for inference when client history is partial. */
export async function getRecentMessagesForInference(
  chatId: string,
  userId: string,
  limit = 40,
) {
  const chat = await chatsRepo.getChatForUser(chatId, userId);
  if (!chat) throw notFound("Chat not found.");
  return messagesRepo.listRecentMessagesForChat(chatId, limit);
}

export async function createChatForUser(
  userId: string,
  input?: { title?: string; projectId?: string | null },
) {
  // Single round-trip: allocate id + insert with workspace from profiles subquery.
  const chat = await chatsRepo.createChatFast({
    userId,
    title: input?.title,
    projectId: input?.projectId,
  });
  if (chat) {
    const { invalidateChatHistoryCache } =
      await import("@/server/chat/warm-history-cache");
    await invalidateChatHistoryCache({ userId, listsOnly: true });
  }
  return chat;
}

type UserAttachmentMeta = {
  id: string;
  name: string;
  mimeType: string;
  kind: "image" | "document";
  fileId: string;
};

async function resolveUserAttachmentMeta(
  userId: string,
  fileIds?: string[],
): Promise<UserAttachmentMeta[]> {
  if (!fileIds?.length) return [];

  const files = await query<{
    id: string;
    original_name: string;
    mime_type: string | null;
  }>(
    `select id, original_name, mime_type
     from public.user_files
     where user_id = $1
       and id = any($2::uuid[])
       and status != 'deleted'`,
    [userId, fileIds],
  );

  return files.map((file) => {
    const mime = file.mime_type ?? "application/octet-stream";
    return {
      id: file.id,
      name: file.original_name,
      mimeType: mime,
      kind: mime.startsWith("image/")
        ? ("image" as const)
        : ("document" as const),
      fileId: file.id,
    };
  });
}

function userMessageMetadata(input: {
  attachments: UserAttachmentMeta[];
  modelContent?: string;
  content: string;
}): Record<string, unknown> | undefined {
  const metadata: Record<string, unknown> = {};
  if (input.attachments.length) metadata.attachments = input.attachments;
  if (
    input.modelContent &&
    input.modelContent.trim() &&
    input.modelContent.trim() !== input.content.trim()
  ) {
    // The raw content is shown to the user; the model-only attachment context
    // remains durable so follow-up turns can rebuild the same prompt.
    metadata.model_content = input.modelContent;
  }
  return Object.keys(metadata).length ? metadata : undefined;
}

export async function appendUserMessage(
  chatId: string,
  userId: string,
  content: string,
  fileIds?: string[],
  options?: { clientId?: string; modelContent?: string },
) {
  const attachmentsMeta = await resolveUserAttachmentMeta(userId, fileIds);

  const contentJson = buildUserTranscriptRecord(content);
  const message = await messagesRepo.createUserMessageWithTranscript({
    chatId,
    userId,
    content,
    contentJson,
    metadata: userMessageMetadata({
      attachments: attachmentsMeta,
      modelContent: options?.modelContent,
      content,
    }),
    fileIds,
  });
  const { invalidateChatHistoryCache } =
    await import("@/server/chat/warm-history-cache");
  await invalidateChatHistoryCache({ userId, chatId });
  return message;
}

export async function linkChatToProject(
  chatId: string,
  userId: string,
  projectId: string,
) {
  const chat = await chatsRepo.getChatForUser(chatId, userId);
  if (!chat) throw notFound("Chat not found.");
  const updated = await chatsRepo.updateChat(chatId, userId, { projectId });
  if (!updated) throw notFound("Chat not found.");
  return updated;
}

export async function streamChatGeneration(input: {
  chatId: string;
  userId: string;
  messages: IncomingMessage[];
  turn?: {
    content: string;
    modelContent?: string;
    fileIds?: string[];
    /** Client-side image bytes for Novita/Kimi vision (base64 or data URLs). */
    images?: ClientVisionImage[];
    userClientId: string;
    assistantClientId: string;
  };
  signal?: AbortSignal;
  userCountryCode?: string;
  /** IANA timezone from the browser (for prompt temporal context). */
  clientTimezone?: string;
  generateChatTitle?: boolean;
  chatModel?: string;
  homerReasoningEffort?: HomerReasoningEffort;
  extendedThinking?: boolean;
  onPauseForUser?: () => void | Promise<void>;
}) {
  // Kick personalization + history before ownership check so DB RTTs overlap.
  const personalizationPromise = loadChatStreamPersonalization(input.userId);
  const historyPromise = messagesRepo.listRecentMessagesForChat(
    input.chatId,
    40,
  );

  const chat = await chatsRepo.getChatForUser(input.chatId, input.userId);
  if (!chat) throw notFound("Chat not found.");

  const clientConversation = sanitizeMessages(input.messages).filter(
    (message) => message.content.trim().length > 0,
  );
  if (!clientConversation.length) {
    throw new AppError("messages are required.", 400);
  }

  const lastClientUser = [...clientConversation]
    .reverse()
    .find((message) => message.role === "user");
  const requestedUserContent =
    input.turn?.content.trim() || lastClientUser?.content.trim() || "";
  if (!requestedUserContent) {
    throw new AppError("A user message is required.", 400);
  }

  let userMessageId: string | null = null;
  let assistant: Awaited<ReturnType<typeof messagesRepo.createMessage>> | null =
    null;

  if (input.turn) {
    const attachments =
      input.turn.fileIds && input.turn.fileIds.length > 0
        ? await resolveUserAttachmentMeta(input.userId, input.turn.fileIds)
        : [];
    const turn = await messagesRepo.beginChatTurn({
      chatId: input.chatId,
      userId: input.userId,
      userContent: input.turn.content,
      userMetadata: userMessageMetadata({
        attachments,
        modelContent: input.turn.modelContent,
        content: input.turn.content,
      }),
      userContentJson: buildUserTranscriptRecord(input.turn.content),
      fileIds: input.turn.fileIds,
      userClientId: input.turn.userClientId,
      assistantClientId: input.turn.assistantClientId,
      assistantContentJson: buildAssistantTranscriptRecord({ answer: "" }),
    });
    assistant = turn.assistant;
    userMessageId = turn.user.id;

    // A turn is durable before inference begins. Invalidate edge caches in the
    // background — awaiting Worker RTT here delayed first token and let the
    // client paint a blank streaming orb while generation had not started.
    void import("@/server/chat/warm-history-cache")
      .then(({ invalidateChatHistoryCache }) =>
        invalidateChatHistoryCache({
          userId: input.userId,
          chatId: input.chatId,
        }),
      )
      .catch(() => false);

    if (!turn.assistant.inserted) {
      const status =
        turn.assistant.status === "streaming"
          ? "already generating"
          : "already completed";
      throw new AppError(
        `This chat turn is ${status}. Refresh the conversation before retrying.`,
        409,
        "chat_turn_exists",
      );
    }
  } else {
    // Compatibility path for older callers that persist their user row before
    // invoking generation. Main product chat always supplies `turn`.
    assistant = await messagesRepo.createMessage({
      chatId: input.chatId,
      userId: input.userId,
      role: "assistant",
      content: "",
      status: "streaming",
      contentJson: buildAssistantTranscriptRecord({ answer: "" }),
    });
  }

  const modelTurns: TranscriptAgentModelTurn[] = [];
  const started = Date.now();
  let answer = "";
  let thinking = "";
  let streamError: string | null = null;
  let thinkingStartedAtMs: number | null = null;
  let thinkingAccumulatedMs = 0;
  const toolsById = new Map<string, CapturedToolCall>();

  // Prompt context + vision attach run INSIDE the SSE body so the HTTP
  // response (and early `start` event) is not blocked on history/R2.
  // History + personalization were already kicked off beside the turn insert.
  const sourceStream = await createChatStream(
    clientConversation.map((m) => ({ role: m.role, content: m.content })),
    {
      chatModel: input.chatModel,
      userId: input.userId,
      conversationId: input.chatId,
      userCountryCode: input.userCountryCode,
      clientTimezone: input.clientTimezone,
      generateChatTitle: resolveGenerateChatTitle(
        clientConversation,
        input.generateChatTitle ??
          (chat.title.trim().toLowerCase() === "new chat" &&
            clientConversation.filter((message) => message.role === "user")
              .length === 1),
      ),
      signal: input.signal,
      homerReasoningEffort: input.homerReasoningEffort,
      extendedThinking: input.extendedThinking,
      onPauseForUser: input.onPauseForUser,
      onModelTurn: (turn) => {
        modelTurns.push(turn);
      },
      resolveContext: async () => {
        const [dbRecent, personalization] = await Promise.all([
          historyPromise,
          personalizationPromise,
        ]);
        const promptFromDb = buildPromptMessagesFromDbRows(dbRecent);
        const clientAsPrompt: AgentStreamOptions["messages"] =
          clientConversation.map((message) => ({
            role: message.role,
            content: message.content,
          }));
        let conversationForAgent = mergePromptHistories(
          promptFromDb.structured,
          clientAsPrompt,
        );

        const preferredUserContent =
          input.turn?.modelContent?.trim() ||
          lastClientUser?.content.trim() ||
          requestedUserContent;

        if (preferredUserContent) {
          let lastAgentUserIndex = -1;
          for (let i = conversationForAgent.length - 1; i >= 0; i -= 1) {
            if (conversationForAgent[i]?.role === "user") {
              lastAgentUserIndex = i;
              break;
            }
          }
          if (lastAgentUserIndex >= 0) {
            conversationForAgent = conversationForAgent.map((message, index) =>
              index === lastAgentUserIndex
                ? { ...message, content: preferredUserContent }
                : message,
            );
          } else {
            conversationForAgent = [
              ...conversationForAgent,
              { role: "user", content: preferredUserContent },
            ];
          }
        }

        const visionBlocks = await resolveVisionImageBlocks({
          userId: input.userId,
          fileIds: input.turn?.fileIds,
          clientImages: input.turn?.images,
        });

        if (visionBlocks.length > 0) {
          let lastUserIdx = -1;
          for (let i = conversationForAgent.length - 1; i >= 0; i -= 1) {
            if (conversationForAgent[i]?.role === "user") {
              lastUserIdx = i;
              break;
            }
          }
          if (lastUserIdx >= 0) {
            const current = conversationForAgent[lastUserIdx]!;
            const text =
              typeof current.content === "string"
                ? current.content
                : preferredUserContent;
            conversationForAgent = conversationForAgent.map((message, index) =>
              index === lastUserIdx
                ? {
                    ...message,
                    content: withVisionUserContent(text, visionBlocks),
                  }
                : message,
            );
          }
        }

        return {
          modelMessages: conversationForAgent,
          personalization,
        };
      },
    },
  );

  const titleUserContent = input.turn?.content ?? requestedUserContent;
  let generatedTitle: string | null = null;
  const conversationForModel: IncomingMessage[] = clientConversation;

  const beginThinkingPhase = () => {
    if (thinkingStartedAtMs == null) {
      thinkingStartedAtMs = Date.now();
    }
  };
  const endThinkingPhase = () => {
    if (thinkingStartedAtMs == null) return;
    thinkingAccumulatedMs += Math.max(0, Date.now() - thinkingStartedAtMs);
    thinkingStartedAtMs = null;
  };

  const modelForTelemetry = resolveInferenceRoute({
    chatModel: parseChatModelId(input.chatModel),
  }).modelSlug;

  try {
    // sourceStream already created above — continue into tapChatSseStream
    const body = tapChatSseStream(
      sourceStream,
      {
        onAnswerDelta: (delta) => {
          answer += delta;
        },
        onAnswerFinalize: (text) => {
          // The loop promotes the final-round text wholesale — replace, never
          // append (narration prose from earlier rounds is not the answer).
          answer = text;
        },
        onAnswerClear: () => {
          answer = "";
        },
        onThinkingStart: () => {
          beginThinkingPhase();
        },
        onThinkingDelta: (delta) => {
          beginThinkingPhase();
          thinking += delta;
        },
        onThinkingEnd: () => {
          endThinkingPhase();
        },
        onChatTitle: (title) => {
          generatedTitle = normalizeInlineChatTitle(title, titleUserContent);
        },
        onError: (message) => {
          streamError = toUserFacingChatError(
            message.trim() || "The model could not complete this response.",
          );
        },
        onToolStart: (tool) => {
          // Tool work is not thinking time.
          endThinkingPhase();
          const existing = toolsById.get(tool.toolCallId);
          toolsById.set(tool.toolCallId, {
            id: tool.toolCallId,
            name: tool.name,
            input: { ...existing?.input, ...(tool.args ?? {}) },
            description: tool.description ?? existing?.description,
            startedAtMs: existing?.startedAtMs ?? Date.now(),
          });
        },
        onToolEnd: (tool) => {
          const existing = toolsById.get(tool.toolCallId);
          toolsById.set(tool.toolCallId, {
            id: tool.toolCallId,
            name: tool.name || existing?.name || "tool",
            input: existing?.input ?? {},
            result: tool.result,
            isError: tool.isError === true,
            description: existing?.description,
            startedAtMs: existing?.startedAtMs,
            completedAtMs: Date.now(),
          });
        },
      },
      input.signal,
    );

    const persistOnDone = async () => {
      const assistantRow = assistant;
      const generatedAnswer = finalizeChatTitleStrippedAnswer(answer);
      const tools = Array.from(toolsById.values());
      const pausedForUserInput = tools.some(
        (tool) =>
          tool.name === "ask_user_input_v0" ||
          (typeof tool.result === "string" &&
            tool.result.includes("pending_user_input")),
      );
      // A terminal SSE error used to be persisted as an empty successful
      // assistant message. Make every terminal state visible and durable.
      // Ask-user pauses intentionally end with no answer text — that is not
      // a failed generation.
      const cleanedAnswer = streamError
        ? toUserFacingChatError(streamError)
        : generatedAnswer.trim()
          ? generatedAnswer
          : pausedForUserInput
            ? ""
            : EMPTY_ASSISTANT_RESPONSE_FALLBACK;
      const completedAtMs = Date.now();
      const wasCancelled = input.signal?.aborted === true;
      const failed =
        Boolean(streamError) ||
        (!generatedAnswer.trim() && !pausedForUserInput);
      const completionStatus = wasCancelled
        ? "cancelled"
        : failed
          ? "failed"
          : "complete";
      // Close any open thinking phase before persisting.
      endThinkingPhase();
      const thinkingDurationSeconds = thinking.trim()
        ? Math.max(1, Math.round(thinkingAccumulatedMs / 1000))
        : undefined;
      const contentJson = buildAssistantTranscriptRecord({
        answer: cleanedAnswer,
        thinking,
        tools,
        agentUi: {
          startedAtMs: started,
          completedAtMs,
          thinkingDurationSeconds,
          modelTurns,
          actions: tools.map((tool) => ({
            id: tool.id,
            name: tool.name,
            input: tool.input,
            result: tool.result,
            isError: tool.isError,
            description: tool.description,
            startedAtMs: tool.startedAtMs,
            completedAtMs: tool.completedAtMs,
          })),
        },
      });
      if (assistantRow?.id) {
        await messagesRepo.finalizeAssistantTurn({
          messageId: assistantRow.id,
          chatId: input.chatId,
          userId: input.userId,
          content: cleanedAnswer,
          status: completionStatus,
          contentJson,
          tools,
          transcriptLines: buildAssistantTranscriptLines({
            assistantRecord: contentJson,
            tools,
            status: wasCancelled ? "cancelled" : failed ? "error" : "success",
          }),
        });
        if (!wasCancelled && generatedTitle) {
          await chatsRepo.updateChat(input.chatId, input.userId, {
            title: generatedTitle,
          });
        }
      }
      const latencyMs = Date.now() - started;
      await logInferenceTelemetry({
        userId: input.userId,
        mode: "chat",
        status: wasCancelled || failed ? "error" : "success",
        model: modelForTelemetry,
        messageCount: clientConversation.length,
        responseCharacterCount: answer.length,
        latencyMs,
        ...(wasCancelled
          ? { errorMessage: "Generation cancelled." }
          : streamError
            ? { errorMessage: streamError }
            : failed
              ? { errorMessage: "Model completed without visible output." }
              : {}),
      });
      if (wasCancelled || failed) return;
      try {
        await billingService.meterChatGeneration({
          userId: input.userId,
          chatId: input.chatId,
          messageId: assistantRow?.id ?? null,
          modelId: modelForTelemetry,
          outputCharacters: answer.length,
          inputMessageCount: clientConversation.length,
          latencyMs,
        });
      } catch {
        // token metering is best-effort; stream already completed
      }

      void Promise.all([
        import("@/server/chat/warm-history-cache"),
        import("@/server/repositories/billing.repository"),
        import("@/lib/storage-quota"),
        import("@/lib/chat-hydrate-limits"),
      ])
        .then(
          ([
            { warmChatHistoryCache },
            billingRepo,
            { resolveActiveStoragePlanId },
            { warmLimitsForPlanId },
          ]) =>
            billingRepo.getUserSubscription(input.userId).then((sub) => {
              const planId = resolveActiveStoragePlanId(sub);
              return warmChatHistoryCache({
                userId: input.userId,
                chatId: input.chatId,
                planId,
                limits: warmLimitsForPlanId(planId),
                async: true,
              });
            }),
        )
        .catch(() => {});

      void import("@/server/chat/enqueue-chat-job")
        .then(({ enqueueChatJob }) =>
          Promise.all([
            enqueueChatJob("history_warm", {
              userId: input.userId,
              chatId: input.chatId,
            }),
            enqueueChatJob("chat_title", {
              userId: input.userId,
              chatId: input.chatId,
              messageId: assistantRow?.id ?? null,
            }),
          ]),
        )
        .catch(() => {});
    };

    return {
      stream: body,
      userMessageId,
      assistantMessageId: assistant?.id ?? null,
      onComplete: persistOnDone,
    };
  } catch (error) {
    const assistantRow = assistant;
    const tools = Array.from(toolsById.values());
    if (assistantRow?.id) {
      const failedContent = toUserFacingChatError(
        answer || (error instanceof Error ? error.message : String(error)),
      );
      const contentJson = buildAssistantTranscriptRecord({
        answer: failedContent,
        thinking,
        tools,
        agentUi: {
          startedAtMs: started,
          completedAtMs: Date.now(),
          modelTurns,
          actions: tools,
        },
      });
      await messagesRepo.finalizeAssistantTurn({
        messageId: assistantRow.id,
        chatId: input.chatId,
        userId: input.userId,
        content: failedContent,
        status: "failed",
        contentJson,
        tools,
        transcriptLines: buildAssistantTranscriptLines({
          assistantRecord: contentJson,
          tools,
          status: "error",
        }),
      });
    }
    await logInferenceTelemetry({
      userId: input.userId,
      mode: "chat",
      status: "error",
      model: modelForTelemetry,
      messageCount: input.messages.length,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      latencyMs: Date.now() - started,
    });
    throw error;
  }
}

export async function generateChatTitle(
  chatId: string,
  userId: string,
  messages: IncomingMessage[],
) {
  const chat = await chatsRepo.getChatForUser(chatId, userId);
  if (!chat) throw notFound("Chat not found.");
  if (chat.title.trim().toLowerCase() !== "new chat") {
    return chat.title;
  }

  let title: string;
  try {
    title = await generateOpenAiTitle(messages);
  } catch {
    title = "";
  }

  if (!title.trim()) {
    const user = messages.find((m) => m.role === "user")?.content ?? "";
    const assistant =
      messages.find((m) => m.role === "assistant")?.content ?? "";
    title = deriveTitleFromExchange(user, assistant);
  }

  const normalized = normalizeInlineChatTitle(
    title,
    messages.find((m) => m.role === "user")?.content ?? "",
  );
  await chatsRepo.updateChat(chatId, userId, { title: normalized });
  const { invalidateChatHistoryCache } =
    await import("@/server/chat/warm-history-cache");
  await invalidateChatHistoryCache({ userId, chatId });
  return normalized;
}

export async function saveBranchState(
  chatId: string,
  userId: string,
  activePath: unknown,
  messages: unknown,
) {
  const saved = await branchesRepo.upsertBranchState({
    chatId,
    userId,
    activePath,
    messages,
  });

  // Branch snapshots are UI state. Rebuilding the append-only transcript from
  // a debounced browser snapshot deletes durable stream records and can race a
  // still-finalizing assistant turn.
  return saved;
}

export async function getBranchState(chatId: string, userId: string) {
  return branchesRepo.getBranchState(chatId, userId);
}

export async function getChatTranscript(chatId: string, userId: string) {
  const chat = await chatsRepo.getChatForUser(chatId, userId);
  if (!chat) throw notFound("Chat not found.");
  const aggregated = await transcriptRepo.getChatTranscriptJsonl(
    chatId,
    userId,
  );
  if (aggregated?.jsonl?.trim()) return aggregated;

  const lines = await transcriptRepo.listTranscriptLines(chatId, userId);
  if (lines.length > 0) {
    return {
      chat_id: chatId,
      user_id: userId,
      chat_title: chat.title,
      line_count: lines.length,
      training_eligible: lines.every((line) => line.training_eligible),
      jsonl: lines.map((line) => JSON.stringify(line.record)).join("\n"),
    };
  }

  // Fallback: rebuild JSONL from durable content_json when export table is empty.
  const messages = await messagesRepo.listMessagesForChat(chatId);
  const rebuilt = messagesToTranscriptRecords(
    messages.map((row) => {
      const agentUi = (
        row.content_json as {
          agent_ui?: {
            actions?: Array<{
              id: string;
              name: string;
              input?: Record<string, unknown>;
              result?: string;
              isError?: boolean;
            }>;
          };
        }
      )?.agent_ui;
      return {
        id: row.id,
        role: row.role,
        content: row.content ?? "",
        agentFrames: agentUi?.actions?.length
          ? [
              {
                segments: agentUi.actions.map((action) => ({
                  kind: "tool",
                  toolCallId: action.id,
                  name: action.name,
                  args: action.input ?? {},
                  result: action.result,
                  status: action.isError ? "error" : "done",
                })),
              },
            ]
          : undefined,
      };
    }),
  );
  return {
    chat_id: chatId,
    user_id: userId,
    chat_title: chat.title,
    line_count: rebuilt.length,
    training_eligible: true,
    jsonl: recordsToJsonl(rebuilt.map((line) => line.record)),
  };
}

export async function legacyStreamFromMessages(
  messages: IncomingMessage[],
  signal?: AbortSignal,
  options?: {
    userId?: string;
    userCountryCode?: string;
    generateChatTitle?: boolean;
    chatModel?: string;
    conversationId?: string;
    homerReasoningEffort?: HomerReasoningEffort;
  },
): Promise<ReadableStream<Uint8Array>> {
  const generateChatTitle = resolveGenerateChatTitle(
    messages,
    options?.generateChatTitle,
  );

  return createChatStream(messages, {
    chatModel: options?.chatModel,
    userId: options?.userId,
    userCountryCode: options?.userCountryCode,
    generateChatTitle,
    conversationId: options?.conversationId,
    signal,
    homerReasoningEffort: options?.homerReasoningEffort,
  });
}

export { sanitizeMessages, encodeSseEvent };
