/**
 * Clauxen autonomous agent loop (OpenAI Responses API) — flat trace protocol.
 *
 * Round lifecycle:
 *   1. Stream one model round: reasoning → narration → strict function calls.
 *   2. Every text delta streams live as a first-person narration step —
 *      visible progress prose in the chat trace.
 *   3. Tool calls close the round's narration; tools execute sequentially.
 *   4. tool_result blocks go back; next round starts.
 *   5. A round with no tool calls ends the turn: its text is promoted to the
 *      durable answer via answer_finalize (in place — no answer teleporting).
 *
 * Emission is turn-scoped and flat (no frame events): thinking phases,
 * narration lines, and tool rows append to one ordered AgentStep list that
 * the client reducer folds into Message.agentTrace. Narration is distinct
 * from interleaved thinking — it is deliberate, user-facing progress output.
 */

import {
  toOpenAITools,
  requireOpenAIApiKey,
  optionalOpenAIBaseUrl,
  env,
  type OpenAIInputItem,
  type OpenAIOutputItem,
  type OpenAIMessageContent,
} from "@/server/agent-core/provider/messages-client";
import type { ClauxenSseStream } from "@/server/inference/clauxen-sse-stream";
import {
  healToolArgs,
  executeToolSafely,
  type ToolDefinition,
  type ToolExecutionContext,
} from "@/server/inference/tool-healer";
import {
  executeAutonomousTool,
  autonomousAgentTools,
} from "@/server/agent-core/tools";
import {
  buildAgentMcpTools,
  executeMcpToolCall,
  resolveMcpToolCall,
} from "@/server/plugins/plugin-runtime";
import { sanitizeAssistantStreamDelta } from "@/lib/assistant-output-sanitize";
import { inferLanguage } from "@/server/inference/language";
import { parse as parsePartialJson, Allow } from "partial-json";
import { z } from "zod";
import type { ConfiguredModelId } from "@/lib/model-config";
import {
  resolveAutonomousThinkingParams,
  type HomerReasoningEffort,
} from "@/lib/model-effort";
import { DEFAULT_CHAT_MODEL_ID } from "@/lib/model-catalog";
import OpenAI from "openai";
import { productionDeps, type QueryDeps } from "@/server/agent-core/query/deps";
import {
  captureOpenAIOutputItems,
  toolResultPart,
  type TranscriptAgentModelTurn,
} from "@/server/training/transcript-format";
/** Single autonomous step budget. The model decides how many steps it needs. */
const MAX_STEPS = 24;

/** Sidebar title tags must never reach the visible answer. */
const CHAT_TITLE_BLOCK_RE = /<chat_title>[\s\S]*?<\/chat_title>/gi;
const CHAT_TITLE_TAG_RE = /<\/?chat_title>/gi;

function stripChatTitleMarkup(text: string): string {
  return text
    .replace(CHAT_TITLE_BLOCK_RE, "")
    .replace(CHAT_TITLE_TAG_RE, "")
    .trimStart();
}

// ── Zod schemas for autonomous tools (self-healing validation) ──────────────

const autonomousZodByName: Record<string, z.ZodTypeAny> = {
  read_skill: z.object({
    skill_id: z.string(),
  }),
  web_search: z.object({
    query: z.string(),
  }),
  web_fetch: z.object({
    url: z.string(),
  }),
  execute_code: z.object({
    code: z.string(),
    description: z.string(),
    output_paths: z.array(z.string()).default([]),
  }),
  bash_tool: z.object({
    command: z.string(),
    description: z.string(),
    output_paths: z.array(z.string()).default([]),
  }),
  weather_fetch: z.object({
    location_name: z.string(),
    units: z.enum(["metric", "imperial"]).optional(),
  }),
  places_search: z.object({
    query: z.string(),
    max_results: z.number().optional(),
  }),
  image_search: z.object({
    query: z.string(),
    max_results: z.number().optional(),
  }),
  file_read: z.object({
    path: z.string(),
  }),
  create_file: z.object({
    path: z.string(),
    content: z.string(),
    description: z.string().optional(),
  }),
  file_write: z.object({
    path: z.string(),
    content: z.string(),
    description: z.string().optional(),
  }),
  ask_user_input_v0: z.object({
    questions: z
      .array(
        z.object({
          question: z.string(),
          options: z.array(z.string()).min(2).max(4),
          type: z
            .enum(["single_select", "multi_select", "rank_priorities"])
            .optional(),
        }),
      )
      .min(1)
      .max(3),
  }),
  create_scheduled_task: z.object({
    name: z.string(),
    requirement: z.string(),
    frequency: z.enum(["once", "daily", "weekly", "monthly"]),
    time_local: z.string(),
    timezone: z.string(),
    run_date: z.union([z.string(), z.null()]).optional(),
    day_of_week: z.union([z.number(), z.null()]).optional(),
    day_of_month: z.union([z.number(), z.null()]).optional(),
    expires_at: z.union([z.string(), z.null()]).optional(),
  }),
  list_scheduled_tasks: z.object({
    include_completed: z.boolean().optional(),
  }),
  cancel_scheduled_task: z.object({
    task_id: z.string(),
  }),
};

