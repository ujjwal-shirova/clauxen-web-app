import { AppError, notFound } from "@/backend/db/errors";
import * as chatsRepo from "@/backend/repositories/chats.repository";
import * as pinnedChatsRepo from "@/backend/repositories/pinned-chats.repository";
import * as messagePartsRepo from "@/backend/repositories/chat-message-parts.repository";
import * as messagesRepo from "@/backend/repositories/messages.repository";
import * as branchesRepo from "@/backend/repositories/branches.repository";
import * as transcriptRepo from "@/backend/repositories/transcript.repository";
import { createChatStream } from "@/app/api/chat/stream";
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
  messagesToTranscriptRecords,
  type CapturedToolCall,
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
  status: "success" | "error" | "cancelled";
}) {
  const record = buildAssistantTranscriptRecord({
    answer: input.answer,
    thinking: input.thinking,
    tools: input.tools,
  });
  try {
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
  return chatsRepo.createChatFast({
    userId,
    title: input?.title,
    projectId: input?.projectId,
  });
}

export async function appendUserMessage(
  chatId: string,
  userId: string,
  content: string,
  fileIds?: string[],
) {
  const chat = await chatsRepo.getChatForUser(chatId, userId);
  if (!chat) throw notFound("Chat not found.");

  let attachmentsMeta: Array<{
    id: string;
    name: string;
    mimeType: string;
    kind: "image" | "document";
    fileId: string;
  }> = [];

  if (fileIds?.length) {
    const { query } = await import("@/backend/db/pool");
    const files = await query<{
      id: string;
      original_name: string;
      mime_type: string | null;
    }>(
      `select id, original_name, mime_type
       from public.user_files
       where user_id = $1 and id = any($2::uuid[]) and status != 'deleted'`,
      [userId, fileIds],
    );
    attachmentsMeta = files.map((file) => {
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

  const contentJson = buildUserTranscriptRecord(content);
  const message = await messagesRepo.createMessage({
    chatId,
    userId,
    role: "user",
    content,
    contentJson,
    metadata: attachmentsMeta.length
      ? { attachments: attachmentsMeta }
      : undefined,
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
  return message;
}

async function persistLatestUserMessage(
  chatId: string,
  userId: string,
  messages: IncomingMessage[],
) {
  const lastUser = [...messages]
    .reverse()
    .find((m) => m.role === "user" && m.content.trim());
  if (!lastUser) return;

  const existing = await messagesRepo.listMessagesForChat(chatId);
  const lastDbUser = [...existing].reverse().find((m) => m.role === "user");
  if (lastDbUser?.content === lastUser.content) return;

  await appendUserMessage(chatId, userId, lastUser.content);
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
  signal?: AbortSignal;
  userCountryCode?: string;
  generateChatTitle?: boolean;
  chatModel?: string;
  homerReasoningEffort?: HomerReasoningEffort;
}) {
  const chat = await chatsRepo.getChatForUser(input.chatId, input.userId);
  if (!chat) throw notFound("Chat not found.");

  const clientConversation = sanitizeMessages(input.messages).filter(
    (message) => message.content.trim().length > 0,
  );
  if (!clientConversation.length) {
    throw new AppError("messages are required.", 400);
  }

  // Prompt context from DB recent turns so partial client pages cannot starve
  // the model. Prefer the client's latest user turn content when present.
  const dbRecent = await messagesRepo.listRecentMessagesForChat(
    input.chatId,
    40,
  );
  const fromDb: IncomingMessage[] = dbRecent
    .filter((row) => row.role === "user" || row.role === "assistant")
    .map((row) => ({
      role: row.role as "user" | "assistant",
      content: (row.content ?? "").trim(),
    }))
    .filter((message) => message.content.length > 0);

  const lastClientUser = [...clientConversation]
    .reverse()
    .find((message) => message.role === "user");
  let conversationForModel =
    fromDb.length > 0 ? fromDb : clientConversation;
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
  }

  // Persist user message without blocking the inference stream.
  void persistLatestUserMessage(
    input.chatId,
    input.userId,
    clientConversation,
  );

  const generateChatTitle = resolveGenerateChatTitle(
    clientConversation,
    input.generateChatTitle ??
      (chat.title.trim().toLowerCase() === "new chat" &&
        clientConversation.filter((message) => message.role === "user")
          .length === 1),
  );
  const titleUserContent =
    clientConversation.find((message) => message.role === "user")?.content ??
    "";
  let generatedTitle: string | null = null;

  const started = Date.now();
  let answer = "";
  let thinking = "";
  const toolsById = new Map<string, CapturedToolCall>();

  const modelForTelemetry = resolveInferenceRoute({
    chatModel: parseChatModelId(input.chatModel),
  }).modelSlug;

  let assistant: Awaited<ReturnType<typeof messagesRepo.createMessage>> | null =
    null;
  const assistantPromise = messagesRepo
    .createMessage({
      chatId: input.chatId,
      userId: input.userId,
      role: "assistant",
      content: "",
      status: "streaming",
      contentJson: buildAssistantTranscriptRecord({ answer: "" }),
    })
    .then((row) => {
      assistant = row;
      return row;
    });

  const sourceStream = await createChatStream(conversationForModel, {
    chatModel: input.chatModel,
    userId: input.userId,
    conversationId: input.chatId,
    userCountryCode: input.userCountryCode,
    generateChatTitle,
    signal: input.signal,
    homerReasoningEffort: input.homerReasoningEffort,
  });

  try {
    const body = tapChatSseStream(
      sourceStream,
      {
        onAnswerDelta: (delta) => {
          answer += delta;
        },
        onThinkingDelta: (delta) => {
          thinking += delta;
        },
        onChatTitle: (title) => {
          generatedTitle = normalizeInlineChatTitle(title, titleUserContent);
        },
        onToolStart: (tool) => {
          toolsById.set(tool.toolCallId, {
            id: tool.toolCallId,
            name: tool.name,
            input: tool.args ?? {},
          });
        },
        onToolEnd: (tool) => {
          const existing = toolsById.get(tool.toolCallId);
          toolsById.set(tool.toolCallId, {
            id: tool.toolCallId,
            name: tool.name || existing?.name || "tool",
            input: existing?.input ?? {},
            result: tool.result,
          });
        },
      },
      input.signal,
    );

    const persistOnDone = async () => {
      const assistantRow = assistant ?? (await assistantPromise);
      const cleanedAnswer = finalizeChatTitleStrippedAnswer(answer);
      const tools = Array.from(toolsById.values());
      const contentJson = buildAssistantTranscriptRecord({
        answer: cleanedAnswer,
        thinking,
        tools,
      });
      if (assistantRow?.id) {
        await messagesRepo.updateMessageContent(
          assistantRow.id,
          input.chatId,
          cleanedAnswer,
          "complete",
          contentJson,
        );
        if (generatedTitle) {
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
          status: "success",
        });
      }
      const latencyMs = Date.now() - started;
      await logInferenceTelemetry({
        userId: input.userId,
        mode: "chat",
        status: "success",
        model: modelForTelemetry,
        messageCount: clientConversation.length,
        responseCharacterCount: answer.length,
        latencyMs,
      });
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
            limit: 2,
          }),
        )
        .catch(() => {});
    };

    return {
      stream: body,
      assistantMessageId: (await assistantPromise)?.id ?? null,
      onComplete: persistOnDone,
    };
  } catch (error) {
    const assistantRow = assistant ?? (await assistantPromise.catch(() => null));
    const tools = Array.from(toolsById.values());
    if (assistantRow?.id) {
      const failedContent = answer || "Generation failed.";
      const contentJson = buildAssistantTranscriptRecord({
        answer: failedContent,
        thinking,
        tools,
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

  // Branch tree is canonical for edits/retries — rebuild JSONL from it.
  if (Array.isArray(messages)) {
    try {
      const lines = messagesToTranscriptRecords(
        messages as Array<{
          id?: string;
          role: string;
          content?: string;
          thinkingContent?: string;
          agentSegments?: Array<{
            kind: string;
            toolCallId?: string;
            name?: string;
            args?: Record<string, unknown>;
            result?: string;
            status?: string;
          }>;
          agentFrames?: Array<{
            segments?: Array<{
              kind: string;
              toolCallId?: string;
              name?: string;
              args?: Record<string, unknown>;
              result?: string;
              status?: string;
            }>;
          }>;
        }>,
      );
      await transcriptRepo.replaceTranscriptLines({
        chatId,
        userId,
        lines: lines.map((line) => ({
          role: line.role,
          record: line.record,
          messageId: line.messageId,
        })),
      });
    } catch (error) {
      console.warn("[transcript] failed to rebuild from branch state:", error);
    }
  }

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
