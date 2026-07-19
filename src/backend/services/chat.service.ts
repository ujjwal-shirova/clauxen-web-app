import { AppError, notFound } from "@/backend/db/errors";
import * as chatsRepo from "@/backend/repositories/chats.repository";
import * as pinnedChatsRepo from "@/backend/repositories/pinned-chats.repository";
import * as messagePartsRepo from "@/backend/repositories/chat-message-parts.repository";
import * as messagesRepo from "@/backend/repositories/messages.repository";
import * as branchesRepo from "@/backend/repositories/branches.repository";
import * as transcriptRepo from "@/backend/repositories/transcript.repository";
import { createChatStream } from "@/app/api/chat/stream";
import type { AgentStreamOptions } from "@/backend/inference/agent-engine";
import type { HomerReasoningEffort } from "@/lib/model-effort";
import {
  encodeSseEvent,
  sanitizeMessages,
  tapChatSseStream,
  type IncomingMessage,
} from "@/backend/inference/novita";
import { generateOpenAiTitle } from "@/backend/inference/openai-stream";
import { resolveInferenceRoute } from "@/lib/inference-routing";
import { parseChatModelId } from "@/lib/model-catalog";
import { logInferenceTelemetry } from "@/backend/telemetry/inference-log";
import { query } from "@/backend/db/pool";
import * as billingService from "@/backend/services/billing.service";
import {
  normalizeInlineChatTitle,
  finalizeChatTitleStrippedAnswer,
  resolveGenerateChatTitle,
  deriveTitleFromExchange,
} from "@/lib/chat-title";
import {
  buildAssistantTranscriptRecord,
  buildTurnEndedRecord,
  buildToolResultUserRecord,
  buildUserTranscriptRecord,
  type CapturedToolCall,
  type TranscriptAgentModelTurn,
} from "@/backend/training/transcript-format";

async function persistUserTranscriptLine(input: {
  chatId: string;
  userId: string;
  messageId?: string | null;
  content: string;
}) {
  const record = buildUserTranscriptRecord(input.content);
  try {
    await transcriptRepo.appendTranscriptLine({
      chatId: input.chatId,
      userId: input.userId,
      messageId: input.messageId,
      role: "user",
      record,
    });
  } catch (error) {
    console.warn("[transcript] failed to append user line:", error);
  }
  return record;
}

