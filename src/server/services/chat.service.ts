import { AppError, notFound } from "@/server/db/errors";
import * as chatsRepo from "@/server/repositories/chats.repository";
import * as pinnedChatsRepo from "@/server/repositories/pinned-chats.repository";
import * as messagesRepo from "@/server/repositories/messages.repository";
import type { MessageTranscriptLine } from "@/server/repositories/messages.repository";
import * as branchesRepo from "@/server/repositories/branches.repository";
import * as transcriptRepo from "@/server/repositories/transcript.repository";
import {
  createChatStream,
  loadChatStreamPersonalization,
  withBudget,
  EMPTY_CHAT_PERSONALIZATION,
  CHAT_CONTEXT_BUDGET_MS,
} from "@/app/api/chat/stream";
import type { AgentStreamOptions } from "@/server/agent-core";
import type { HomerReasoningEffort } from "@/lib/model-effort";
import {
  encodeSseEvent,
  sanitizeMessages,
  tapChatSseStream,
  type IncomingMessage,
} from "@/server/inference/novita";
import { generateChatTitle as generateOpenAIChatTitle } from "@/server/agent-core";
import { resolveInferenceRoute } from "@/lib/inference-routing";
import { parseChatModelId } from "@/lib/model-catalog";
import { logInferenceTelemetry } from "@/server/telemetry/inference-log";
import { query } from "@/server/db/pool";
import * as billingService from "@/server/services/billing.service";
import { listRecentMessagesPreferCloudflare } from "@/server/chat/recent-messages";
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
  recordsToJsonl,
  type CapturedToolCall,
  type TranscriptAgentSegment,
  type TranscriptAgentModelTurn,
  type TranscriptMessageRecord,
  type TranscriptRecord,
  type TranscriptSource,
} from "@/server/training/transcript-format";
import {
  buildPromptMessagesFromDbRows,
  mergePromptHistories,
} from "@/server/inference/build-chat-prompt-messages";
import {
  applyVisionToLastUserMessage,
  resolveVisionImageBlocks,
  type ClientVisionImage,
} from "@/server/inference/vision-attachments";
import {
  toUserFacingChatError,
  EMPTY_ASSISTANT_RESPONSE_FALLBACK,
} from "@/lib/assistant-generation-error";
import { durableFileContentUrl } from "@/lib/composer-attachments";

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

function transcriptSourcesFrom(value: unknown): TranscriptSource[] {
  const rows = Array.isArray(value)
    ? value
    : value &&
        typeof value === "object" &&
        Array.isArray((value as { results?: unknown }).results)
      ? (value as { results: unknown[] }).results
      : [];
  return rows.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const candidate = row as Record<string, unknown>;
    if (typeof candidate.url !== "string" || !candidate.url) return [];
    return [
      {
        title:
          typeof candidate.title === "string" && candidate.title
            ? candidate.title
            : candidate.url,
        url: candidate.url,
        snippet: typeof candidate.snippet === "string" ? candidate.snippet : "",
        ...(typeof candidate.publishedDate === "string"
          ? { publishedDate: candidate.publishedDate }
          : {}),
        ...(typeof candidate.favicon === "string"
          ? { favicon: candidate.favicon }
          : {}),
        ...(Array.isArray(candidate.highlights)
          ? {
              highlights: candidate.highlights.filter(
                (item): item is string => typeof item === "string",
              ),
            }
          : {}),
      },
    ];
  });
}

function dedupeTranscriptSources(
  segments: TranscriptAgentSegment[],
): TranscriptSource[] {
  const byUrl = new Map<string, TranscriptSource>();
  for (const segment of segments) {
    if (segment.type !== "tool") continue;
    for (const source of segment.sources ?? []) byUrl.set(source.url, source);
  }
  return [...byUrl.values()];
}