type ArtifactRecord = {
  id?: unknown;
  path?: unknown;
  content?: unknown;
  fileId?: unknown;
  storagePath?: unknown;
  mimeType?: unknown;
  sizeBytes?: unknown;
  description?: unknown;
};

function emitArtifactRecord(
  sse: ClauxenSseStream,
  artifact: ArtifactRecord,
  fallbackPath?: string,
  fallbackContent?: string,
  description?: string,
) {
  const path =
    (typeof artifact.path === "string" && artifact.path) || fallbackPath || "";
  const content =
    (typeof artifact.content === "string" && artifact.content) ||
    fallbackContent ||
    "";
  const fileId =
    typeof artifact.fileId === "string" ? artifact.fileId : undefined;
  if (!path || (!content && !fileId)) return;
  sse.writeArtifact({
    artifactId:
      (typeof artifact.id === "string" && artifact.id) || fileId || path,
    path,
    content,
    language: inferLanguage(path),
    description:
      typeof description === "string"
        ? description
        : typeof artifact.description === "string"
          ? artifact.description
          : undefined,
    fileId,
    storagePath:
      typeof artifact.storagePath === "string"
        ? artifact.storagePath
        : undefined,
    mimeType:
      typeof artifact.mimeType === "string" ? artifact.mimeType : undefined,
    sizeBytes:
      typeof artifact.sizeBytes === "number" ? artifact.sizeBytes : undefined,
  });
}

/** Present direct text files and sandbox-produced binary/text deliverables. */
function emitToolArtifacts(
  sse: ClauxenSseStream,
  output: unknown,
  fallbackPath?: string,
  fallbackContent?: string,
  description?: string,
) {
  if (!output || typeof output !== "object") return;
  const record = output as ArtifactRecord & { artifacts?: unknown };
  if (Array.isArray(record.artifacts)) {
    for (const artifact of record.artifacts) {
      if (artifact && typeof artifact === "object") {
        emitArtifactRecord(
          sse,
          artifact as ArtifactRecord,
          undefined,
          undefined,
          description,
        );
      }
    }
    return;
  }
  emitArtifactRecord(sse, record, fallbackPath, fallbackContent, description);
}

/** Build self-healing tool definitions for built-in autonomous tools. */
function buildHealingTools(): Map<string, ToolDefinition> {
  const map = new Map<string, ToolDefinition>();
  for (const def of autonomousAgentTools) {
    const schema = autonomousZodByName[def.name];
    if (!schema) continue;
    map.set(def.name, {
      name: def.name,
      description: def.description ?? def.name,
      inputSchema: schema,
      execute: async (input, ctx) => {
        return executeAutonomousTool(def.name, input, {
          conversationId: ctx.conversationId ?? "chat",
          userId: ctx.userId,
          userCountryCode: ctx.userCountryCode,
          toolCallId: ctx.toolCallId,
          onToolProgress: ctx.onProgress,
        });
      },
    });
  }
  return map;
}

/** Persisted tool plan/results. An uncertain side effect is never replayed. */
export type AgentPendingToolRound = {
  step: number;
  calls: Array<{ id: string; name: string; arguments: string }>;
  executingCallId?: string;
  results: Record<string, { output: unknown; pause: boolean }>;
  modelOutput?: OpenAIOutputItem[];
  reason?: string;
  startedAtMs: number;
};