async function persistAssistantTranscriptTurn(input: {
  chatId: string;
  userId: string;
  messageId?: string | null;
  answer: string;
  thinking?: string;
  tools: CapturedToolCall[];
  modelTurns?: TranscriptAgentModelTurn[];
  status: "success" | "error" | "cancelled";
}) {
  const record = buildAssistantTranscriptRecord({
    answer: input.answer,
    thinking: input.thinking,
    tools: input.tools,
  });
  try {
    if (input.modelTurns?.length) {
      for (const turn of input.modelTurns) {
        await transcriptRepo.appendTranscriptLine({
          chatId: input.chatId,
          userId: input.userId,
          messageId: input.messageId,
          role: "assistant",
          record: {
            role: "assistant",
            message: { content: turn.assistant },
          },
        });
        if (turn.toolResults?.length) {
          await transcriptRepo.appendTranscriptLine({
            chatId: input.chatId,
            userId: input.userId,
            messageId: input.messageId,
            role: "user",
            record: {
              role: "user",
              message: { content: turn.toolResults },
            },
          });
        }
      }
    } else {
      await transcriptRepo.appendTranscriptLine({
        chatId: input.chatId,
        userId: input.userId,
        messageId: input.messageId,
        role: "assistant",
        record,
      });
      const toolResults = buildToolResultUserRecord(input.tools);
      if (toolResults) {
        await transcriptRepo.appendTranscriptLine({
          chatId: input.chatId,
          userId: input.userId,
          messageId: input.messageId,
          role: "user",
          record: toolResults,
        });
      }
    }
    await transcriptRepo.appendTranscriptLine({
      chatId: input.chatId,
      userId: input.userId,
      messageId: input.messageId,
      role: "meta",
      record: buildTurnEndedRecord(input.status),
    });
  } catch (error) {
    console.warn("[transcript] failed to append assistant turn:", error);
  }
  return record;
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
  await messagesRepo.finalizeStaleStreamingMessages(chatId).catch(() => 0);
  const { listMessagesPagePreferEdge } = await import(
    "@/backend/chat/list-messages-page"
  );
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
    const { invalidateChatHistoryCache } = await import(
      "@/backend/chat/warm-history-cache"
    );
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
      kind: mime.startsWith("image/") ? ("image" as const) : ("document" as const),
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
  const chat = await chatsRepo.getChatForUser(chatId, userId);
  if (!chat) throw notFound("Chat not found.");

  const attachmentsMeta = await resolveUserAttachmentMeta(userId, fileIds);

  const contentJson = buildUserTranscriptRecord(content);
  const message = await messagesRepo.createMessage({
    chatId,
    userId,
    role: "user",
    content,
    contentJson,
    metadata: userMessageMetadata({
      attachments: attachmentsMeta,
      modelContent: options?.modelContent,
      content,
    }),
    clientId: options?.clientId,
  });
  if (message?.id && fileIds?.length) {
    await messagePartsRepo.attachFilePartsToMessage(
      message.id,
      fileIds,
      userId,
    );
  }
  await persistUserTranscriptLine({
    chatId,
    userId,
    messageId: message?.id ?? null,
    content,
  });
  const { invalidateChatHistoryCache } = await import(
    "@/backend/chat/warm-history-cache"
  );
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
    userClientId: string;
    assistantClientId: string;
  };
  signal?: AbortSignal;
  userCountryCode?: string;
  generateChatTitle?: boolean;
  chatModel?: string;
  homerReasoningEffort?: HomerReasoningEffort;
  onPauseForUser?: () => void | Promise<void>;
}) {
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
    const attachments = await resolveUserAttachmentMeta(
      input.userId,
      input.turn.fileIds,
    );
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

    if (turn.user.inserted) {
      await persistUserTranscriptLine({
        chatId: input.chatId,
        userId: input.userId,
        messageId: turn.user.id,
        content: input.turn.content,
      });
    }

    // A turn is durable before inference begins. Invalidate edge caches in the
    // background — awaiting Worker RTT here delayed first token and let the
    // client paint a blank streaming orb while generation had not started.
    void import("@/backend/chat/warm-history-cache")
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

  // Prompt context from DB recent turns so partial client pages cannot starve
  // the model. Model-only attachment context is kept in metadata, while the
  // user-visible text remains the canonical message content.
  const dbRecent = await messagesRepo.listRecentMessagesForChat(
    input.chatId,
    40,
  );
  const fromDb: IncomingMessage[] = dbRecent
    .filter((row) => row.role === "user" || row.role === "assistant")
    .map((row) => {
      const modelContent =
        row.role === "user" &&
        typeof (row.metadata as { model_content?: unknown })?.model_content ===
          "string"
          ? String(
              (row.metadata as { model_content?: string }).model_content,
            ).trim()
          : (row.content ?? "").trim();
      return {
        role: row.role as "user" | "assistant",
        content: modelContent,
      };
    })
    .filter((message) => message.content.length > 0);

  const structuredFromDb: AgentStreamOptions["messages"] = [];
  for (const row of dbRecent) {
    if (row.role !== "user" && row.role !== "assistant") continue;

    if (row.role === "user") {
      const modelContent =
        typeof (row.metadata as { model_content?: unknown })?.model_content ===
        "string"
          ? String(
              (row.metadata as { model_content?: string }).model_content,
            ).trim()
          : (row.content ?? "").trim();
      if (modelContent) {
        structuredFromDb.push({ role: "user", content: modelContent });
      }
      continue;
    }

    const storedAgentUi = (
      row.content_json as {
        agent_ui?: { modelTurns?: TranscriptAgentModelTurn[] };
      }
    )?.agent_ui;
    const storedTurns = Array.isArray(storedAgentUi?.modelTurns)
      ? storedAgentUi.modelTurns
      : [];

    if (storedTurns.length > 0) {
      for (const turn of storedTurns) {
        const assistantBlocks = Array.isArray(turn.assistant)
          ? turn.assistant.filter((part) => part.type !== "tool_result")
          : [];
        if (assistantBlocks.length > 0) {
          structuredFromDb.push({
            role: "assistant",
            content:
              assistantBlocks as AgentStreamOptions["messages"][number]["content"],
          });
        }
        if (Array.isArray(turn.toolResults) && turn.toolResults.length > 0) {
          structuredFromDb.push({
            role: "user",
            content:
              turn.toolResults as AgentStreamOptions["messages"][number]["content"],
          });
        }
      }
      continue;
    }

    const content = (row.content ?? "").trim();
    if (content) {
      structuredFromDb.push({ role: "assistant", content });
    }
  }

  let conversationForModel =
    fromDb.length > 0 ? fromDb : clientConversation;
  let conversationForAgent =
    structuredFromDb.length > 0
      ? structuredFromDb
      : clientConversation.map((message) => ({
          role: message.role,
          content: message.content,
        }));
  if (lastClientUser) {
    const lastDbUserIndex = (() => {
      for (let i = conversationForModel.length - 1; i >= 0; i -= 1) {
        if (conversationForModel[i]?.role === "user") return i;
      }
      return -1;
    })();
    if (lastDbUserIndex >= 0) {
      conversationForModel = conversationForModel.map((message, index) =>
        index === lastDbUserIndex
          ? { ...message, content: lastClientUser.content }
          : message,
      );
    } else {
      conversationForModel = [...conversationForModel, lastClientUser];
    }

    let lastAgentUserIndex = -1;
    for (let i = conversationForAgent.length - 1; i >= 0; i -= 1) {
      if (
        conversationForAgent[i]?.role === "user" &&
        typeof conversationForAgent[i]?.content === "string"
      ) {
        lastAgentUserIndex = i;
        break;
      }
    }
    if (lastAgentUserIndex >= 0) {
      conversationForAgent = conversationForAgent.map((message, index) =>
        index === lastAgentUserIndex
          ? { ...message, content: lastClientUser.content }
          : message,
      );
    } else {
      conversationForAgent = [
        ...conversationForAgent,
        { role: "user", content: lastClientUser.content },
      ];
    }
  }

  const generateChatTitle = resolveGenerateChatTitle(
    clientConversation,
    input.generateChatTitle ??
      (chat.title.trim().toLowerCase() === "new chat" &&
        clientConversation.filter((message) => message.role === "user")
          .length === 1),
  );
  const titleUserContent = input.turn?.content ?? requestedUserContent;
  let generatedTitle: string | null = null;

  const started = Date.now();
  let answer = "";
  let thinking = "";
  let streamError: string | null = null;
  /** Wall time spent in thinking phases only (excludes tool execution). */
  let thinkingStartedAtMs: number | null = null;
  let thinkingAccumulatedMs = 0;
  const toolsById = new Map<string, CapturedToolCall>();
  const modelTurns: TranscriptAgentModelTurn[] = [];

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
    const sourceStream = await createChatStream(conversationForModel, {
      chatModel: input.chatModel,
      userId: input.userId,
      conversationId: input.chatId,
      userCountryCode: input.userCountryCode,
      generateChatTitle,
      signal: input.signal,
      homerReasoningEffort: input.homerReasoningEffort,
      onPauseForUser: input.onPauseForUser,
      modelMessages: conversationForAgent,
      onModelTurn: (turn) => {
        modelTurns.push(turn);
      },
    });
    const body = tapChatSseStream(
      sourceStream,
      {
        onAnswerDelta: (delta) => {
          answer += delta;
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
          streamError = message.trim() || "The model could not complete this response.";
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
        ? `Generation failed: ${streamError}`
        : generatedAnswer.trim()
          ? generatedAnswer
          : pausedForUserInput
            ? ""
            : "I couldn't produce a response for that message. Please try again.";
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
        await messagesRepo.updateMessageContent(
          assistantRow.id,
          input.chatId,
          cleanedAnswer,
          completionStatus,
          contentJson,
        );
        if (!wasCancelled && generatedTitle) {
          await chatsRepo.updateChat(input.chatId, input.userId, {
            title: generatedTitle,
          });
        }
        await persistAssistantTranscriptTurn({
          chatId: input.chatId,
          userId: input.userId,
          messageId: assistantRow.id,
          answer: cleanedAnswer,
          thinking,
          tools,
          modelTurns,
          status: wasCancelled || failed ? "error" : "success",
        });
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

      void import("@/backend/chat/warm-history-cache")
        .then(({ warmChatHistoryCache }) =>
          warmChatHistoryCache({
            userId: input.userId,
            chatId: input.chatId,
            limits: [2, 20, 500],
          }),
        )
        .catch(() => {});

      void import("@/backend/chat/enqueue-chat-job")
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
      const failedContent = answer || "Generation failed.";
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
      await messagesRepo.updateMessageContent(
        assistantRow.id,
        input.chatId,
        failedContent,
        "failed",
        contentJson,
      );
      await persistAssistantTranscriptTurn({
        chatId: input.chatId,
        userId: input.userId,
        messageId: assistantRow.id,
        answer: failedContent,
        thinking,
        tools,
        modelTurns,
        status: "error",
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
  const { invalidateChatHistoryCache } = await import(
    "@/backend/chat/warm-history-cache"
  );
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
  const aggregated = await transcriptRepo.getChatTranscriptJsonl(chatId, userId);
  if (aggregated?.jsonl) return aggregated;

  const lines = await transcriptRepo.listTranscriptLines(chatId, userId);
  return {
    chat_id: chatId,
    user_id: userId,
    chat_title: chat.title,
    line_count: lines.length,
    training_eligible: lines.every((line) => line.training_eligible),
    jsonl: lines.map((line) => JSON.stringify(line.record)).join("\n"),
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