export async function listRecentChats(userId: string) {
  const [chats, pinned] = await Promise.all([
    chatsRepo.listChatsForUser(userId),
    pinnedChatsRepo.listPinnedChats(userId),
  ]);
  const pinnedIds = new Set(pinned.map((p) => p.chat_id));

  return chats.map((chat) => ({
    id: chat.id,
    name: chat.title,
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
  input?: { id?: string; title?: string },
) {
  // Single round-trip: allocate id + insert with workspace from profiles subquery.
  const chat = await chatsRepo.createChatFast({
    userId,
    id: input?.id,
    title: input?.title,
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
  kind: "image" | "document" | "video";
  fileId: string;
  previewUrl?: string;
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
        : mime.startsWith("video/")
          ? ("video" as const)
          : ("document" as const),
      fileId: file.id,
      previewUrl: durableFileContentUrl(file.id),
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

/**
 * Persist a follow-up before returning a generation-lease conflict.
 * The browser can safely wait/retry with the same client ids, and a reload
 * still shows the user's message instead of losing the optimistic bubble.
 */
export async function reserveQueuedChatTurn(input: {
  chatId: string;
  userId: string;
  turn: {
    content: string;
    modelContent?: string;
    fileIds?: string[];
    userClientId: string;
    assistantClientId: string;
  };
}) {
  const attachments = input.turn.fileIds?.length
    ? await resolveUserAttachmentMeta(input.userId, input.turn.fileIds)
    : [];
  return messagesRepo.beginChatTurn({
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
    assistantStatus: "queued",
  });
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
  /** Vision for edits / retries that do not open a new durable turn. */
  vision?: {
    fileIds?: string[];
    images?: ClientVisionImage[];
  };
  signal?: AbortSignal;
  /**
   * Await the chat-coord DO lease (started in parallel with SSE). Must resolve
   * before durable turn insert / model so cross-isolate single-writer holds.
   */
  ensureLease?: () => Promise<"acquired" | "conflict" | "skipped">;
  userCountryCode?: string;
  /** IANA timezone from the browser (for prompt temporal context). */
  clientTimezone?: string;
  generateChatTitle?: boolean;
  chatModel?: string;
  homerReasoningEffort?: HomerReasoningEffort;
  extendedThinking?: boolean;
  onPauseForUser?: () => void | Promise<void>;
  /** Correlates browser, Vercel, Worker, and provider-side diagnostics. */
  requestId?: string;
}) {
  // Kick ownership + personalization + history immediately so Worker/DB RTTs
  // overlap SSE flush and the DO lease — never block Response headers on them.
  // History prefers Cloudflare cache (not direct Supabase) on every continue.
  const chatPromise = chatsRepo.getChatForUser(input.chatId, input.userId);
  const personalizationPromise = loadChatStreamPersonalization(input.userId);
  const historyPromise = listRecentMessagesPreferCloudflare({
    chatId: input.chatId,
    userId: input.userId,
    limit: 40,
  });

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

  const turnState: {
    userMessageId: string | null;
    assistant: { id: string; status?: string; inserted?: boolean } | null;
  } = {
    userMessageId: null,
    assistant: null,
  };
  let turnFailure: unknown = null;

  // Single shared gate so resolveContext + turn insert both wait on the same
  // DO lease promise and only reserve the queued turn once on conflict.
  const leaseGate = (
    input.ensureLease
      ? input.ensureLease()
      : Promise.resolve("skipped" as const)
  ).then(async (lease) => {
    if (lease !== "conflict") return lease;
    if (input.turn) {
      await reserveQueuedChatTurn({
        chatId: input.chatId,
        userId: input.userId,
        turn: input.turn,
      }).catch(() => undefined);
    }
    throw new AppError(
      "The previous reply is still finishing. Your message is saved and queued.",
      409,
      "generation_in_progress",
    );
  });

  // Durable turn insert runs after lease + overlaps SSE — do NOT await it
  // before returning the stream. Client already has optimistic clientId rows.
  const turnPromise = (async () => {
    await leaseGate;

    const chat = await chatPromise;
    if (!chat) throw notFound("Chat not found.");

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
        assistantStatus: "streaming",
      });
      turnState.assistant = turn.assistant;
      turnState.userMessageId = turn.user.id;

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
      return turn;
    }

    const created = await messagesRepo.createMessage({
      chatId: input.chatId,
      userId: input.userId,
      role: "assistant",
      content: "",
      status: "streaming",
      contentJson: buildAssistantTranscriptRecord({ answer: "" }),
    });
    turnState.assistant = created;
    return { user: null, assistant: created };
  })().catch((error) => {
    turnFailure = error;
    throw error;
  });

  const modelTurns: TranscriptAgentModelTurn[] = [];
  const started = Date.now();
  let answer = "";
  let thinking = "";
  let streamError: string | null = null;
  let thinkingStartedAtMs: number | null = null;
  let thinkingAccumulatedMs = 0;
  const toolsById = new Map<string, CapturedToolCall>();
  const streamedSegments: TranscriptAgentSegment[] = [];
  const streamedSegmentsById = new Map<string, TranscriptAgentSegment>();

  const addStreamedSegment = (segment: TranscriptAgentSegment) => {
    const existing = streamedSegmentsById.get(segment.id);
    if (existing) return existing;
    streamedSegments.push(segment);
    streamedSegmentsById.set(segment.id, segment);
    return segment;
  };

  const ensureThinkingSegment = (segmentId?: string) => {
    const id =
      segmentId ??
      [...streamedSegments]
        .reverse()
        .find(
          (segment) => segment.type === "thinking" && !segment.completedAtMs,
        )?.id ??
      `thinking-${streamedSegments.length + 1}`;
    const existing = streamedSegmentsById.get(id);
    if (existing?.type === "thinking") return existing;
    return addStreamedSegment({
      type: "thinking",
      id,
      content: "",
      startedAtMs: Date.now(),
    }) as Extract<TranscriptAgentSegment, { type: "thinking" }>;
  };

  const ensureNarrationSegment = (segmentId: string) => {
    const existing = streamedSegmentsById.get(segmentId);
    if (existing?.type === "narration") return existing;
    return addStreamedSegment({
      type: "narration",
      id: segmentId,
      content: "",
      startedAtMs: Date.now(),
    }) as Extract<TranscriptAgentSegment, { type: "narration" }>;
  };

  const ensureToolSegment = (tool: {
    toolCallId: string;
    name: string;
    args?: Record<string, unknown>;
    description?: string;
  }) => {
    const id = `tool-${tool.toolCallId}`;
    const existing = streamedSegmentsById.get(id);
    if (existing?.type === "tool") {
      existing.input = { ...existing.input, ...(tool.args ?? {}) };
      existing.name = tool.name || existing.name;
      existing.description = tool.description ?? existing.description;
      return existing;
    }
    return addStreamedSegment({
      type: "tool",
      id,
      toolCallId: tool.toolCallId,
      name: tool.name,
      status: "running",
      input: tool.args ?? {},
      description: tool.description,
      startedAtMs: Date.now(),
    }) as Extract<TranscriptAgentSegment, { type: "tool" }>;
  };

  // Prompt context runs INSIDE the SSE body after `start`. History /
  // personalization are soft-budgeted so a slow Supabase RTT cannot hold the
  // model (client transcript is enough to begin). Lease + ownership are hard
  // gates before turn insert / inference.
  const sourceStream = await createChatStream(
    clientConversation.map((m) => ({ role: m.role, content: m.content })),
    {
      chatModel: input.chatModel,
      userId: input.userId,
      conversationId: input.chatId,
      userCountryCode: input.userCountryCode,
      clientTimezone: input.clientTimezone,
      // Title heuristic without awaiting ownership — refined if chat loads.
      generateChatTitle: resolveGenerateChatTitle(
        clientConversation,
        input.generateChatTitle ??
          clientConversation.filter((message) => message.role === "user")
            .length === 1,
      ),
      signal: input.signal,
      homerReasoningEffort: input.homerReasoningEffort,
      extendedThinking: input.extendedThinking,
      onPauseForUser: input.onPauseForUser,
      onModelTurn: (turn) => {
        modelTurns.push(turn);
      },
      resolveContext: async () => {
        // Lease + ownership must win before the model; soft-budget only
        // enrichment queries (history / personalization).
        await leaseGate;
        const chat = await chatPromise;
        if (!chat) throw notFound("Chat not found.");

        await Promise.race([
          turnPromise.catch(() => undefined),
          new Promise<void>((resolve) => {
            setTimeout(resolve, CHAT_CONTEXT_BUDGET_MS);
          }),
        ]);
        if (turnFailure) throw turnFailure;

        const [dbRecent, personalization] = await Promise.all([
          // Worker cache is usually <50ms; allow a bit more than personalization
          // so continued chats keep prior turns without timing out to [].
          withBudget(historyPromise, [], Math.max(CHAT_CONTEXT_BUDGET_MS, 450)),
          withBudget(
            personalizationPromise,
            EMPTY_CHAT_PERSONALIZATION,
            CHAT_CONTEXT_BUDGET_MS,
          ),
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

        const visionImages = input.vision?.images ?? input.turn?.images;
        const visionFileIds =
          input.vision?.fileIds ??
          (visionImages?.length ? [] : input.turn?.fileIds);
        const hasVisionInputs =
          Boolean(visionImages?.length) || Boolean(visionFileIds?.length);
        const visionBlocks = hasVisionInputs
          ? await resolveVisionImageBlocks({
              userId: input.userId,
              fileIds: visionFileIds,
              clientImages: visionImages,
            })
          : [];

        if (visionBlocks.length > 0) {
          conversationForAgent = applyVisionToLastUserMessage(
            conversationForAgent,
            visionBlocks,
          );
        }

        return {
          modelMessages: conversationForAgent,
          personalization,
          userMessageId: turnState.userMessageId ?? undefined,
          assistantMessageId: turnState.assistant?.id ?? undefined,
        };
      },
    },
  );

  const titleUserContent = input.turn?.content ?? requestedUserContent;
  let generatedTitle: string | null = null;
  const conversationForModel: IncomingMessage[] = clientConversation;

  /**
   * Checkpoint the growing answer into the durable assistant row while the
   * stream is still open. If the isolate dies / proxy cuts / tab closes, a
   * reload shows the text painted so far instead of an empty ghost row.
   * Throttled so Supabase sees at most one write per interval per turn.
   */
  const PARTIAL_SAVE_INTERVAL_MS = 4_000;
  let lastPartialSaveAtMs = 0;
  let partialSaveInFlight: Promise<unknown> = Promise.resolve();
  const maybeSavePartialTurn = () => {
    if (input.signal?.aborted) return;
    const now = Date.now();
    if (now - lastPartialSaveAtMs < PARTIAL_SAVE_INTERVAL_MS) {
      return;
    }
    const snapshotAnswer = finalizeChatTitleStrippedAnswer(answer);
    if (
      !snapshotAnswer.trim() &&
      !thinking.trim() &&
      streamedSegments.length === 0
    ) {
      return;
    }
    lastPartialSaveAtMs = now;
    const snapshotSegments = JSON.parse(
      JSON.stringify(streamedSegments),
    ) as TranscriptAgentSegment[];
    const snapshotTools = Array.from(toolsById.values()).map((tool) => ({
      ...tool,
      input: { ...tool.input },
    }));
    const snapshotContentJson = buildAssistantTranscriptRecord({
      answer: snapshotAnswer,
      thinking,
      tools: snapshotTools,
      agentUi: {
        model: modelForTelemetry,
        status: "streaming",
        startedAtMs: started,
        thinkingDurationSeconds:
          thinkingAccumulatedMs > 0
            ? Math.max(1, Math.round(thinkingAccumulatedMs / 1000))
            : undefined,
        modelTurns: [...modelTurns],
        segments: snapshotSegments,
        sources: dedupeTranscriptSources(snapshotSegments),
        actions: snapshotTools,
      },
    });
    partialSaveInFlight = partialSaveInFlight
      .catch(() => undefined)
      .then(async () => {
        // The turn insert may still be in flight; wait for it once.
        try {
          await turnPromise;
        } catch {
          return;
        }
        if (!turnState.assistant?.id) return;
        await messagesRepo.updateMessageContent(
          turnState.assistant.id,
          input.chatId,
          snapshotAnswer,
          "streaming",
          snapshotContentJson,
        );
      })
      .catch(() => undefined);
  };

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
          maybeSavePartialTurn();
        },
        onAnswerFinalize: (text, segmentId) => {
          // The loop promotes the final-round text wholesale — replace, never
          // append (narration prose from earlier rounds is not the answer).
          answer = text;
          if (segmentId) {
            const narration = ensureNarrationSegment(segmentId);
            narration.content = text;
            narration.isFinal = true;
            narration.completedAtMs ??= Date.now();
          }
          // Persist the promoted answer immediately so a disconnect between
          // here and onComplete cannot wipe the visible reply.
          lastPartialSaveAtMs = 0;
          maybeSavePartialTurn();
        },
        onAnswerClear: () => {
          answer = "";
        },
        onThinkingStart: () => {
          beginThinkingPhase();
        },
        onThinkingDelta: (delta, segmentId) => {
          beginThinkingPhase();
          thinking += delta;
          ensureThinkingSegment(segmentId).content += delta;
          maybeSavePartialTurn();
        },
        onThinkingEnd: (segmentId) => {
          endThinkingPhase();
          const segment = ensureThinkingSegment(segmentId);
          segment.completedAtMs ??= Date.now();
          segment.durationSeconds = segment.startedAtMs
            ? Math.max(
                1,
                Math.round(
                  (segment.completedAtMs - segment.startedAtMs) / 1000,
                ),
              )
            : undefined;
        },
        onSegmentStart: ({ segmentId, kind }) => {
          if (kind === "thinking") ensureThinkingSegment(segmentId);
          if (kind === "narration") ensureNarrationSegment(segmentId);
        },
        onSegmentEnd: ({ segmentId, kind }) => {
          const segment = streamedSegmentsById.get(segmentId);
          if (!segment || segment.type !== kind) return;
          segment.completedAtMs ??= Date.now();
        },
        onNarrationDelta: (delta, segmentId) => {
          ensureNarrationSegment(segmentId).content += delta;
          maybeSavePartialTurn();
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
          ensureToolSegment(tool);
          const existing = toolsById.get(tool.toolCallId);
          toolsById.set(tool.toolCallId, {
            id: tool.toolCallId,
            name: tool.name,
            input: { ...existing?.input, ...(tool.args ?? {}) },
            description: tool.description ?? existing?.description,
            startedAtMs: existing?.startedAtMs ?? Date.now(),
          });
          maybeSavePartialTurn();
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
          const segment = ensureToolSegment({
            toolCallId: tool.toolCallId,
            name: tool.name || existing?.name || "tool",
            args: existing?.input,
            description: existing?.description,
          });
          segment.result = tool.result;
          segment.status = tool.isError === true ? "error" : "done";
          segment.completedAtMs = Date.now();
          if (segment.name === "web_search") {
            try {
              segment.sources = transcriptSourcesFrom(JSON.parse(tool.result));
            } catch {
              segment.sources = transcriptSourcesFrom(tool.result);
            }
          }
          maybeSavePartialTurn();
        },
        onToolData: ({ toolCallId, data }) => {
          const segment = streamedSegmentsById.get(`tool-${toolCallId}`);
          if (!segment || segment.type !== "tool") return;
          if (typeof data.query === "string") segment.searchQuery = data.query;
          const sources = transcriptSourcesFrom(data.results);
          if (sources.length > 0) segment.sources = sources;
          maybeSavePartialTurn();
        },
      },
      input.signal,
    );

    const persistOnDone = async () => {
      // Let any in-flight partial checkpoint finish BEFORE the authoritative
      // finalize write — otherwise a late streaming write could overwrite the
      // completed answer with a shorter snapshot.
      try {
        await partialSaveInFlight;
      } catch {
        // ignore
      }
      // Ensure the durable turn row exists before finalize (insert may still
      // be in flight when the model finishes unusually fast).
      try {
        await turnPromise;
      } catch {
        // turnFailure already recorded; finalize may no-op without assistant id
      }
      const assistantRow = turnState.assistant;
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
      const wasCancelled = input.signal?.aborted === true;
      const cleanedAnswer = wasCancelled
        ? generatedAnswer
        : streamError
          ? toUserFacingChatError(streamError)
          : generatedAnswer.trim()
            ? generatedAnswer
            : pausedForUserInput
              ? ""
              : EMPTY_ASSISTANT_RESPONSE_FALLBACK;
      const completedAtMs = Date.now();
      const failed =
        Boolean(streamError) ||
        (!generatedAnswer.trim() && !pausedForUserInput);
      const completionStatus = wasCancelled
        ? "cancelled"
        : failed
          ? "failed"
          : "complete";
      for (const segment of streamedSegments) {
        segment.completedAtMs ??= completedAtMs;
        if (segment.type === "tool" && segment.status === "running") {
          segment.status = wasCancelled ? "cancelled" : "error";
        }
      }
      const persistedSources = dedupeTranscriptSources(streamedSegments);
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
          model: modelForTelemetry,
          status: completionStatus,
          startedAtMs: started,
          completedAtMs,
          thinkingDurationSeconds,
          modelTurns,
          segments: streamedSegments,
          sources: persistedSources,
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
        requestId: input.requestId,
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

    // Prefer durable ids when the turn already landed; otherwise fall back to
    // client ids so the Response can flush without waiting on Supabase.
    await Promise.race([
      turnPromise.catch(() => undefined),
      new Promise<void>((resolve) => {
        setTimeout(resolve, 40);
      }),
    ]);

    return {
      stream: body,
      userMessageId:
        turnState.userMessageId ?? input.turn?.userClientId ?? null,
      assistantMessageId:
        turnState.assistant?.id ?? input.turn?.assistantClientId ?? null,
      onComplete: persistOnDone,
    };
  } catch (error) {
    const assistantRow = turnState.assistant;
    const tools = Array.from(toolsById.values());
    if (assistantRow?.id) {
      const failedAtMs = Date.now();
      for (const segment of streamedSegments) {
        segment.completedAtMs ??= failedAtMs;
        if (segment.type === "tool" && segment.status === "running") {
          segment.status = input.signal?.aborted ? "cancelled" : "error";
        }
      }
      const failedContent = toUserFacingChatError(
        answer || (error instanceof Error ? error.message : String(error)),
      );
      const contentJson = buildAssistantTranscriptRecord({
        answer: failedContent,
        thinking,
        tools,
        agentUi: {
          model: modelForTelemetry,
          status: input.signal?.aborted ? "cancelled" : "failed",
          startedAtMs: started,
          completedAtMs: failedAtMs,
          modelTurns,
          segments: streamedSegments,
          sources: dedupeTranscriptSources(streamedSegments),
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
      requestId: input.requestId,
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
    title = await generateOpenAIChatTitle(messages);
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
  const rebuilt: TranscriptRecord[] = [];
  for (const row of messages) {
    const candidate = row.content_json as Partial<TranscriptMessageRecord>;
    const durableRecord =
      candidate &&
      typeof candidate === "object" &&
      typeof candidate.role === "string" &&
      candidate.message &&
      Array.isArray(candidate.message.content)
        ? (candidate as TranscriptMessageRecord)
        : row.role === "user"
          ? buildUserTranscriptRecord(row.content ?? "")
          : buildAssistantTranscriptRecord({ answer: row.content ?? "" });
    rebuilt.push(durableRecord);

    if (durableRecord.role !== "assistant") continue;
    const segments = durableRecord.agent_ui?.segments ?? [];
    const segmentTools: CapturedToolCall[] = segments.flatMap((segment) =>
      segment.type === "tool"
        ? [
            {
              id: segment.toolCallId,
              name: segment.name,
              input: segment.input,
              result: segment.result,
              isError: segment.status === "error",
            },
          ]
        : [],
    );
    const actionTools = (durableRecord.agent_ui?.actions ?? []).map(
      (action) => ({
        id: action.id,
        name: action.name,
        input: action.input,
        result: action.result,
        isError: action.isError,
      }),
    );
    const toolResults = buildToolResultUserRecord(
      segmentTools.length > 0 ? segmentTools : actionTools,
    );
    if (toolResults) rebuilt.push(toolResults);
    rebuilt.push(
      buildTurnEndedRecord(
        row.status === "cancelled"
          ? "cancelled"
          : row.status === "failed"
            ? "error"
            : "success",
      ),
    );
  }
  return {
    chat_id: chatId,
    user_id: userId,
    chat_title: chat.title,
    line_count: rebuilt.length,
    training_eligible: true,
    jsonl: recordsToJsonl(rebuilt),
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
