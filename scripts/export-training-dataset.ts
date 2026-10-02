#!/usr/bin/env tsx
/**
 * Export a clean, training-ready JSONL dataset from chat history + agentic
 * traces. One JSONL line = one conversation sample, already structured for
 * SFT / distillation pipelines — no manual filtering required.
 *
 * Sample shape (schema_version "clauxen.trainingsample.v1"):
 * {
 *   sample_id, chat_id, user_id_hash, title, created_at, updated_at,
 *   models: [...],
 *   turns: [{                       // one per user prompt -> assistant reply
 *     turn_id, user: {text, attachments},
 *     assistant: {text, thinking, tool_calls, model, started_at_ms, completed_at_ms},
 *     agent_trace: [ {type: thinking|narration|tool, ...} ]   // UI timeline
 *   }],
 *   messages: [{role, content, tool_calls?}],  // flat OpenAI-style, SFT-ready
 *   stats: {message_count, turn_count, tool_call_count, thinking_count, char_count},
 *   training_eligible
 * }
 *
 * Cleaning applied automatically:
 *   - drops rows flagged training_eligible = false (unless --include-ineligible)
 *   - strips <chat_title> markup, empty/cancelled rows and
 *     "Generation interrupted." placeholders
 *   - dedupes identical rows and drops conversations without a complete
 *     user -> assistant exchange
 *   - hash-de-identifies user ids (stable sha256 prefix)
 *
 * Usage:
 *   npx tsx scripts/export-training-dataset.ts \
 *     [--out ./training-export] [--user <userId>] [--limit 10000] \
 *     [--min-turns 1] [--include-ineligible] [--include-thinking] \
 *     [--require-consent]
 *
 * DB connection: DATABASE_URL / POSTGRES_URL / POSTGRES_PRISMA_URL /
 * POSTGRES_URL_NON_POOLING (or SUPABASE_DB_URL). Reads .env.local / .env when
 * present.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

// ---------------------------------------------------------------------------
// Env loading (no extra deps)
// ---------------------------------------------------------------------------

function loadDotEnvFiles(): void {
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
  for (const name of [".env.local", ".env"]) {
    const file = path.join(root, name);
    if (!fs.existsSync(file)) continue;
    for (const rawLine of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq <= 0) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  }
}

loadDotEnvFiles();

const connectionString =
  process.env.DATABASE_URL?.trim() ||
  process.env.POSTGRES_URL_NON_POOLING?.trim() ||
  process.env.POSTGRES_URL?.trim() ||
  process.env.POSTGRES_PRISMA_URL?.trim() ||
  process.env.SUPABASE_DB_URL?.trim() ||
  "";

if (!connectionString && !argv.includes("--self-test")) {
  console.error(
    "Missing DB connection: set DATABASE_URL (or POSTGRES_URL / SUPABASE_DB_URL).",
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

const argv = process.argv.slice(2);
function argValue(flag: string): string | undefined {
  const index = argv.indexOf(flag);
  return index >= 0 ? argv[index + 1] : undefined;
}
const outDir =
  argValue("--out") ?? path.join(process.cwd(), "training-export");
const onlyUser = argValue("--user");
const rowLimit = Number(argValue("--limit") ?? "100000") || 100000;
const minTurns = Math.max(1, Number(argValue("--min-turns") ?? "1") || 1);
const includeIneligible = argv.includes("--include-ineligible");
const includeThinking = argv.includes("--include-thinking");
/** Governance gate: only export users whose latest consent event is a grant. */
const requireConsent = argv.includes("--require-consent");
/** Validate cleaning + turn grouping on fixture rows without a DB connection. */
const selfTest = argv.includes("--self-test");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ContentPart = {
  type: string;
  text?: string;
  thinking?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: string;
  is_error?: boolean;
};

type AgentUi = {
  model?: string;
  status?: string;
  startedAtMs?: number;
  completedAtMs?: number;
  thinkingDurationSeconds?: number;
  segments?: Array<Record<string, unknown> & { type?: string }>;
  actions?: Array<{
    id?: string;
    name?: string;
    input?: Record<string, unknown>;
    result?: string;
    isError?: boolean;
    startedAtMs?: number;
    completedAtMs?: number;
    description?: string;
  }>;
  modelTurns?: Array<{
    stopReason?: string;
    startedAtMs?: number;
    completedAtMs?: number;
    assistant?: ContentPart[];
    toolResults?: ContentPart[];
  }>;
};

