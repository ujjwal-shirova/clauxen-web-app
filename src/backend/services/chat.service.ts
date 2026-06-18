import { AppError, notFound } from "@/backend/db/errors";
import * as chatsRepo from "@/backend/repositories/chats.repository";
import * as messagesRepo from "@/backend/repositories/messages.repository";
import * as branchesRepo from "@/backend/repositories/branches.repository";
import { createChatSourceStream } from "@/backend/inference/chat-source-stream";
import {
  encodeSseEvent,
  resolveThinkingType,
  sanitizeMessages,
  tapChatSseStream,
  type IncomingMessage,
  type ThinkingType,
} from "@/backend/inference/novita";
import { generateOpenAiTitle } from "@/backend/inference/openai-stream";
import { env } from "@/backend/config/env";
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

export async function listRecentChats(userId: string) {
  const chats = await chatsRepo.listChatsForUser(userId);
  return chats.map((chat) => ({
    id: chat.id,
    name: chat.title,
    projectId: chat.project_id,
    starred: chat.starred,
    updatedAt: chat.updated_at,
  }));
}

export async function getChatWithMessages(chatId: string, userId: string) {
  const chat = await chatsRepo.getChatForUser(chatId, userId);
  if (!chat) throw notFound("Chat not found.");
  const messages = await messagesRepo.listMessagesForChat(chatId);
  return { chat, messages };
}

export async function createChatForUser(
  userId: string,
  input?: { title?: string; projectId?: string | null },
) {
  const profile = await query<{ default_workspace_id: string | null }>(
    `select default_workspace_id from public.profiles where id = $1`,
    [userId],
  );
  return chatsRepo.createChat({
    userId,
    title: input?.title,
    projectId: input?.projectId,
    workspaceId: profile[0]?.default_workspace_id ?? null,
  });
}

export async function appendUserMessage(
  chatId: string,
  userId: string,
  content: string,
) {
  const chat = await chatsRepo.getChatForUser(chatId, userId);
  if (!chat) throw notFound("Chat not found.");
  return messagesRepo.createMessage({
    chatId,
    userId,
    role: "user",
    content,
  });
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
  thinkingType?: ThinkingType;
  webSearchEnabled?: boolean;
  userCountryCode?: string;
  generateChatTitle?: boolean;
  chatModel?: string;
}) {
  const chat = await chatsRepo.getChatForUser(input.chatId, input.userId);
  if (!chat) throw notFound("Chat not found.");

  const clientConversation = sanitizeMessages(input.messages).filter(
    (message) => message.content.trim().length > 0,
  );
  if (!clientConversation.length) {
    throw new AppError("messages are required.", 400);
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

  const modelForTelemetry = resolveInferenceRoute({
    chatModel: parseChatModelId(input.chatModel),
    thinkingType: input.thinkingType,
    webSearchEnabled: input.webSearchEnabled,
  }).modelSlug;

  let assistant: Awaited<ReturnType<typeof messagesRepo.createMessage>> | null =
    null;
  const assistantPromise = messagesRepo
    .createMessage({
      chatId: input.chatId,
      role: "assistant",
      content: "",
      status: "streaming",
    })
    .then((row) => {
      assistant = row;
      return row;
    });

  const sourceStream = await createChatSourceStream(clientConversation, {
    chatModel: input.chatModel,
    thinkingType: input.thinkingType,
    userId: input.userId,
    conversationId: input.chatId,
    webSearchEnabled: input.webSearchEnabled === true,
    userCountryCode: input.userCountryCode,
    generateChatTitle,
    signal: input.signal,
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
      },
      input.signal,
    );

    const persistOnDone = async () => {
      const assistantRow = assistant ?? (await assistantPromise);
      if (assistantRow?.id) {
        const cleanedAnswer = finalizeChatTitleStrippedAnswer(answer);
        await messagesRepo.updateMessageContent(
          assistantRow.id,
          cleanedAnswer,
          "complete",
        );
        if (generatedTitle) {
          await chatsRepo.updateChat(input.chatId, input.userId, {
            title: generatedTitle,
          });
        }
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
    };

    return {
      stream: body,
      assistantMessageId: null as string | null,
      onComplete: persistOnDone,
    };
  } catch (error) {
    const assistantRow = assistant ?? (await assistantPromise.catch(() => null));
    if (assistantRow?.id) {
      await messagesRepo.updateMessageContent(
        assistantRow.id,
        answer || "Generation failed.",
        "failed",
      );
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
  return branchesRepo.upsertBranchState({
    chatId,
    userId,
    activePath,
    messages,
  });
}

export async function getBranchState(chatId: string, userId: string) {
  return branchesRepo.getBranchState(chatId, userId);
}

export function legacyStreamFromMessages(
  messages: IncomingMessage[],
  signal?: AbortSignal,
  options?: {
    thinkingType?: ThinkingType;
    webSearchEnabled?: boolean;
    userCountryCode?: string;
    generateChatTitle?: boolean;
    chatModel?: string;
  },
) {
  const generateChatTitle = resolveGenerateChatTitle(
    messages,
    options?.generateChatTitle,
  );

  return createChatSourceStream(messages, {
    chatModel: options?.chatModel,
    thinkingType: options?.thinkingType,
    webSearchEnabled: options?.webSearchEnabled === true,
    userCountryCode: options?.userCountryCode,
    generateChatTitle,
    signal,
  });
}

export { sanitizeMessages, encodeSseEvent };
