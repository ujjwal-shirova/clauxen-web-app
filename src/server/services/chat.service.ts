import { AppError, notFound } from "@/server/db/errors";
import * as chatsRepo from "@/server/repositories/chats.repository";
import * as pinnedChatsRepo from "@/server/repositories/pinned-chats.repository";
import * as messagesRepo from "@/server/repositories/messages.repository";
import type {
  MessageTranscriptLine,
  TurnFork,
} from "@/server/repositories/messages.repository";
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
import { publishLiveTurn } from "@/server/chat/chat-coord-client";
import {
  finishGenerationJob,
  markJobContinuing,
  saveGenerationCheckpoint,
  type GenerationCheckpoint,
} from "@/server/repositories/generation-jobs.repository";
import type { AgentLoopOutcome } from "@/server/agent-core";
import type { OpenAIInputItem } from "@/server/inference/openai-responses-client";
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

/** The promoted answer is stored on the message. Drop a narration copy of it. */
function segmentsWithoutAnswerCopy(
  segments: TranscriptAgentSegment[],
  answer: string,
): TranscriptAgentSegment[] {
  const text = answer.trim();
  if (!text) return segments;
  return segments.filter(
    (segment) =>
      segment.type !== "narration" || segment.content.trim() !== text,
  );
}

async function mapChatsWithPins(
  userId: string,
  chats: Awaited<ReturnType<typeof chatsRepo.listChatsForUser>>,
) {
  const pinned = await pinnedChatsRepo.listPinnedChats(userId);
  const pinnedIds = new Set(pinned.map((p) => p.chat_id));
  return chats.map((chat) => ({
    id: chat.id,
    name: chat.title,
    starred: chat.starred,
    pinned: pinnedIds.has(chat.id),
    generating: Boolean(chat.generating),
    updatedAt: chat.updated_at,
  }));
}

export async function listRecentChats(userId: string) {
  const chats = await chatsRepo.listChatsForUser(userId);
  return mapChatsWithPins(userId, chats);
}

export async function listGeneratingChatIds(userId: string) {
  return chatsRepo.listGeneratingChatIds(userId);
}

export async function searchChats(userId: string, query: string, limit = 40) {
  const chats = await chatsRepo.searchChatsForUser(userId, query, { limit });
  return mapChatsWithPins(userId, chats);
}

export async function getChatWithMessages(chatId: string, userId: string) {
  const chat = await chatsRepo.getChatForUser(chatId, userId);
  if (!chat) throw notFound("Chat not found.");
  // Full ACTIVE branch path (tree walk) — legacy callers (share/export seed)
  // must never see inactive sibling rows.
  const first = await messagesRepo.listThreadPage({
    chatId,
    userId,
    limit: 500,
  });
  let messages = first.messages;
  let cursor = first.nextCursor;
  for (let i = 0; i < 10 && first.hasMore && cursor; i += 1) {
    const older = await messagesRepo.listThreadPage({
      chatId,
      userId,
      depthCursor: cursor.depth,
      limit: 500,
    });
    const existing = new Set(messages.map((m) => m.id));
    messages = [
      ...older.messages.filter((m) => !existing.has(m.id)),
      ...messages,
    ];
    if (!older.hasMore || !older.nextCursor) break;
    cursor = older.nextCursor;
  }
  return { chat, messages };
}

/**
 * Keyset page of the ACTIVE branch path for conversation UI.
 * Cursor is a tree depth (distance below the leaf) instead of created_at —
 * inactive sibling rows never leak into the visible thread.
 */
export async function getChatMessagesPage(
  chatId: string,
  userId: string,
  input?: {
    cursorDepth?: number | null;
    limit?: number;
    accessToken?: string | null;
  },
) {
  // The thread RPC enforces ownership itself, so both reads run in parallel.
  // No writes on the read path: stale-turn settlement is owned by the
  // generation watchdog, not by whoever happens to open the chat.
  const [chat, page] = await Promise.all([
    chatsRepo.getChatForUser(chatId, userId),
    listChatThreadPage(chatId, userId, input),
  ]);
  if (!chat) throw notFound("Chat not found.");
  return { chat, ...page };
}