type TranscriptRecord = {
  schema_version?: string;
  role?: string;
  type?: string;
  status?: string;
  message?: { content?: ContentPart[] };
  agent_ui?: AgentUi;
};

type RawRow = {
  chat_id: string;
  user_id: string;
  chat_title: string;
  chat_created_at: Date | string | null;
  chat_updated_at: Date | string | null;
  message_id: string | null;
  client_id: string | null;
  row_created_at: Date | string | null;
  training_eligible: boolean;
  record: TranscriptRecord;
};

type ToolCall = {
  id: string;
  name: string;
  input: Record<string, unknown>;
  result?: string;
  is_error?: boolean;
  description?: string;
  started_at_ms?: number;
  completed_at_ms?: number;
};

type TraceSegment = {
  type: "thinking" | "narration" | "tool";
  id?: string;
  content?: string;
  text?: string;
  name?: string;
  input?: Record<string, unknown>;
  result?: string;
  status?: string;
  started_at_ms?: number;
  completed_at_ms?: number;
};

type Turn = {
  turn_id: string | null;
  user: { text: string; attachments: unknown[] };
  assistant: {
    text: string;
    thinking: string;
    tool_calls: ToolCall[];
    model: string | null;
    started_at_ms: number | null;
    completed_at_ms: number | null;
    status: string | null;
  };
  agent_trace: TraceSegment[];
};

// ---------------------------------------------------------------------------
// Cleaning helpers
// ---------------------------------------------------------------------------

const CHAT_TITLE_BLOCK_RE = /<chat_title>[\s\S]*?<\/chat_title>/gi;
const CHAT_TITLE_TAG_RE = /<\/?chat_title>/gi;

function cleanText(text: string | undefined | null): string {
  if (!text) return "";
  return text
    .replace(CHAT_TITLE_BLOCK_RE, "")
    .replace(CHAT_TITLE_TAG_RE, "")
    .trim();
}

function isPlaceholderAnswer(text: string): boolean {
  return (
    text === "Generation interrupted." ||
    text === "Something unexpected happened. Please try again."
  );
}

function iso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function hashUserId(userId: string): string {
  return `u_${crypto.createHash("sha256").update(userId).digest("hex").slice(0, 16)}`;
}

/** States treated as an affirmative model-training grant. */
const CONSENT_GRANTED_STATES = new Set([
  "granted",
  "grant",
  "allowed",
  "allow",
  "approved",
  "approve",
  "accepted",
  "opt_in",
  "opt-in",
  "optin",
  "true",
  "yes",
  "active",
]);

function isConsentGranted(
  consent: {
    consent_state: string;
    revoked_at: Date | string | null;
    expires_at: Date | string | null;
  } | null,
): boolean {
  if (!consent) return false;
  if (consent.revoked_at) return false;
  if (consent.expires_at && new Date(consent.expires_at).getTime() < Date.now()) {
    return false;
  }
  return CONSENT_GRANTED_STATES.has(consent.consent_state.trim().toLowerCase());
}

/** turnId = "t-<uuid>" encoded in client_id ("t-..~u" / "t-..~a"). */
function deriveTurnId(clientId: string | null): string | null {
  const value = (clientId ?? "").trim();
  if (!value.startsWith("t-")) return null;
  if (value.endsWith("~u") || value.endsWith("~a")) {
    const turnId = value.slice(0, -2);
    return turnId.length > 2 ? turnId : null;
  }
  return value || null;
}

function extractParts(record: TranscriptRecord): ContentPart[] {
  return Array.isArray(record.message?.content) ? record.message!.content! : [];
}

function partsToText(parts: ContentPart[]): string {
  return cleanText(
    parts
      .filter((part) => part?.type === "text" && typeof part.text === "string")
      .map((part) => cleanText(part.text))
      .filter(Boolean)
      .join("\n\n"),
  );
}

