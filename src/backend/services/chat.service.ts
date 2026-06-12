import { AppError, notFound } from "@/backend/db/errors";
import * as chatsRepo from "@/backend/repositories/chats.repository";
import * as messagesRepo from "@/backend/repositories/messages.repository";
import * as branchesRepo from "@/backend/repositories/branches.repository";
import { streamChatAgent } from "@/backend/inference/chat-agent-stream";
import { shouldUseAgentPath } from "@/lib/chat-routing";
import {
  encodeSseEvent,
  generateAnthropicTitle,
  resolveThinkingType,
  sanitizeMessages,
  streamAnthropicChat,
  tapChatSseStream,
  transformAnthropicStream,
  type IncomingMessage,
  type ThinkingType,
} from "@/backend/inference/novita";
import { logInferenceTelemetry } from "@/backend/telemetry/inference-log";
import { env } from "@/backend/config/env";
import { query } from "@/backend/db/pool";
import * as billingService from "@/backend/services/billing.service";

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

function messagesFromDb(
  rows: Awaited<ReturnType<typeof messagesRepo.listMessagesForChat>>,
): IncomingMessage[] {
  return rows
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role as IncomingMessage["role"],
      content: m.content ?? "",
    }))
    .filter((m) => m.content.trim().length > 0);
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
}) {
  const chat = await chatsRepo.getChatForUser(input.chatId, input.userId);
  if (!chat) throw notFound("Chat not found.");

  await persistLatestUserMessage(input.chatId, input.userId, input.messages);
  const dbMessages = await messagesRepo.listMessagesForChat(input.chatId);
  const conversation = messagesFromDb(dbMessages);
  if (!conversation.length) {
    throw new AppError("messages are required.", 400);
  }

  const assistant = await messagesRepo.createMessage({
    chatId: input.chatId,
    role: "assistant",
    content: "",
    status: "streaming",
  });

  const started = Date.now();
  let answer = "";
  let thinking = "";

  const useAgentPath = shouldUseAgentPath({
    webSearchEnabled: input.webSearchEnabled,
    thinkingType: input.thinkingType,
  });

  try {
    const body = useAgentPath
      ? tapChatSseStream(
          streamChatAgent(conversation, input.signal, {
            thinkingType: input.thinkingType,
            userId: input.userId,
            conversationId: input.chatId,
            webSearchEnabled: input.webSearchEnabled === true,
          }),
          {
            onAnswerDelta: (delta) => {
              answer += delta;
            },
            onThinkingDelta: (delta) => {
              thinking += delta;
            },
          },
          input.signal,
        )
      : transformAnthropicStream(
          await streamAnthropicChat(conversation, input.signal, {
            thinkingType: input.thinkingType,
          }),
          (delta) => {
            answer += delta;
          },
          (delta) => {
            thinking += delta;
          },
          input.signal,
        );

    const persistOnDone = async () => {
      if (assistant?.id) {
        await messagesRepo.updateMessageContent(
          assistant.id,
          answer,
          "complete",
        );
        await chatsRepo.updateChat(input.chatId, input.userId, {
          title: chat.title,
        });
      }
      const latencyMs = Date.now() - started;
      await logInferenceTelemetry({
        userId: input.userId,
        mode: "chat",
        status: "success",
        model: env.defaultModel,
        messageCount: conversation.length,
        responseCharacterCount: answer.length,
        latencyMs,
      });
      try {
        await billingService.meterChatGeneration({
          userId: input.userId,
          chatId: input.chatId,
          messageId: assistant?.id ?? null,
          modelId: env.defaultModel,
          outputCharacters: answer.length,
          inputMessageCount: conversation.length,
          latencyMs,
        });
      } catch {
        // token metering is best-effort; stream already completed
      }
    };

    return {
      stream: body,
      assistantMessageId: assistant?.id,
      onComplete: persistOnDone,
    };
  } catch (error) {
    if (assistant?.id) {
      await messagesRepo.updateMessageContent(
        assistant.id,
        answer || "Generation failed.",
        "failed",
      );
    }
    await logInferenceTelemetry({
      userId: input.userId,
      mode: "chat",
      status: "error",
      model: env.defaultModel,
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
  const title = await generateAnthropicTitle(messages);
  await chatsRepo.updateChat(chatId, userId, { title });
  return title;
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
  options?: { thinkingType?: ThinkingType; webSearchEnabled?: boolean },
) {
  const useAgentPath = shouldUseAgentPath({
    webSearchEnabled: options?.webSearchEnabled,
    thinkingType: options?.thinkingType,
  });

  if (useAgentPath) {
    return Promise.resolve(
      streamChatAgent(messages, signal, {
        thinkingType: options?.thinkingType,
        webSearchEnabled: options?.webSearchEnabled === true,
      }),
    );
  }

  return streamAnthropicChat(messages, signal, {
    thinkingType: options?.thinkingType,
  }).then((stream) =>
    transformAnthropicStream(stream, () => {}, () => {}, signal),
  );
}

export { sanitizeMessages, encodeSseEvent };