export type AgentStreamOptions = {
  messages: Array<{
    role: string;
    content: OpenAIMessageContent;
  }>;
  model: string;
  chatModelId?: ConfiguredModelId;
  homerReasoningEffort?: HomerReasoningEffort;
  /** User preference from composer + menu; when false, extended thinking is off. */
  thinkingEnabled?: boolean;
  userId?: string;
  conversationId?: string;
  userCountryCode?: string;
  signal?: AbortSignal;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  /** Fired when ask_user_input pauses the loop — release generation lease early. */
  onPauseForUser?: () => void | Promise<void>;
  /** Captures exact Responses API rounds for durable replay/training. */
  onModelTurn?: (turn: TranscriptAgentModelTurn) => void;
  /** Injectable OpenAI Responses dependency (production by default). */
  deps?: QueryDeps;
  /** When true, caller already emitted SSE `start` (early TTFT). */
  skipWriteStart?: boolean;
  // ── Durable slices: resume a turn past the serverless time cap ──────────
  /** Restored Responses input list (prior rounds) when resuming a slice. */
  initialConversation?: OpenAIInputItem[];
  /** Agent step index to continue from (0-based). */
  startStep?: number;
  /** Narration counter so resumed segment ids stay unique. */
  initialNarrationCounter?: number;
  /**
   * Slice budget guard. Checked at round boundaries and before each tool.
   * When true, the loop stops after the current round and reports `yielded`
   * so the runner can checkpoint and chain the next slice.
   */
  shouldYield?: () => boolean;
  /**
   * Aborted by the runner at the hard slice deadline. Aborts only the
   * in-flight model stream (unlike `signal`, which is an explicit user stop).
   * A yield-aborted round has no side effects and is simply re-run.
   */
  yieldSignal?: AbortSignal;
  /** Fired after every completed round with the state a resume needs. */
  onRoundEnd?: (round: {
    /** Next step index to run. */
    step: number;
    conversation: OpenAIInputItem[];
    narrationCounter: number;
    /** Tool calls completed this round (empty on final/text rounds). */
    toolCallIds: string[];
    terminalOutcome?: "done" | "paused";
  }) => void | Promise<void>;
  initialPendingToolRound?: AgentPendingToolRound;
  initialTerminalOutcome?: "done" | "paused";
  beforeTool?: () => Promise<void>;
  onToolRoundState?: (
    conversation: OpenAIInputItem[],
    pending: AgentPendingToolRound,
  ) => Promise<void>;
  /** Outcome holder the caller reads after the stream finishes. */
  loopResult?: { outcome: AgentLoopOutcome };
};

export type AgentLoopOutcome =
  | "done"
  | "yielded"
  | "aborted"
  | "paused"
  | "error";

function resolveThinkingBudget(options: AgentStreamOptions): number {
  // Composer Thinking toggle is authoritative (default off).
  const thinking = resolveAutonomousThinkingParams({
    chatModel: options.chatModelId ?? DEFAULT_CHAT_MODEL_ID,
    thinkingEnabled: options.thinkingEnabled === true,
    homerReasoningEffort: options.homerReasoningEffort,
  });
  if (!thinking.enabled) return 0;
  const effort = String(thinking.effort ?? "high");
  switch (effort) {
    case "low":
      return 2_048;
    case "medium":
      return 5_120;
    case "max":
    case "high":
    default:
      return 10_240;
  }
}

type PendingToolCall = {
  id: string;
  name: string;
  arguments: string;
};

/**
 * Run the autonomous agent loop, streaming protocol events to the UI.
 *
 * Durable slices: when `shouldYield`/`yieldSignal` are provided, the loop can
 * stop at a round boundary (or mid-stream at the hard deadline) and report
 * `yielded` via `loopResult`. The caller checkpoints and chains the next
 * slice, which resumes with `initialConversation`/`startStep`.
 */