function partsToThinking(parts: ContentPart[]): string {
  return cleanText(
    parts
      .filter(
        (part) => part?.type === "thinking" && typeof part.thinking === "string",
      )
      .map((part) => cleanText(part.thinking))
      .filter(Boolean)
      .join("\n\n"),
  );
}

function partsToToolCalls(parts: ContentPart[], agentUi?: AgentUi): ToolCall[] {
  const calls: ToolCall[] = [];
  for (const part of parts) {
    if (part?.type !== "tool_use" || typeof part.name !== "string") continue;
    const id = typeof part.id === "string" && part.id ? part.id : `tool-${calls.length + 1}`;
    const resultPart = parts.find(
      (candidate) =>
        candidate?.type === "tool_result" && candidate.tool_use_id === id,
    );
    const action = agentUi?.actions?.find((candidate) => candidate?.id === id);
    calls.push({
      id,
      name: part.name,
      input: (part.input ?? action?.input ?? {}) as Record<string, unknown>,
      result:
        typeof resultPart?.content === "string"
          ? resultPart.content
          : action?.result,
      is_error: Boolean(resultPart?.is_error ?? action?.isError),
      description: action?.description,
      started_at_ms: action?.startedAtMs,
      completed_at_ms: action?.completedAtMs,
    });
  }
  return calls;
}

function agentTraceOf(agentUi: AgentUi | undefined): TraceSegment[] {
  const segments: TraceSegment[] = [];
  for (const segment of agentUi?.segments ?? []) {
    if (!segment || typeof segment !== "object" || !segment.type) continue;
    if (segment.type === "thinking") {
      const content = cleanText(String(segment.content ?? ""));
      if (content) segments.push({ type: "thinking", content, id: segment.id as string, started_at_ms: segment.startedAtMs as number, completed_at_ms: segment.completedAtMs as number });
    } else if (segment.type === "narration") {
      const content = cleanText(String(segment.content ?? ""));
      if (content) segments.push({ type: "narration", content, id: segment.id as string, started_at_ms: segment.startedAtMs as number, completed_at_ms: segment.completedAtMs as number });
    } else if (segment.type === "tool") {
      segments.push({
        type: "tool",
        id: segment.id as string,
        name: String(segment.name ?? ""),
        input: (segment.input ?? {}) as Record<string, unknown>,
        result: typeof segment.result === "string" ? segment.result : undefined,
        status: String(segment.status ?? "done"),
        started_at_ms: segment.startedAtMs as number,
        completed_at_ms: segment.completedAtMs as number,
      });
    }
  }
  return segments;
}

// ---------------------------------------------------------------------------
// Row grouping -> turns
// ---------------------------------------------------------------------------

