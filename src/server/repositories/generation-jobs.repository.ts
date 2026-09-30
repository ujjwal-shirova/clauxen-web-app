import { query, queryOne } from "@/server/db/pool";
import type { TurnFork } from "@/server/repositories/messages.repository";
import { AppError } from "@/server/db/errors";
import type { OpenAIInputItem } from "@/server/inference/openai-responses-client";
import type {
  CapturedToolCall,
  TranscriptAgentModelTurn,
  TranscriptAgentSegment,
} from "@/server/training/transcript-format";

export type GenerationJobStatus =
  | "queued"
  | "running"
  | "continuing"
  | "paused_for_user"
  | "complete"
  | "failed"
  | "cancelled";

export const ACTIVE_JOB_STATUSES: GenerationJobStatus[] = [
  "queued",
  "running",
  "continuing",
];

export type GenerationJobRow = {
  id: string;
  chat_id: string;
  user_id: string;
  assistant_message_id: string | null;
  user_message_id: string | null;
  status: GenerationJobStatus;
  slice_index: number;
  attempt: number;
  locked_by: string | null;
  locked_at: string | null;
  heartbeat_at: string;
  input: GenerationJobInput;
  checkpoint: GenerationCheckpoint;
  result: Record<string, unknown> | null;
  error: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

/** Everything a fresh slice needs to resume a turn without the HTTP request. */
export type GenerationJobInput = {
  messages: Array<{ role: string; content: string }>;
  /** Tree fork intent — edit-resend or assistant regenerate. */
  fork?: TurnFork | null;
  turn?: {
    content: string;
    modelContent?: string;
    fileIds?: string[];
    images?: Array<Record<string, unknown>>;
    userClientId: string;
    assistantClientId: string;
  } | null;
  vision?: {
    fileIds?: string[];
    images?: Array<Record<string, unknown>>;
  } | null;
  chatModel?: string;
  homerReasoningEffort?: string;
  extendedThinking?: boolean;
  clientTimezone?: string;
  userCountryCode?: string;
  generateChatTitle?: boolean;
  requestId?: string;
  turnStartedAtMs?: number;
};

export const GENERATION_CHECKPOINT_VERSION = 1;

/**
 * Round-boundary agent state. Written to Postgres after every completed tool
 * round and on every slice yield. A replacement slice restores this verbatim
 * and continues the agent loop at `step` — the model round that was
 * interrupted is simply re-run (no side effects happen before tools execute).
 */
export type GenerationCheckpoint = {
  version?: number;
  /** Next agent step index to run (0-based, MAX_STEPS = 24 in the loop). */
  step?: number;
  /** Full Responses/Chat-Completions input list incl. tool rounds so far. */
  conversation?: OpenAIInputItem[];
  narrationCounter?: number;
  answer?: string;
  thinking?: string;
  thinkingAccumulatedMs?: number;
  segments?: TranscriptAgentSegment[];
  tools?: CapturedToolCall[];
  modelTurns?: TranscriptAgentModelTurn[];
  generatedTitle?: string | null;
  turnStartedAtMs?: number;
  userMessageId?: string | null;
  assistantMessageId?: string | null;
};

export function emptyCheckpoint(): GenerationCheckpoint {
  return { version: GENERATION_CHECKPOINT_VERSION };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** Tolerant parse — a corrupt checkpoint must degrade to empty, never crash. */
export function asCheckpoint(value: unknown): GenerationCheckpoint {
  if (!isRecord(value)) return emptyCheckpoint();
  return {
    version: GENERATION_CHECKPOINT_VERSION,
    step: typeof value.step === "number" ? value.step : undefined,
    conversation: Array.isArray(value.conversation)
      ? (value.conversation as OpenAIInputItem[])
      : undefined,
    narrationCounter:
      typeof value.narrationCounter === "number"
        ? value.narrationCounter
        : undefined,
    answer: typeof value.answer === "string" ? value.answer : undefined,
    thinking: typeof value.thinking === "string" ? value.thinking : undefined,
    thinkingAccumulatedMs:
      typeof value.thinkingAccumulatedMs === "number"
        ? value.thinkingAccumulatedMs
        : undefined,
    segments: Array.isArray(value.segments)
      ? (value.segments as TranscriptAgentSegment[])
      : undefined,
    tools: Array.isArray(value.tools)
      ? (value.tools as CapturedToolCall[])
      : undefined,
    modelTurns: Array.isArray(value.modelTurns)
      ? (value.modelTurns as TranscriptAgentModelTurn[])
      : undefined,
    generatedTitle:
      typeof value.generatedTitle === "string"
        ? value.generatedTitle
        : undefined,
    turnStartedAtMs:
      typeof value.turnStartedAtMs === "number"
        ? value.turnStartedAtMs
        : undefined,
    userMessageId:
      typeof value.userMessageId === "string" ? value.userMessageId : undefined,
    assistantMessageId:
      typeof value.assistantMessageId === "string"
        ? value.assistantMessageId
        : undefined,
  };
}

const JOB_COLUMNS = `id, chat_id, user_id, assistant_message_id, user_message_id,
  status, slice_index, attempt, locked_by, locked_at, heartbeat_at,
  coalesce(input, '{}'::jsonb) as input,
  coalesce(checkpoint, '{}'::jsonb) as checkpoint,
  result, error, created_at, updated_at, completed_at`;

function normalizeJob(row: GenerationJobRow): GenerationJobRow {
  return {
    ...row,
    input: (isRecord(row.input) ? row.input : {}) as GenerationJobInput,
    checkpoint: asCheckpoint(row.checkpoint),
  };
}

/**
 * Create the job for a new turn. Throws generation_in_progress (409) when the
 * chat already has a live job — the caller must queue the follow-up instead.
 */
export async function createGenerationJob(input: {
  chatId: string;
  userId: string;
  jobInput: GenerationJobInput;
}): Promise<GenerationJobRow> {
  try {
    const row = await queryOne<GenerationJobRow>(
      `insert into public.chat_generation_jobs (chat_id, user_id, input)
       values ($1, $2, $3::jsonb)
       returning ${JOB_COLUMNS}`,
      [input.chatId, input.userId, JSON.stringify(input.jobInput ?? {})],
    );
    if (!row) {
      throw new AppError("Could not start the background task.", 500);
    }
    return normalizeJob(row);
  } catch (error) {
    if (error instanceof AppError && error.code === "conflict") {
      throw new AppError(
        "The previous reply is still finishing. Your message is saved and queued.",
        409,
        "generation_in_progress",
      );
    }
    throw error;
  }
}

export async function getGenerationJob(
  jobId: string,
): Promise<GenerationJobRow | null> {
  const row = await queryOne<GenerationJobRow>(
    `select ${JOB_COLUMNS} from public.chat_generation_jobs where id = $1`,
    [jobId],
  );
  return row ? normalizeJob(row) : null;
}

export async function getActiveGenerationJobForChat(
  chatId: string,
): Promise<GenerationJobRow | null> {
  const row = await queryOne<GenerationJobRow>(
    `select ${JOB_COLUMNS}
     from public.chat_generation_jobs
     where chat_id = $1 and status = any($2)
     order by created_at desc
     limit 1`,
    [chatId, ACTIVE_JOB_STATUSES],
  );
  return row ? normalizeJob(row) : null;
}

/**
 * Atomically claim a job for a slice (see claim_chat_generation_job).
 * Returns null when another worker holds it or it already finished.
 */
export async function claimGenerationJob(
  jobId: string,
  worker: string,
): Promise<GenerationJobRow | null> {
  const rows = await query<GenerationJobRow>(
    `select * from public.claim_chat_generation_job($1, $2)`,
    [jobId, worker],
  );
  const row = rows[0] ?? null;
  return row ? normalizeJob(row) : null;
}

export async function heartbeatGenerationJob(jobId: string): Promise<void> {
  await query(
    `update public.chat_generation_jobs
     set heartbeat_at = now(), updated_at = now()
     where id = $1 and status = any($2)`,
    [jobId, ACTIVE_JOB_STATUSES],
  );
}

export async function attachTurnMessageIds(
  jobId: string,
  ids: { userMessageId: string | null; assistantMessageId: string | null },
): Promise<void> {
  await query(
    `update public.chat_generation_jobs
     set user_message_id = coalesce($2::uuid, user_message_id),
         assistant_message_id = coalesce($3::uuid, assistant_message_id),
         checkpoint = coalesce(checkpoint, '{}'::jsonb) || jsonb_build_object(
           'userMessageId', coalesce($2::text, checkpoint->>'userMessageId'),
           'assistantMessageId', coalesce($3::text, checkpoint->>'assistantMessageId')
         ),
         updated_at = now()
     where id = $1`,
    [jobId, ids.userMessageId, ids.assistantMessageId],
  );
}

export async function saveGenerationCheckpoint(
  jobId: string,
  checkpoint: GenerationCheckpoint,
): Promise<void> {
  await query(
    `update public.chat_generation_jobs
     set checkpoint = $2::jsonb,
         heartbeat_at = now(),
         updated_at = now()
     where id = $1 and status = any($3)`,
    [
      jobId,
      JSON.stringify({ ...checkpoint, version: GENERATION_CHECKPOINT_VERSION }),
      ACTIVE_JOB_STATUSES,
    ],
  );
}

/** Slice yielded: park the checkpoint and wait for the chained slice. */
export async function markJobContinuing(
  jobId: string,
  checkpoint: GenerationCheckpoint,
): Promise<void> {
  await query(
    `update public.chat_generation_jobs
     set status = 'continuing',
         checkpoint = $2::jsonb,
         slice_index = slice_index + 1,
         locked_by = null,
         locked_at = null,
         heartbeat_at = now(),
         updated_at = now()
     where id = $1 and status = any($3)`,
    [
      jobId,
      JSON.stringify({ ...checkpoint, version: GENERATION_CHECKPOINT_VERSION }),
      ACTIVE_JOB_STATUSES,
    ],
  );
}

export async function finishGenerationJob(input: {
  jobId: string;
  status: "complete" | "failed" | "cancelled" | "paused_for_user";
  result?: Record<string, unknown>;
  error?: string | null;
  checkpoint?: GenerationCheckpoint;
}): Promise<void> {
  await query(
    `update public.chat_generation_jobs
     set status = $2,
         result = coalesce($3::jsonb, result),
         error = coalesce($4, error),
         checkpoint = coalesce($5::jsonb, checkpoint),
         locked_by = null,
         locked_at = null,
         completed_at = now(),
         updated_at = now()
     where id = $1`,
    [
      input.jobId,
      input.status,
      input.result ? JSON.stringify(input.result) : null,
      input.error ?? null,
      input.checkpoint
        ? JSON.stringify({
            ...input.checkpoint,
            version: GENERATION_CHECKPOINT_VERSION,
          })
        : null,
    ],
  );
}

/** Explicit user stop. Running slices poll this and abort within seconds. */
export async function cancelActiveJobsForChat(
  chatId: string,
  userId: string,
): Promise<number> {
  const rows = await query<{ id: string }>(
    `update public.chat_generation_jobs
     set status = 'cancelled',
         locked_by = null,
         locked_at = null,
         completed_at = now(),
         updated_at = now()
     where chat_id = $1 and user_id = $2 and status = any($3)
     returning id`,
    [chatId, userId, ACTIVE_JOB_STATUSES],
  );
  return rows.length;
}

export async function listStalledGenerationJobs(
  limit = 10,
): Promise<GenerationJobRow[]> {
  const rows = await query<GenerationJobRow>(
    `select * from public.list_stalled_chat_generation_jobs(
       interval '90 seconds', $1
     )`,
    [Math.min(Math.max(1, limit), 25)],
  );
  return rows.map(normalizeJob);
}

/** Lightweight status read for slice cancel watchers (no checkpoint fetch). */
export async function getGenerationJobStatus(
  jobId: string,
): Promise<GenerationJobStatus | null> {
  const row = await queryOne<{ status: GenerationJobStatus }>(
    `select status from public.chat_generation_jobs where id = $1`,
    [jobId],
  );
  return row?.status ?? null;
}

/** Retention: terminal job rows (with their checkpoints) older than this. */
export async function deleteTerminalJobsOlderThan(
  olderThan: string,
  limit = 500,
): Promise<number> {
  const rows = await query<{ id: string }>(
    `delete from public.chat_generation_jobs
     where status in ('complete', 'failed', 'cancelled', 'paused_for_user')
       and completed_at < now() - $1::interval
       and id in (
         select id from public.chat_generation_jobs
         where status in ('complete', 'failed', 'cancelled', 'paused_for_user')
           and completed_at < now() - $1::interval
         order by completed_at asc
         limit $2
       )
     returning id`,
    [olderThan, Math.min(Math.max(1, limit), 2000)],
  );
  return rows.length;
}

/** HTTP-safe activity flag for /generate/status. */
export async function isChatJobActive(chatId: string): Promise<boolean> {
  const row = await queryOne<{ exists: boolean }>(
    `select exists(
       select 1 from public.chat_generation_jobs
       where chat_id = $1 and status = any($2)
     ) as exists`,
    [chatId, ACTIVE_JOB_STATUSES],
  );
  return Boolean(row?.exists);
}