/** Active-branch keyset page only (ownership enforced in SQL). */
export async function listChatThreadPage(
  chatId: string,
  userId: string,
  input?: { cursorDepth?: number | null; limit?: number },
) {
  return messagesRepo.listThreadPage({
    chatId,
    userId,
    depthCursor: input?.cursorDepth,
    limit: input?.limit,
  });
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
  input?: { id?: string; title?: string; projectId?: string | null },
) {
  let projectId = input?.projectId ?? null;
  if (projectId) {
    const { getProject } = await import("@/server/repositories/projects.repository");
    const project = await getProject(projectId, userId);
    if (!project) projectId = null;
  }
  const chat = await chatsRepo.createChatFast({
    userId,
    id: input?.id,
    title: input?.title,
    projectId,
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
  fork?: TurnFork | null;
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
    parentMessageId: (
      await messagesRepo.resolveForkTarget({
        chatId: input.chatId,
        userId: input.userId,
        fork: input.fork,
      })
    )?.parentMessageId ?? null,
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

/** Terminal result of one durable slice, read by the route/runner. */
export type ChatSliceOutcome =
  | { status: "complete" | "failed" | "cancelled" | "paused" }
  | { status: "yielded" };

/**
 * Durable-slice controls. When present, this turn runs as one time-boxed
 * slice of a background job: it resumes from `resume`, checkpoints every
 * completed round, and yields (instead of dying) when the slice budget ends.
 * When absent, the turn runs exactly once, start to finish, as before.
 */
export type ChatSliceControl = {
  jobId: string;
  /** Resume state from the job checkpoint (null on the first slice). */
  resume?: GenerationCheckpoint | null;
  /** Slice budget guard, checked by the agent loop at round boundaries. */
  shouldYield?: () => boolean;
  /** Aborted by the runner at the hard slice deadline (model stream only). */
  yieldSignal?: AbortSignal;
  /** Polled for explicit user stops while a background slice runs headless. */
  isCancelled?: () => Promise<boolean>;
  /** Fired once the durable turn rows exist (first slice only). */
  onTurnInserted?: (ids: {
    userMessageId: string | null;
    assistantMessageId: string | null;
  }) => void;
};

export async function streamChatGeneration(input: {
  chatId: string;
  userId: string;
  messages: IncomingMessage[];
  /** Tree fork intent — edit-resend or assistant regenerate. */
  fork?: TurnFork | null;
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
  /**
   * When the route received the request. The persisted "Worked for Ns" clock
   * starts here so it matches the live timer the user watched from send,
   * instead of excluding rate-limit, lease, and turn-insert time.
   */
  requestStartedAtMs?: number;
  /** Durable background-task controls. Omit for single-shot turns. */
  slice?: ChatSliceControl;
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

  const resume = input.slice?.resume ?? null;
  const resuming = Boolean(resume?.assistantMessageId);

  // Durable turn insert runs after lease + overlaps SSE — do NOT await it
  // before returning the stream. Client already has optimistic clientId rows.
  // Resume slices reuse the turn rows the first slice inserted.
  const turnPromise = (async () => {
    if (resuming) {
      await leaseGate;
      const chat = await chatPromise;
      if (!chat) throw notFound("Chat not found.");
      turnState.assistant = {
        id: resume!.assistantMessageId!,
        status: "streaming",
        inserted: false,
      };
      turnState.userMessageId = resume!.userMessageId ?? null;
      return {
        user: turnState.userMessageId
          ? { id: turnState.userMessageId }
          : null,
        assistant: turnState.assistant,
      };
    }

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
        // Edit-resend forks chain the new prompt as a sibling of the edited
        // one; normal sends and regenerates resolve server-side (active leaf).
        parentMessageId: (
          await messagesRepo.resolveForkTarget({
            chatId: input.chatId,
            userId: input.userId,
            fork: input.fork,
          })
        )?.parentMessageId ?? null,
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
      // Regenerate forks sibling under the retried reply's prompt; no-fork
      // assistant-only turns chain off the active leaf.
      ...(await (async () => {
        const target = await messagesRepo.resolveForkTarget({
          chatId: input.chatId,
          userId: input.userId,
          fork: input.fork,
        });
        return {
          parentMessageId: target?.parentMessageId ?? null,
          // Keep the original turn identity so a reload re-pairs the
          // regenerated reply with its prompt (client ids differ by design).
          metadata: target?.turnId ? { turnId: target.turnId } : undefined,
        };
      })()),
    });
    turnState.assistant = created;
    return { user: null, assistant: created };
  })()
    .then((turn) => {
      // Durable jobs record the turn rows so resume slices skip the insert.
      if (!resuming) {
        try {
          input.slice?.onTurnInserted?.({
            userMessageId: turnState.userMessageId,
            assistantMessageId: turnState.assistant?.id ?? null,
          });
        } catch {
          // observability only — the job row is updated again on checkpoint
        }
      }
      return turn;
    })
    .catch((error) => {
      turnFailure = error;
      throw error;
    });

  // Resume slices restore the full accumulation state; the agent loop then
  // continues at the checkpointed step as if the slice never ended.
  const modelTurns: TranscriptAgentModelTurn[] = [
    ...(resume?.modelTurns ?? []),
  ];
  const started = Date.now();
  const turnStartedAtMs =
    (typeof resume?.turnStartedAtMs === "number" &&
    resume.turnStartedAtMs > 0
      ? resume.turnStartedAtMs
      : undefined) ??
    (typeof input.requestStartedAtMs === "number" &&
    input.requestStartedAtMs > 0 &&
    input.requestStartedAtMs <= started
      ? input.requestStartedAtMs
      : started);
  let answer = resume?.answer ?? "";
  let thinking = resume?.thinking ?? "";
  let streamError: string | null = null;
  let thinkingStartedAtMs: number | null = null;
  let thinkingAccumulatedMs = resume?.thinkingAccumulatedMs ?? 0;
  const toolsById = new Map<string, CapturedToolCall>(
    (resume?.tools ?? []).map((tool) => [tool.id, { ...tool }]),
  );
  const streamedSegments: TranscriptAgentSegment[] = JSON.parse(
    JSON.stringify(resume?.segments ?? []),
  ) as TranscriptAgentSegment[];
  const streamedSegmentsById = new Map<string, TranscriptAgentSegment>(
    streamedSegments.map((segment) => [segment.id, segment]),
  );
  let generatedTitleFromResume: string | null = resume?.generatedTitle ?? null;

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

  const modelForTelemetry = resolveInferenceRoute({
    chatModel: parseChatModelId(input.chatModel),
  }).modelSlug;

  // ── Durable slice state ──────────────────────────────────────────────
  // `latestRound` always holds the newest fully-checkpointed agent state.
  // Yields and crash recoveries resume from here — never from a partial
  // round — so a re-run model round can only duplicate transient live text,
  // never durable tools or transcript rows.
  const loopResult: { outcome: AgentLoopOutcome } = { outcome: "done" };
  const latestRound: {
    step: number;
    conversation: OpenAIInputItem[] | null;
    narrationCounter: number;
  } = {
    step: resume?.step ?? 0,
    conversation: resume?.conversation
      ? (JSON.parse(JSON.stringify(resume.conversation)) as OpenAIInputItem[])
      : null,
    narrationCounter: resume?.narrationCounter ?? 0,
  };

  const buildSliceCheckpoint = (): GenerationCheckpoint => ({
    version: 1,
    step: latestRound.step,
    conversation: latestRound.conversation ?? resume?.conversation,
    narrationCounter: latestRound.narrationCounter,
    answer: finalizeChatTitleStrippedAnswer(answer),
    thinking,
    thinkingAccumulatedMs,
    segments: JSON.parse(JSON.stringify(streamedSegments)),
    tools: Array.from(toolsById.values()).map((tool) => ({ ...tool })),
    modelTurns: [...modelTurns],
    generatedTitle,
    turnStartedAtMs,
    userMessageId: turnState.userMessageId,
    assistantMessageId: turnState.assistant?.id ?? null,
  });

  let roundCheckpointChain: Promise<unknown> = Promise.resolve();
  const persistRoundCheckpoint = (toolCallIds: string[]): void => {
    if (!input.slice?.jobId) return;
    roundCheckpointChain = roundCheckpointChain
      .catch(() => undefined)
      .then(async () => {
        // The tap applies tool_end SSE slightly after the loop reports the
        // round. Wait for the tap to catch up so the checkpoint never drops
        // a completed tool (a missing tool would re-execute on resume).
        if (toolCallIds.length > 0) {
          const deadline = Date.now() + 2_000;
          while (Date.now() < deadline) {
            const caughtUp = toolCallIds.every((id) => {
              const tool = toolsById.get(id);
              return tool && tool.result !== undefined;
            });
            if (caughtUp) break;
            await new Promise((resolve) => setTimeout(resolve, 25));
          }
        }
        try {
          await turnPromise;
        } catch {
          return;
        }
        await saveGenerationCheckpoint(
          input.slice!.jobId,
          buildSliceCheckpoint(),
        );
      })
      .catch(() => undefined);
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
      initialConversation: resume?.conversation,
      startStep: resume?.step,
      initialNarrationCounter: resume?.narrationCounter,
      shouldYield: input.slice?.shouldYield,
      yieldSignal: input.slice?.yieldSignal,
      loopResult,
      onRoundEnd: input.slice
        ? (round) => {
            latestRound.step = round.step;
            latestRound.conversation = round.conversation;
            latestRound.narrationCounter = round.narrationCounter;
            persistRoundCheckpoint(round.toolCallIds);
          }
        : undefined,
      resolveContext: async () => {
        // Lease + ownership must win before the model; soft-budget only
        // enrichment queries (history / personalization).
        await leaseGate;
        const chat = await chatPromise;
        if (!chat) throw notFound("Chat not found.");

        // The turn rows MUST exist before the model streams: otherwise a
        // slow insert left the whole answer with nowhere to be saved. The
        // insert is a single short transaction (~tens of ms).
        await turnPromise.catch(() => undefined);
        if (turnFailure) throw turnFailure;
        if (input.turn && !turnState.assistant?.id) {
          throw new AppError(
            "Could not save your message. Please try again.",
            503,
            "turn_not_persisted",
          );
        }

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
  let generatedTitle: string | null = generatedTitleFromResume;
  const conversationForModel: IncomingMessage[] = clientConversation;

  /**
   * Live trace checkpoints.
   * - Durable Object (live viewers on other tabs): every 1.5s, fire-and-forget.
   * - Postgres (source of truth): every 4s, ALWAYS — so a crash / timeout
   *   mid-stream still leaves the partial answer and agent trace in Supabase.
   * Saves never queue: if one is still in flight the tick is skipped, so a
   * slow dependency can't build an unbounded chain that delays finalize.
   */
  const LIVE_PUBLISH_INTERVAL_MS = 1_500;
  const DB_CHECKPOINT_INTERVAL_MS = 4_000;
  let lastPartialSaveAtMs = 0;
  let lastDbCheckpointAtMs = 0;
  let publishInFlight = false;
  let dbCheckpointInFlight: Promise<unknown> | null = null;
  let partialSaveInFlight: Promise<unknown> = Promise.resolve();
  const maybeSavePartialTurn = () => {
    if (input.signal?.aborted) return;
    const now = Date.now();
    if (now - lastPartialSaveAtMs < LIVE_PUBLISH_INTERVAL_MS) {
      return;
    }
    const assistantId = turnState.assistant?.id;
    if (!assistantId) return;
    const snapshotAnswer = finalizeChatTitleStrippedAnswer(answer);
    if (
      !snapshotAnswer.trim() &&
      !thinking.trim() &&
      streamedSegments.length === 0
    ) {
      return;
    }
    lastPartialSaveAtMs = now;
    const snapshotSegments = segmentsWithoutAnswerCopy(
      JSON.parse(JSON.stringify(streamedSegments)) as TranscriptAgentSegment[],
      snapshotAnswer,
    );
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
        startedAtMs: turnStartedAtMs,
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

    if (!publishInFlight) {
      publishInFlight = true;
      void publishLiveTurn({
        chatId: input.chatId,
        userId: input.userId,
        assistantId,
        status: "running",
        answer: snapshotAnswer,
        contentJson: snapshotContentJson,
      })
        .catch(() => false)
        .finally(() => {
          publishInFlight = false;
        });
    }

    if (
      !dbCheckpointInFlight &&
      now - lastDbCheckpointAtMs >= DB_CHECKPOINT_INTERVAL_MS
    ) {
      lastDbCheckpointAtMs = now;
      const checkpoint = messagesRepo
        .checkpointStreamingMessage(
          assistantId,
          input.chatId,
          snapshotAnswer,
          snapshotContentJson,
        )
        .catch((error: unknown) => {
          console.error("[chat] partial checkpoint failed", {
            chatId: input.chatId,
            assistantId,
            error: error instanceof Error ? error.message : String(error),
          });
        })
        .finally(() => {
          dbCheckpointInFlight = null;
        });
      dbCheckpointInFlight = checkpoint;
      partialSaveInFlight = checkpoint;
    }
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

    const persistOnDone = async (): Promise<ChatSliceOutcome> => {
      // Let any in-flight partial checkpoint finish BEFORE the authoritative
      // finalize write — otherwise a late streaming write could overwrite the
      // completed answer with a shorter snapshot.
      try {
        await partialSaveInFlight;
      } catch {
        // ignore
      }
      try {
        await roundCheckpointChain;
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

      // ── Slice yield: park the round-boundary checkpoint and stop. The
      // runner chains the next slice, which resumes from this checkpoint.
      // Nothing here is terminal: no Postgres finalize, no billing, no title.
      if (
        input.slice?.jobId &&
        loopResult.outcome === "yielded" &&
        input.signal?.aborted !== true
      ) {
        const checkpoint = buildSliceCheckpoint();
        const snapshotAnswer = checkpoint.answer ?? "";
        if (turnState.assistant?.id) {
          await publishLiveTurn({
            chatId: input.chatId,
            userId: input.userId,
            assistantId: turnState.assistant.id,
            status: "running",
            answer: snapshotAnswer,
            contentJson: buildAssistantTranscriptRecord({
              answer: snapshotAnswer,
              thinking: checkpoint.thinking ?? "",
              tools: checkpoint.tools ?? [],
              agentUi: {
                model: modelForTelemetry,
                status: "streaming",
                startedAtMs: turnStartedAtMs,
                modelTurns: checkpoint.modelTurns ?? [],
                segments: checkpoint.segments ?? [],
                sources: dedupeTranscriptSources(checkpoint.segments ?? []),
              },
            }),
          }).catch(() => false);
        }
        await markJobContinuing(input.slice.jobId, checkpoint);
        return { status: "yielded" };
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
          startedAtMs: turnStartedAtMs,
          completedAtMs,
          thinkingDurationSeconds,
          modelTurns,
          segments: segmentsWithoutAnswerCopy(streamedSegments, cleanedAnswer),
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
        // Postgres is the durable transcript the moment the turn ends — the
        // UI, history cache, and reloads all read the finished row at once,
        // so spinners and "still working" states clear immediately. The same
        // payload is mirrored to Cloudflare for fast live reads; the 24h
        // archive path is now an idempotent backfill, not the primary write.
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
      }
      const latencyMs = Date.now() - started;
      const sliceOutcome: ChatSliceOutcome =
        wasCancelled || loopResult.outcome === "aborted"
          ? { status: "cancelled" }
          : failed || loopResult.outcome === "error"
            ? { status: "failed" }
            : pausedForUserInput || loopResult.outcome === "paused"
              ? { status: "paused" }
              : { status: "complete" };

      // Close the durable job IMMEDIATELY after the transcript commit. Any
      // later failure (title, live mirror, telemetry) must never leave the
      // job open — the watchdog would re-run a finished turn and overwrite it.
      if (input.slice?.jobId) {
        await finishGenerationJob({
          jobId: input.slice.jobId,
          status:
            sliceOutcome.status === "paused"
              ? "paused_for_user"
              : sliceOutcome.status,
          result: {
            assistantMessageId: assistantRow?.id ?? null,
            answerChars: cleanedAnswer.length,
            toolCount: tools.length,
            modelTurnCount: modelTurns.length,
            completedAtMs,
            sliceLatencyMs: latencyMs,
          },
          error:
            sliceOutcome.status === "failed"
              ? streamError ?? "Model completed without visible output."
              : null,
          checkpoint: buildSliceCheckpoint(),
        }).catch((error: unknown) => {
          console.error("[chat] finishGenerationJob failed", {
            jobId: input.slice?.jobId,
            error: error instanceof Error ? error.message : String(error),
          });
        });
      }

      if (assistantRow?.id) {
        const liveStatus =
          completionStatus === "cancelled"
            ? "cancelled"
            : completionStatus === "failed"
              ? "failed"
              : "complete";
        await publishLiveTurn({
          chatId: input.chatId,
          userId: input.userId,
          assistantId: assistantRow.id,
          status: liveStatus,
          answer: cleanedAnswer,
          contentJson,
        }).catch(() => false);
        if (!wasCancelled && generatedTitle) {
          await chatsRepo
            .updateChat(input.chatId, input.userId, { title: generatedTitle })
            .catch((error: unknown) => {
              console.error("[chat] title update failed", {
                chatId: input.chatId,
                error: error instanceof Error ? error.message : String(error),
              });
            });
        }
      }
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
      }).catch(() => undefined);

      if (wasCancelled || failed) return sliceOutcome;
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

      return sliceOutcome;
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
          startedAtMs: turnStartedAtMs,
          completedAtMs: failedAtMs,
          modelTurns,
          segments: segmentsWithoutAnswerCopy(streamedSegments, failedContent),
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
    // A setup failure (lease conflict already handled upstream; this is
    // ownership/prompt failures) must not leave the job parked forever.
    if (input.slice?.jobId) {
      await finishGenerationJob({
        jobId: input.slice.jobId,
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
      }).catch(() => undefined);
    }
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

/**
 * Switch the visible branch at a fork point. The message tree is the single
 * source of truth: the RPC repoints chats.active_leaf_message_id, then the
 * refreshed active-path page is returned so the client just renders it.
 */
export async function switchThreadBranch(
  chatId: string,
  userId: string,
  messageId: string,
  direction?: "prev" | "next" | null,
  targetIndex?: number | null,
  targetMessageId?: string | null,
) {
  const { leafId } = await messagesRepo.switchThreadBranch({
    chatId,
    userId,
    messageId,
    direction,
    targetIndex,
    targetMessageId,
  });
  // The active path changed — warm latest-page caches are stale by definition.
  const { invalidateChatHistoryCache } =
    await import("@/server/chat/warm-history-cache");
  await invalidateChatHistoryCache({ userId, chatId }).catch(() => undefined);
  const page = await getChatMessagesPage(chatId, userId, { limit: 500 });
  return {
    leafId,
    messages: page.messages,
    nextCursor: page.nextCursor,
    hasMore: page.hasMore,
  };
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


export { sanitizeMessages, encodeSseEvent };