function rowsToTurns(rows: RawRow[]): { turns: Turn[]; models: Set<string> } {
  const models = new Set<string>();
  const turns: Turn[] = [];
  let current: Turn | null = null;
  const seen = new Set<string>();

  const pushTurn = () => {
    if (!current) return;
    const userText = current.user.text.trim();
    const assistantText = current.assistant.text.trim();
    const hasTools = current.assistant.tool_calls.length > 0;
    const hasTrace = current.agent_trace.length > 0;
    // A usable turn needs a prompt and some answer/tool activity.
    if (userText && (assistantText || hasTools || hasTrace)) {
      turns.push(current);
    }
    current = null;
  };

  for (const row of rows) {
    const record = row.record;
    if (!record || typeof record !== "object") continue;
    if ("type" in record && record.type === "turn_ended") {
      pushTurn();
      continue;
    }
    if (!record.role || !record.message) continue;

    const parts = extractParts(record);
    const fingerprint = crypto
      .createHash("sha1")
      .update(JSON.stringify(record))
      .digest("hex");
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);

    const turnId = deriveTurnId(row.client_id);
    const agentUi = record.agent_ui;
    if (agentUi?.model) models.add(agentUi.model);

    if (record.role === "user") {
      // Tool-result rows ride on user records; merge them into the open
      // turn instead of treating them as a new prompt.
      const toolResults = parts.filter((part) => part?.type === "tool_result");
      if (toolResults.length > 0 && current) {
        for (const result of toolResults) {
          const call = current.assistant.tool_calls.find(
            (candidate) => candidate.id === result.tool_use_id,
          );
          if (call && typeof result.content === "string") {
            call.result = call.result ?? result.content;
            call.is_error = Boolean(result.is_error ?? call.is_error);
          }
        }
        continue;
      }
      pushTurn();
      const text = partsToText(parts);
      current = {
        turn_id: turnId,
        user: {
          text: isPlaceholderAnswer(text) ? "" : text,
          attachments: [],
        },
        assistant: {
          text: "",
          thinking: "",
          tool_calls: [],
          model: agentUi?.model ?? null,
          started_at_ms: agentUi?.startedAtMs ?? null,
          completed_at_ms: agentUi?.completedAtMs ?? null,
          status: agentUi?.status ?? null,
        },
        agent_trace: [],
      };
      continue;
    }

    if (record.role !== "assistant") continue;
    if (!current) {
      // Orphan assistant row (truncated history) — open an empty prompt turn.
      current = {
        turn_id: turnId,
        user: { text: "", attachments: [] },
        assistant: {
          text: "",
          thinking: "",
          tool_calls: [],
          model: agentUi?.model ?? null,
          started_at_ms: agentUi?.startedAtMs ?? null,
          completed_at_ms: agentUi?.completedAtMs ?? null,
          status: agentUi?.status ?? null,
        },
        agent_trace: [],
      };
    }

    const text = partsToText(parts);
    if (text && !isPlaceholderAnswer(text)) {
      current.assistant.text = cleanText(
        [current.assistant.text, text].filter(Boolean).join("\n\n"),
      );
    }
    const thinking = partsToThinking(parts);
    if (thinking) {
      current.assistant.thinking = cleanText(
        [current.assistant.thinking, thinking].filter(Boolean).join("\n\n"),
      );
    }
    current.assistant.tool_calls.push(...partsToToolCalls(parts, agentUi));
    current.agent_trace.push(...agentTraceOf(agentUi));
    if (turnId && !current.turn_id) current.turn_id = turnId;
    if (agentUi?.model) current.assistant.model = agentUi.model;
    if (typeof agentUi?.startedAtMs === "number") {
      current.assistant.started_at_ms = agentUi.startedAtMs;
    }
    if (typeof agentUi?.completedAtMs === "number") {
      current.assistant.completed_at_ms = agentUi.completedAtMs;
    }
    if (agentUi?.status) current.assistant.status = agentUi.status;
  }
  pushTurn();

  return { turns, models };
}