export async function runAutonomousAgent(
  sse: ClauxenSseStream,
  options: AgentStreamOptions,
): Promise<AgentLoopOutcome> {
  const {
    messages: rawMessages,
    userId,
    conversationId,
    userCountryCode,
    signal,
    systemPrompt: initialSystemPrompt,
    maxTokens,
    onPauseForUser,
  } = options;

  const deps = options.deps ?? productionDeps();
  const healingTools = buildHealingTools();
  const thinkingBudget = resolveThinkingBudget(options);
  const shouldYield = options.shouldYield;
  const yieldSignal = options.yieldSignal;
  const onRoundEnd = options.onRoundEnd;
  const loopResult = options.loopResult;
  let outcome: AgentLoopOutcome = "done";
  const finish = (next: AgentLoopOutcome): AgentLoopOutcome => {
    outcome = next;
    if (loopResult) loopResult.outcome = next;
    return next;
  };

  if (!options.skipWriteStart) {
    sse.writeStart(true);
  }

  const systemPrompt = initialSystemPrompt;

  // Connected-plugin MCP tools (mcp__<slug>__<tool>) are appended to the
  // built-in catalog so the assistant can use every plugin the user has
  // authorized from the marketplace.
  const mcpAgentTools = userId
    ? await buildAgentMcpTools(userId).catch(() => [])
    : [];

  const openAITools = toOpenAITools([
    ...autonomousAgentTools
      // present_files removed — create_file auto-presents to the user.
      .filter((tool) => tool.name !== "present_files")
      .map((tool) => ({
        name: tool.name,
        description: tool.description ?? tool.name,
        parameters: (tool.parameters ?? {
          type: "object",
          properties: {},
        }) as Record<string, unknown>,
      })),
    ...mcpAgentTools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    })),
  ]);

  // Responses API input is an ordered list of user/assistant messages plus
  // native function_call/function_call_output items from agent rounds.
  const conversation: OpenAIInputItem[] =
    options.initialConversation && options.initialConversation.length > 0
      ? // Deep copy: the loop mutates this list and must never mutate the
        // stored checkpoint it was restored from.
        (JSON.parse(
          JSON.stringify(options.initialConversation),
        ) as OpenAIInputItem[])
      : rawMessages
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map(
            (m) =>
              ({
                role: m.role as "user" | "assistant",
                content: m.content,
              }) as OpenAIInputItem,
          );

  let narrationCounter = options.initialNarrationCounter ?? 0;
  const startStep = Math.max(0, options.startStep ?? 0);

  const snapshotConversation = (): OpenAIInputItem[] =>
    JSON.parse(JSON.stringify(conversation)) as OpenAIInputItem[];

  const reportRoundEnd = async (
    nextStep: number,
    toolCallIds: string[] = [],
    terminalOutcome?: "done" | "paused",
  ): Promise<void> => {
    if (!onRoundEnd) return;
    await onRoundEnd({
      step: nextStep,
      conversation: snapshotConversation(),
      narrationCounter,
      toolCallIds,
      terminalOutcome,
    });
  };
  let activeNarrationId: string | null = null;
  let activeThinkingId: string | null = null;

  const closeNarration = () => {
    if (!activeNarrationId) return;
    sse.writeSegmentEnd(activeNarrationId, "narration");
    activeNarrationId = null;
  };

  const closeThinking = () => {
    if (!activeThinkingId) return;
    sse.writeThinkingEnd(activeThinkingId);
    activeThinkingId = null;
  };

  const ensureNarration = (): string => {
    if (activeNarrationId) return activeNarrationId;
    narrationCounter += 1;
    activeNarrationId = `narration-${narrationCounter}`;
    sse.writeSegmentStart(activeNarrationId, "narration");
    return activeNarrationId;
  };

  const ensureThinking = (): string => {
    if (activeThinkingId) return activeThinkingId;
    narrationCounter += 1;
    activeThinkingId = `thinking-${Date.now()}-${narrationCounter}`;
    sse.writeSegmentStart(activeThinkingId, "thinking");
    sse.writeThinkingStart(activeThinkingId);
    return activeThinkingId;
  };

  try {
    if (options.initialTerminalOutcome)
      return finish(options.initialTerminalOutcome);
    for (let step = startStep; step < MAX_STEPS; step++) {
      if (signal?.aborted) {
        sse.writeError("Generation aborted.");
        return finish("aborted");
      }
      if (yieldSignal?.aborted || shouldYield?.()) {
        // Slice budget spent before this round started. Nothing in this
        // round has run, so the resume simply re-runs it.
        closeThinking();
        closeNarration();
        return finish("yielded");
      }

      const recoveringRound =
        step === startStep ? options.initialPendingToolRound : undefined;
      if (recoveringRound?.executingCallId) {
        throw new Error(
          "A server interrupted a tool while it was executing. Its external result is uncertain, so the task stopped to avoid repeating that action.",
        );
      }
      const modelTurnStartedAtMs = recoveringRound?.startedAtMs ?? Date.now();
      const pendingToolCalls: PendingToolCall[] = [
        ...(recoveringRound?.calls ?? []),
      ];
      const toolCallBuffers = new Map<
        string,
        { name: string; argsBuffer: string }
      >();
      let roundText = "";
      let roundNarrationId: string | null = null;
      let finished:
        | {
            reason: string;
            output: OpenAIOutputItem[];
            replay: OpenAIInputItem[];
          }
        | undefined;

      // The yield signal aborts only this model stream (hard slice deadline).
      // An explicit user stop still arrives on `signal` and stays terminal.
      const roundSignals = [signal, yieldSignal].filter(
        (candidate): candidate is AbortSignal => Boolean(candidate),
      );
      const roundSignal =
        roundSignals.length > 1
          ? AbortSignal.any(roundSignals)
          : (roundSignals[0] ?? undefined);

      if (!recoveringRound) {
        const stream = deps.callModel({
          model: options.model,
          instructions: systemPrompt,
          input: conversation,
          tools: openAITools.length > 0 ? openAITools : undefined,
          maxOutputTokens: maxTokens ?? 8192,
          reasoningEffort:
            thinkingBudget >= 10_000
              ? "high"
              : thinkingBudget >= 5_000
                ? "medium"
                : thinkingBudget > 0
                  ? "low"
                  : undefined,
          signal: roundSignal,
        });

        for await (const part of stream) {
          switch (part.type) {
            case "reasoning-delta": {
              if (!part.delta || thinkingBudget <= 0) break;
              const thinkingId = ensureThinking();
              sse.writeThinkingDelta(part.delta, thinkingId);
              break;
            }

            case "text-delta": {
              const visible = sanitizeAssistantStreamDelta(part.delta);
              if (!visible) break;
              closeThinking();
              const segmentId = ensureNarration();
              roundNarrationId = segmentId;
              roundText += visible;
              sse.writeNarrationDelta(segmentId, visible);
              break;
            }

            case "tool-call-start":
              closeThinking();
              // Pre-tool prose stays as narration — close it before the tool row.
              closeNarration();
              sse.writeToolStart(
                part.toolCallId,
                part.toolName,
                undefined,
                undefined,
                false,
              );
              toolCallBuffers.set(part.toolCallId, {
                name: part.toolName,
                argsBuffer: "",
              });
              break;

            case "tool-call-delta": {
              const entry = toolCallBuffers.get(part.toolCallId) ?? {
                name: "",
                argsBuffer: "",
              };
              entry.argsBuffer += part.argumentsDelta;
              toolCallBuffers.set(part.toolCallId, entry);
              const preview = previewToolArgs(entry.argsBuffer);
              if (entry.name && Object.keys(preview).length > 0) {
                const dynamicDescription =
                  typeof preview.description === "string"
                    ? preview.description
                    : undefined;
                sse.writeToolStart(
                  part.toolCallId,
                  entry.name,
                  preview,
                  dynamicDescription,
                  false,
                );
              }
              break;
            }

            case "tool-call-end":
              pendingToolCalls.push({
                id: part.toolCallId,
                name: part.toolName,
                arguments: part.arguments,
              });
              break;

            case "finish":
              finished = {
                reason: part.reason,
                output: part.output,
                replay: part.replay,
              };
              break;

            case "error":
              console.error("[chat] model stream error:", part.error);
              sse.writeError(part.error);
              return finish("error");

            case "abort":
              if (!signal?.aborted && yieldSignal?.aborted) {
                // Hard slice deadline hit mid-stream. This round issued
                // nothing durable yet, so the next slice re-runs it cleanly.
                closeThinking();
                closeNarration();
                return finish("yielded");
              }
              sse.writeError("Generation aborted.");
              return finish("aborted");
          }
        }
      } else {
        finished = {
          reason: recoveringRound.reason ?? "tool_calls",
          output: recoveringRound.modelOutput ?? [],
          replay: [],
        };
      }

      // A yield that landed between stream end and round handling still stops
      // here: no tool has executed, so re-running this round is side-effect
      // free. (An explicit stop keeps priority and stays terminal.)
      if (!signal?.aborted && (yieldSignal?.aborted || shouldYield?.())) {
        closeThinking();
        closeNarration();
        return finish("yielded");
      }

      closeThinking();
      closeNarration();
      const assistantCompletedAtMs = Date.now();

      // ── Final round: no tool calls → promote the text to the answer. ──
      if (pendingToolCalls.length === 0) {
        const finalText = stripChatTitleMarkup(roundText).trim();
        if (finalText) {
          sse.writeAnswerFinalize(roundNarrationId ?? undefined, finalText);
        }
        if (finished) {
          try {
            options.onModelTurn?.({
              stopReason: finished.reason,
              startedAtMs: modelTurnStartedAtMs,
              assistantCompletedAtMs,
              completedAtMs: assistantCompletedAtMs,
              assistant: captureOpenAIOutputItems(finished.output),
            });
          } catch {
            // Transcript capture must never break the visible response.
          }
        }
        await reportRoundEnd(step + 1, [], "done");
        break;
      }

      // ── Tool round: the round's text stays as narration; execute tools. ──
      if (recoveringRound) {
        // The persisted conversation already includes this round's tool plan.
      } else if (!finished || finished.replay.length === 0) {
        if (pendingToolCalls.length === 0) {
          const finalText = stripChatTitleMarkup(roundText).trim();
          if (finalText) {
            sse.writeAnswerFinalize(roundNarrationId ?? undefined, finalText);
          }
          break;
        }
        conversation.push({
          role: "assistant",
          content: roundText.trim() || null,
          tool_calls: pendingToolCalls.map((call) => ({
            id: call.id,
            type: "function" as const,
            function: {
              name: call.name,
              arguments: call.arguments || "{}",
            },
          })),
        });
      } else {
        conversation.push(...finished.replay);
      }

      const durableRound: AgentPendingToolRound = recoveringRound ?? {
        step,
        calls: pendingToolCalls,
        results: {},
        modelOutput: finished?.output,
        reason: finished?.reason,
        startedAtMs: modelTurnStartedAtMs,
      };
      await options.onToolRoundState?.(snapshotConversation(), durableRound);
      let pauseForUser = false;
      const toolResults: Array<{
        toolCallId: string;
        name: string;
        result: string;
        isError: boolean;
        imageFileId: string | null;
        imageName: string;
      }> = [];

      // Sequential execution: the sandbox is stateful and the UI reads top-down.
      for (const tc of pendingToolCalls) {
        if (signal?.aborted) break;
        const rawArgs = safeParseJson(tc.arguments);
        sse.writeToolStart(
          tc.id,
          tc.name,
          rawArgs,
          typeof rawArgs.description === "string"
            ? rawArgs.description
            : undefined,
          true,
        );

        let outcomeOutput: unknown;
        let outcomePause = false;

        const savedResult = durableRound.results[tc.id];
        if (savedResult) {
          outcomeOutput = savedResult.output;
          outcomePause = savedResult.pause;
        } else {
          // Check ownership and journal intent before any external side effect.
          await options.beforeTool?.();
          durableRound.executingCallId = tc.id;
          await options.onToolRoundState?.(
            snapshotConversation(),
            durableRound,
          );

          // Connected-plugin tools run through the MCP runtime rather than the
          // built-in autonomous catalog. The name carries the plugin slug and
          // the remote tool, e.g. mcp__gmail__search_emails.
          const mcpTarget =
            tc.name.startsWith("mcp__") && userId
              ? await resolveMcpToolCall(userId, tc.name, rawArgs)
              : null;

          if (mcpTarget) {
            const mcpOutcome = await executeMcpToolCall(mcpTarget);
            outcomeOutput = {
              plugin: mcpOutcome.pluginName,
              tool: mcpTarget.toolName,
              output: mcpOutcome.output,
              ...(mcpOutcome.isError ? { error: true } : {}),
            };
          } else {
            const healingTool = healingTools.get(tc.name);

            if (healingTool) {
              const ctx: ToolExecutionContext = {
                userId,
                conversationId: conversationId ?? "chat",
                userCountryCode,
                toolCallId: tc.id,
                modelId: options.model,
                onProgress: (data) => {
                  if (tc.name === "web_search") {
                    sse.writeToolData(tc.id, { ...data, tool_call_id: tc.id });
                  } else if (
                    (tc.name === "bash_tool" || tc.name === "execute_code") &&
                    (data.kind === "stdout" || data.kind === "stderr") &&
                    typeof data.delta === "string"
                  ) {
                    sse.writeToolOutputDelta(tc.id, data.kind, data.delta);
                  }
                },
              };
              const healed = healToolArgs(rawArgs, healingTool.inputSchema);
              const result = await executeToolSafely(
                healingTool,
                healed ?? rawArgs,
                ctx,
              );
              outcomeOutput = result.output;
              outcomePause = result.pauseForUser === true;
            } else {
              try {
                const outcome = await executeAutonomousTool(tc.name, rawArgs, {
                  conversationId: conversationId ?? "chat",
                  userId,
                  userCountryCode,
                  toolCallId: tc.id,
                  modelId: options.model,
                  onToolProgress: (data) => {
                    if (tc.name === "web_search") {
                      sse.writeToolData(tc.id, {
                        ...data,
                        tool_call_id: tc.id,
                      });
                    }
                  },
                });
                outcomeOutput = outcome.output;
                outcomePause = outcome.pauseForUser === true;
              } catch (error) {
                outcomeOutput = {
                  error: error instanceof Error ? error.message : String(error),
                };
              }
            }
          }

          durableRound.results[tc.id] = {
            output: outcomeOutput ?? {},
            pause: outcomePause,
          };
          delete durableRound.executingCallId;
          // Save the result before the next tool can start. On recovery it is replayed.
          await options.onToolRoundState?.(
            snapshotConversation(),
            durableRound,
          );
        }

        // Streamed search hits for the results card.
        if (
          tc.name === "web_search" &&
          outcomeOutput &&
          typeof outcomeOutput === "object"
        ) {
          const output = outcomeOutput as Record<string, unknown>;
          if (Array.isArray(output.results)) {
            sse.writeToolData(tc.id, {
              tool_call_id: tc.id,
              query: output.query,
              results: output.results,
            });
          }
        }

        // Direct writes and sandbox output paths become artifact cards immediately.
        if (
          (tc.name === "create_file" ||
            tc.name === "file_write" ||
            tc.name === "bash_tool" ||
            tc.name === "execute_code") &&
          outcomeOutput &&
          typeof outcomeOutput === "object"
        ) {
          emitToolArtifacts(
            sse,
            outcomeOutput,
            typeof rawArgs.path === "string" ? rawArgs.path : undefined,
            typeof rawArgs.content === "string" ? rawArgs.content : undefined,
            typeof rawArgs.description === "string"
              ? rawArgs.description
              : undefined,
          );
        }

        const resultStr =
          typeof outcomeOutput === "string"
            ? outcomeOutput
            : JSON.stringify(outcomeOutput ?? {});
        const isError = isToolErrorOutput(outcomeOutput);
        const imageFileId =
          outcomeOutput &&
          typeof outcomeOutput === "object" &&
          (outcomeOutput as { kind?: string }).kind === "image" &&
          typeof (outcomeOutput as { fileId?: string }).fileId === "string"
            ? (outcomeOutput as { fileId: string; name?: string }).fileId
            : null;
        const imageName =
          imageFileId &&
          typeof (outcomeOutput as { name?: string }).name === "string"
            ? (outcomeOutput as { name: string }).name
            : "image";

        if (outcomePause || tc.name === "ask_user_input_v0") {
          pauseForUser = true;
        }

        sse.writeToolEnd(tc.id, tc.name, resultStr, isError);
        toolResults.push({
          toolCallId: tc.id,
          name: tc.name,
          result: resultStr,
          isError,
          imageFileId,
          imageName,
        });
      }

      for (const result of toolResults) {
        conversation.push({
          role: "tool",
          tool_call_id: result.toolCallId,
          content: result.result,
        });
      }

      if (userId) {
        const { resolveVisionImageBlocks } =
          await import("@/server/inference/vision-attachments");
        for (const result of toolResults) {
          if (!result.imageFileId) continue;
          const blocks = await resolveVisionImageBlocks({
            userId,
            fileIds: [result.imageFileId],
          });
          if (!blocks.length) continue;
          conversation.push({
            role: "user",
            content: [
              {
                type: "text",
                text: `View of ${result.imageName}. This image is only for the current question.`,
              },
              ...blocks,
            ],
          });
        }
      }

      try {
        options.onModelTurn?.({
          stopReason: finished?.reason ?? "tool_calls",
          startedAtMs: modelTurnStartedAtMs,
          assistantCompletedAtMs,
          completedAtMs: Date.now(),
          assistant: captureOpenAIOutputItems(finished?.output ?? []),
          toolResults: toolResults.map((result) =>
            toolResultPart(result.toolCallId, result.result, result.isError),
          ),
        });
      } catch {
        // Transcript capture must never break the visible response.
      }

      // Round fully complete (tool results are in the conversation). This is
      // the durable resume point: checkpoint first, then decide to continue
      // or yield the slice.
      await reportRoundEnd(
        step + 1,
        toolResults.map((result) => result.toolCallId),
        pauseForUser ? "paused" : undefined,
      );

      if (pauseForUser) {
        try {
          await onPauseForUser?.();
        } catch {
          // Lease release is best-effort; stream still completes.
        }
        finish("paused");
        break;
      }

      if (!signal?.aborted && (yieldSignal?.aborted || shouldYield?.())) {
        return finish("yielded");
      }
    }
    return finish(outcome);
  } catch (error) {
    // A yield racing the loop machinery must never surface as an error.
    if (!signal?.aborted && yieldSignal?.aborted) {
      return finish("yielded");
    }
    const aborted =
      signal?.aborted ||
      (error instanceof Error &&
        (error.name === "AbortError" ||
          error.name === "ResponseAborted" ||
          /aborted/i.test(error.message)));

    if (aborted) {
      sse.writeError("Generation aborted.");
      return finish("aborted");
    }

    const message = error instanceof Error ? error.message : String(error);
    sse.writeError(message);
    return finish("error");
  } finally {
    sse.writeDone();
    sse.finalize();
  }
}