function turnsToChatMessages(
  turns: Turn[],
  includeThinking: boolean,
): Array<Record<string, unknown>> {
  const messages: Array<Record<string, unknown>> = [];
  for (const turn of turns) {
    const userContent = turn.user.text;
    const toolResultsPending: Array<Record<string, unknown>> = [];
    if (userContent) {
      messages.push({ role: "user", content: userContent });
    }
    const assistant: Record<string, unknown> = {
      role: "assistant",
      content: turn.assistant.text,
    };
    if (includeThinking && turn.assistant.thinking) {
      assistant.thinking = turn.assistant.thinking;
    }
    if (turn.assistant.tool_calls.length > 0) {
      assistant.tool_calls = turn.assistant.tool_calls.map((call) => ({
        id: call.id,
        name: call.name,
        input: call.input,
      }));
    }
    if (turn.assistant.model) assistant.model = turn.assistant.model;
    messages.push(assistant);
    for (const call of turn.assistant.tool_calls) {
      if (typeof call.result !== "string") continue;
      toolResultsPending.push({
        role: "tool",
        tool_call_id: call.id,
        name: call.name,
        content: call.result,
        is_error: call.is_error ?? false,
      });
    }
    messages.push(...toolResultsPending);
  }
  return messages;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Self test (no DB needed): npx tsx scripts/export-training-dataset.ts --self-test
// ---------------------------------------------------------------------------

function runSelfTest(): void {
  const failures: string[] = [];
  const check = (condition: boolean, label: string) => {
    if (condition) {
      console.log(`  ok  ${label}`);
    } else {
      failures.push(label);
      console.log(`FAIL  ${label}`);
    }
  };

  const base = {
    chat_id: "c1",
    user_id: "u1",
    chat_title: "Test",
    chat_created_at: "2026-01-01T00:00:00Z",
    chat_updated_at: "2026-01-01T00:00:00Z",
    row_created_at: "2026-01-01T00:00:00Z",
    training_eligible: true,
  };

  const richAssistant: TranscriptRecord = {
    role: "assistant",
    message: {
      content: [
        { type: "thinking", thinking: "I should search." },
        { type: "text", text: "Let me look that up." },
        {
          type: "tool_use",
          id: "call_1",
          name: "web_search",
          input: { q: "x" },
        },
        {
          type: "text",
          text: "<chat_title>Hidden title</chat_title>\nThe answer is 42.",
        },
      ],
    },
    agent_ui: {
      model: "test-model-1",
      startedAtMs: 1000,
      completedAtMs: 9000,
      segments: [
        { type: "thinking", id: "s1", content: "I should search." },
        {
          type: "tool",
          id: "s2",
          toolCallId: "call_1",
          name: "web_search",
          input: { q: "x" },
          result: "results...",
          status: "done",
        },
        { type: "narration", id: "s3", content: "The answer is 42.", isFinal: true },
      ],
      actions: [],
    },
  };

  const rows: RawRow[] = [
    {
      ...base,
      message_id: "m1",
      client_id: "t-aaaa~u",
      record: {
        role: "user",
        message: { content: [{ type: "text", text: "What is 6*7?" }] },
      },
    },
    {
      ...base,
      message_id: "m2",
      client_id: "t-aaaa~a",
      record: richAssistant,
    },
    {
      // Tool-result row rides on a user record — must merge into the turn.
      ...base,
      message_id: "m2",
      client_id: "t-aaaa~a",
      record: {
        role: "user",
        message: {
          content: [
            { type: "tool_result", tool_use_id: "call_1", content: "results..." },
          ],
        },
      },
    },
    // Exact duplicate of the user prompt — must dedupe.
    {
      ...base,
      message_id: "m1",
      client_id: "t-aaaa~u",
      record: {
        role: "user",
        message: { content: [{ type: "text", text: "What is 6*7?" }] },
      },
    },
    { ...base, message_id: "m2", client_id: "t-aaaa~a", record: { type: "turn_ended", status: "success" } as TranscriptRecord },
    // Second turn: interrupted placeholder answer must be dropped.
    {
      ...base,
      message_id: "m3",
      client_id: "t-bbbb~u",
      record: {
        role: "user",
        message: { content: [{ type: "text", text: "And now?" }] },
      },
    },
    {
      ...base,
      message_id: "m4",
      client_id: "t-bbbb~a",
      record: {
        role: "assistant",
        message: {
          content: [{ type: "text", text: "Generation interrupted." }],
        },
      },
    },
    { ...base, message_id: "m4", client_id: "t-bbbb~a", record: { type: "turn_ended", status: "cancelled" } as TranscriptRecord },
  ];

  const { turns, models } = rowsToTurns(rows);

  check(turns.length === 1, `placeholder turn dropped (turns=${turns.length}, want 1)`);
  const turn = turns[0]!;
  check(turn.turn_id === "t-aaaa", "turn id derived from client_id");
  check(turn.user.text === "What is 6*7?", "user prompt kept");
  check(
    turn.assistant.text === "Let me look that up.\n\nThe answer is 42.",
    `answer cleaned + joined (got: ${JSON.stringify(turn.assistant.text)})`,
  );
  check(
    !turn.assistant.text.includes("chat_title"),
    "chat_title markup stripped",
  );
  check(turn.assistant.thinking === "I should search.", "thinking captured");
  check(turn.assistant.tool_calls.length === 1, "one tool call captured");
  check(
    turn.assistant.tool_calls[0]?.result === "results...",
    "tool result merged from tool_result user row",
  );
  check(turn.agent_trace.length === 3, "agent trace segments preserved");
  check(models.has("test-model-1"), "model recorded");
  check(
    turn.assistant.started_at_ms === 1000 &&
      turn.assistant.completed_at_ms === 9000,
    "turn timing preserved",
  );

  const messages = turnsToChatMessages(turns, true);
  check(messages.length === 3, `flat messages = user/assistant/tool (got ${messages.length})`);
  check(messages[0]?.role === "user" && messages[1]?.role === "assistant", "SFT order user -> assistant");
  check(messages[2]?.role === "tool", "tool result message present");

  console.log(
    failures.length === 0
      ? "\nSelf test PASSED"
      : `\nSelf test FAILED (${failures.length})`,
  );
  if (failures.length > 0) process.exit(1);
}

async function main() {
  if (selfTest) {
    runSelfTest();
    return;
  }

  const pool = new Pool({
    connectionString,
    max: 4,
    statement_timeout: 60_000,
    query_timeout: 60_000,
  });

  fs.mkdirSync(outDir, { recursive: true });
  const datasetPath = path.join(outDir, "training-dataset.jsonl");
  const manifestPath = path.join(outDir, "manifest.json");
  const datasetStream = fs.createWriteStream(datasetPath, "utf8");

  const stats = {
    chats_scanned: 0,
    samples_written: 0,
    samples_skipped_ineligible: 0,
    samples_skipped_empty: 0,
    turns_total: 0,
    tool_calls_total: 0,
    thinking_blocks_total: 0,
    characters_total: 0,
  };
  const modelCounts = new Map<string, number>();

  // Keyset-paginate chats so multi-million-row tables stream fine.
  let lastChatId = "";
  let done = false;

  while (!done && stats.chats_scanned < rowLimit) {
    const chats = await pool.query<{
      id: string;
      user_id: string;
      title: string;
      created_at: Date | string | null;
      updated_at: Date | string | null;
    }>(
      `select c.id, c.user_id, c.title, c.created_at, c.updated_at
         from public.chats c
        where c.status != 'deleted'
          and c.id > $1
          and ($2::uuid is null or c.user_id = $2)
        order by c.id asc
        limit 200`,
      [lastChatId, onlyUser ?? null],
    );

    if (chats.rows.length === 0) break;

    // Latest model-training consent event per user (governance gate).
    const userIds = [...new Set(chats.rows.map((chat) => chat.user_id))];
    const consentRows = await pool.query<{
      user_id: string;
      consent_state: string;
      consent_scope: string;
      effective_at: Date | string | null;
      revoked_at: Date | string | null;
      expires_at: Date | string | null;
    }>(
      `select distinct on (user_id)
              user_id, consent_state, consent_scope, effective_at, revoked_at, expires_at
         from public.model_training_consent_events
        where user_id = any($1::uuid[])
        order by user_id, created_at desc`,
      [userIds],
    );
    const consentByUser = new Map(consentRows.rows.map((row) => [row.user_id, row]));

    for (const chat of chats.rows) {
      lastChatId = chat.id;
      stats.chats_scanned += 1;

      const consent = consentByUser.get(chat.user_id) ?? null;
      if (requireConsent && !isConsentGranted(consent)) {
        stats.samples_skipped_ineligible += 1;
        continue;
      }

      // Prefer the durable transcript table; fall back to chat_messages
      // content_json (legacy rows / older chats).
      const lineRows = await pool.query<RawRow>(
        `select l.chat_id, l.user_id, c.title as chat_title,
                c.created_at as chat_created_at, c.updated_at as chat_updated_at,
                l.message_id::text as message_id, m.client_id,
                l.created_at as row_created_at, l.training_eligible, l.record
           from public.chat_transcript_lines l
           join public.chats c on c.id = l.chat_id
           left join public.chat_messages m on m.id = l.message_id
          where l.chat_id = $1
          order by l.seq asc`,
        [chat.id],
      );

      let rows: RawRow[] = lineRows.rows;
      if (rows.length === 0) {
        const messageRows = await pool.query<{
          id: string;
          client_id: string | null;
          created_at: Date | string;
          record: TranscriptRecord;
        }>(
          `select m.id::text as id, m.client_id, m.created_at,
                  case
                    when m.content_json ? 'message' then m.content_json
                    when m.role = 'user'
                      then jsonb_build_object(
                        'role', 'user',
                        'message', jsonb_build_array(
                          jsonb_build_object('type', 'text', 'text', coalesce(m.content, ''))
                        )
                      )
                    else jsonb_build_object(
                      'role', 'assistant',
                      'message', jsonb_build_array(
                        jsonb_build_object('type', 'text', 'text', coalesce(m.content, ''))
                      )
                    )
                  end as record
             from public.chat_messages m
            where m.chat_id = $1
              and (m.status != 'cancelled' or coalesce(trim(m.content), '') != '')
            order by m.created_at asc,
                     case when m.role = 'user' then 0 else 1 end asc,
                     m.id asc`,
          [chat.id],
        );
        rows = messageRows.rows.map((row) => ({
          chat_id: chat.id,
          user_id: chat.user_id,
          chat_title: chat.title,
          chat_created_at: chat.created_at,
          chat_updated_at: chat.updated_at,
          message_id: row.id,
          client_id: row.client_id,
          row_created_at: row.created_at,
          // Rebuilt legacy rows carry no per-line flag — same policy as
          // chat.service.getChatTranscript (treat as eligible).
          training_eligible: true,
          record: row.record,
        }));
      }

      if (rows.length === 0) {
        stats.samples_skipped_empty += 1;
        continue;
      }

      const linesEligible = rows.every((row) => row.training_eligible !== false);
      if (!includeIneligible && !linesEligible) {
        stats.samples_skipped_ineligible += 1;
        continue;
      }

      const { turns, models } = rowsToTurns(rows);
      if (turns.length < minTurns) {
        stats.samples_skipped_empty += 1;
        continue;
      }

      const messages = turnsToChatMessages(turns, includeThinking);
      const sample = {
        schema_version: "clauxen.trainingsample.v1",
        sample_id: chat.id,
        chat_id: chat.id,
        user_id_hash: hashUserId(chat.user_id),
        title: cleanText(chat.title),
        created_at: iso(chat.created_at),
        updated_at: iso(chat.updated_at),
        models: [...models],
        turns,
        messages,
        consent: consent
          ? {
              state: consent.consent_state,
              scope: consent.consent_scope,
              effective_at: iso(consent.effective_at),
              revoked_at: iso(consent.revoked_at),
              expires_at: iso(consent.expires_at),
            }
          : null,
        stats: {
          message_count: messages.length,
          turn_count: turns.length,
          tool_call_count: turns.reduce(
            (count, turn) => count + turn.assistant.tool_calls.length,
            0,
          ),
          thinking_count: turns.reduce(
            (count, turn) => count + (turn.assistant.thinking ? 1 : 0),
            0,
          ),
          char_count: turns.reduce(
            (count, turn) =>
              count +
              turn.user.text.length +
              turn.assistant.text.length +
              turn.assistant.thinking.length,
            0,
          ),
        },
        training_eligible: linesEligible,
      };

      datasetStream.write(`${JSON.stringify(sample)}\n`);
      stats.samples_written += 1;
      stats.turns_total += sample.stats.turn_count;
      stats.tool_calls_total += sample.stats.tool_call_count;
      stats.thinking_blocks_total += sample.stats.thinking_count;
      stats.characters_total += sample.stats.char_count;
      for (const model of models) {
        modelCounts.set(model, (modelCounts.get(model) ?? 0) + 1);
      }
    }

    if (chats.rows.length < 200) done = true;
  }

  await new Promise<void>((resolve, reject) => {
    datasetStream.end((error?: Error | null) =>
      error ? reject(error) : resolve(),
    );
  });

  const manifest = {
    schema_version: "clauxen.trainingsample.v1",
    exported_at: new Date().toISOString(),
    dataset: path.basename(datasetPath),
    filters: {
      user: onlyUser ?? null,
      min_turns: minTurns,
      include_ineligible: includeIneligible,
      include_thinking: includeThinking,
      require_consent: requireConsent,
    },
    models: Object.fromEntries([...modelCounts.entries()].sort()),
    stats,
    cleaning: [
      "drops training_eligible=false chats unless --include-ineligible",
      "strips <chat_title> markup",
      "drops empty/cancelled rows and placeholder error answers",
      "dedupes identical transcript rows (sha1 of record)",
      "drops conversations without a complete user->assistant exchange",
      "hash-de-identifies user ids (sha256 prefix)",
    ],
  };
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  await pool.end();

  console.log(`Dataset : ${datasetPath}`);
  console.log(`Manifest: ${manifestPath}`);
  console.log(JSON.stringify(stats, null, 2));
}

main().catch((error) => {
  console.error("Training export failed:", error);
  process.exit(1);
});