/** Generate a chat title using a non-streaming completion. */
export async function generateChatTitle(
  messages: Array<{ role: string; content: string }>,
  signal?: AbortSignal,
): Promise<string> {
  const userContent =
    messages.find((m) => m.role === "user")?.content?.trim() ?? "";
  const assistantContent =
    messages.find((m) => m.role === "assistant")?.content?.trim() ?? "";

  if (!userContent) return "New Chat";

  try {
    const client = new OpenAI({
      apiKey: requireOpenAIApiKey(),
      ...(optionalOpenAIBaseUrl() ? { baseURL: optionalOpenAIBaseUrl() } : {}),
    });
    const response = await client.chat.completions.create(
      {
        model: optionsModelForTitle(),
        max_tokens: 80,
        messages: [
          {
            role: "system",
            content:
              "You write short conversation titles for a chat sidebar. Output ONLY the title (3-6 words). No quotes or labels.",
          },
          {
            role: "user",
            content: [
              userContent ? `User: ${userContent.slice(0, 500)}` : "",
              assistantContent
                ? `Assistant: ${assistantContent.slice(0, 500)}`
                : "",
            ]
              .filter(Boolean)
              .join("\n"),
          },
        ],
      },
      { signal },
    );
    const text = response.choices[0]?.message.content?.trim() ?? "";
    return text.slice(0, 80) || userContent.slice(0, 50).trim();
  } catch {
    return userContent.slice(0, 50).trim();
  }
}

function optionsModelForTitle(): string {
  return env.heliosModel || env.defaultModel || "gpt-5.6";
}

function safeParseJson(raw: string): Record<string, unknown> {
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function isToolErrorOutput(output: unknown): boolean {
  return Boolean(
    output &&
    typeof output === "object" &&
    !Array.isArray(output) &&
    typeof (output as { error?: unknown }).error === "string",
  );
}

/** Best-effort parse of a still-streaming tool-call arguments buffer. */
function previewToolArgs(buffer: string): Record<string, unknown> {
  if (!buffer.trim()) return {};
  try {
    return JSON.parse(buffer) as Record<string, unknown>;
  } catch {
    try {
      return parsePartialJson(buffer, Allow.ALL) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
}
