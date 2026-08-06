/**
 * Clauxen autonomous agent loop (OpenAI Responses API).
 *
 * Round lifecycle:
 *   1. Stream one model round: reasoning → narration → strict function calls.
 *   2. Every text delta streams live as a narration segment — visible progress.
 *   3. Tool calls close the round's text segment; tools execute sequentially.
 *   4. tool_result blocks go back; next round starts.
 *   5. A round with no tool calls ends the turn: its text is promoted to the
 *      durable answer via answer_finalize (in place — no answer teleporting).
 *
 * No tag parsing anywhere: narration vs answer is decided structurally by
 * whether the round made tool calls.
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
import { McpConnectorHarness } from "@/server/mcp/registry";
import { listMcpServers } from "@/server/mcp/types";

/** Cap MCP discovery so a hung connector cannot delay first token. */
const MCP_DISCOVER_BUDGET_MS = 200;

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

function isMcpToolName(name: string): boolean {
  return name.startsWith("mcp__");
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
};

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

function textArg(args: Record<string, unknown>, key: string): string {
  const value = args[key];
  return typeof value === "string" ? value.trim() : "";
}

function conciseDetail(value: string, maxLength = 120): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

/** Safe, concrete narration when a model calls a tool without explaining it. */
function describeToolIntent(
  name: string,
  args: Record<string, unknown>,
): string {
  const description = conciseDetail(textArg(args, "description"));
  const path = conciseDetail(textArg(args, "path"));

  switch (name) {
    case "web_search": {
      const query = conciseDetail(textArg(args, "query"), 90);
      return query
        ? `I’m searching the web for “${query}”.`
        : "I’m searching the web for reliable sources.";
    }
    case "web_fetch": {
      const rawUrl = textArg(args, "url");
      let host = "the selected page";
      try {
        host = new URL(rawUrl).hostname.replace(/^www\./, "") || host;
      } catch {
        // Use the generic description for an incomplete streamed URL.
      }
      return `I’m reading ${host} for the relevant details.`;
    }
    case "bash_tool":
      return description
        ? `I’m checking the workspace: ${description}.`
        : "I’m checking the workspace and validating the next step.";
    case "execute_code":
      return description
        ? `I’m running an analysis: ${description}.`
        : "I’m running an analysis to verify the result.";
    case "file_read":
      return path
        ? `I’m reviewing ${path}.`
        : "I’m reviewing the requested file.";
    case "create_file":
      return path
        ? `I’m preparing ${path}.`
        : "I’m preparing the requested file.";
    case "file_write":
      return path
        ? `I’m updating ${path}.`
        : "I’m updating the requested file.";
    case "read_skill":
      return "I’m loading the relevant workspace guidance before continuing.";
    case "image_search":
      return "I’m finding suitable images for this task.";
    case "places_search":
      return "I’m looking up the relevant places and location details.";
    case "weather_fetch":
      return "I’m checking the latest weather conditions.";
    case "ask_user_input_v0":
      return "I need one quick decision before I can continue.";
    default:
      return name.startsWith("mcp__")
        ? "I’m using the connected service to complete the next step."
        : "I’m carrying out the next verified step.";
  }
}

/** Brief result handoff so the visible timeline has a useful bridge to the next action. */
function describeToolOutcome(
  name: string,
  args: Record<string, unknown>,
  result: string,
  isError: boolean,
): string {
  if (isError) {
    return "That step ran into an issue. I’m using the result to adjust the next action.";
  }

  if (name === "web_search") {
    const parsed = safeParseJson(result);
    const results = Array.isArray(parsed.results) ? parsed.results.length : 0;
    return results > 0
      ? `I found ${results} relevant source${results === 1 ? "" : "s"}; I’m checking the strongest evidence next.`
      : "The search is complete; I’m checking the available evidence next.";
  }

  if (name === "web_fetch") {
    return "I have the page content and I’m checking it against the request.";
  }

  if (name === "file_read") {
    const path = conciseDetail(textArg(args, "path"));
    return path
      ? `I’ve reviewed ${path} and I’m using it for the next step.`
      : "I’ve reviewed the file and I’m using it for the next step.";
  }

  if (name === "create_file" || name === "file_write") {
    const path = conciseDetail(textArg(args, "path"));
    return path
      ? `${path} is ready; I’m verifying the remaining work.`
      : "The file update is ready; I’m verifying the remaining work.";
  }

  if (name === "bash_tool" || name === "execute_code") {
    return "That check completed; I’m using the output to decide the next verified action.";
  }

  return "That step completed; I’m using the result to continue.";
}

/**
 * Run the autonomous agent loop, streaming protocol events to the UI.
 */
export async function runAutonomousAgent(
  sse: ClauxenSseStream,
  options: AgentStreamOptions,
): Promise<void> {
  const {
    messages: rawMessages,
    userId,
    conversationId,
    userCountryCode,
    signal,
    systemPrompt,
    maxTokens,
    onPauseForUser,
  } = options;

  const deps = options.deps ?? productionDeps();
  const healingTools = buildHealingTools();
  const thinkingBudget = resolveThinkingBudget(options);

  // Signal the client immediately — do not wait on MCP discovery for UI start.
  if (!options.skipWriteStart) {
    sse.writeStart(true);
  }

  // MCP connectors: discover with a hard budget so unreachable servers never
  // sit on the TTFT critical path (listTools defaults to a 20s fetch timeout).
  // Run discovery in parallel with the first model call setup by not awaiting
  // beyond the budget — empty catalog skips entirely.
  const mcp = new McpConnectorHarness();
  let mcpTools: Awaited<ReturnType<McpConnectorHarness["discover"]>> = [];
  if (listMcpServers().length > 0) {
    try {
      mcpTools = await Promise.race([
        mcp.discover(),
        new Promise<typeof mcpTools>((resolve) => {
          setTimeout(() => resolve([]), MCP_DISCOVER_BUDGET_MS);
        }),
      ]);
    } catch {
      mcpTools = [];
    }
  }

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
    ...mcpTools.map((tool) => ({
      name: tool.qualifiedName,
      description: tool.description,
      parameters: tool.inputSchema,
    })),
  ]);

  // Responses API input is an ordered list of user/assistant messages plus
  // native function_call/function_call_output items from agent rounds.
  const conversation: OpenAIInputItem[] = rawMessages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map(
      (m) =>
        ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }) as OpenAIInputItem,
    );

  // One activity frame for the entire assistant turn.
  const frameId = "agent-frame-1";
  let frameOpen = false;
  let narrationCounter = 0;
  let thinkingCounter = 0;
  let activeNarrationId: string | null = null;
  let activeThinkingId: string | null = null;

  const openFrame = () => {
    if (frameOpen) return;
    sse.writeFrameStart(frameId);
    frameOpen = true;
  };

  const closeNarration = () => {
    if (!activeNarrationId) return;
    sse.writeSegmentEnd(activeNarrationId, "narration");
    activeNarrationId = null;
  };

  const closeThinking = () => {
    if (!activeThinkingId) return;
    sse.writeThinkingEnd(activeThinkingId);
    sse.writeSegmentEnd(activeThinkingId, "thinking");
    activeThinkingId = null;
  };

  const closeFrame = () => {
    closeNarration();
    closeThinking();
    if (!frameOpen) return;
    sse.writeFrameComplete(frameId);
    frameOpen = false;
  };

  const ensureNarration = (): string => {
    if (activeNarrationId) return activeNarrationId;
    narrationCounter += 1;
    activeNarrationId = `${frameId}-narration-${narrationCounter}`;
    openFrame();
    sse.writeSegmentStart(activeNarrationId, "narration");
    return activeNarrationId;
  };

  const ensureThinking = (): string => {
    if (activeThinkingId) return activeThinkingId;
    thinkingCounter += 1;
    activeThinkingId = `${frameId}-thinking-${thinkingCounter}`;
    openFrame();
    sse.writeSegmentStart(activeThinkingId, "thinking");
    sse.writeThinkingStart();
    return activeThinkingId;
  };

  const writeActivityNarration = (text: string) => {
    if (!text.trim()) return;
    closeNarration();
    const segmentId = ensureNarration();
    sse.writeNarrationDelta(segmentId, text);
    closeNarration();
  };

  try {
    for (let step = 0; step < MAX_STEPS; step++) {
      if (signal?.aborted) {
        closeFrame();
        sse.writeError("Generation aborted.");
        return;
      }

      const modelTurnStartedAtMs = Date.now();
      const pendingToolCalls: PendingToolCall[] = [];
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
        signal,
      });

      for await (const part of stream) {
        switch (part.type) {
          case "reasoning-delta": {
            if (!part.delta || thinkingBudget <= 0) break;
            // Open the thinking segment so the orb/timeline is live while the
            // model reasons — do not dump private CoT into the transcript.
            ensureThinking();
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
            openFrame();
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
            closeFrame();
            sse.writeError(part.error);
            return;

          case "abort":
            closeFrame();
            sse.writeError("Generation aborted.");
            return;
        }
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
        break;
      }

      // ── Tool round: the round's text stays as narration; execute tools. ──
      if (!finished || finished.replay.length === 0) {
        throw new Error(
          "The model requested a tool without a replayable assistant message.",
        );
      }

      // Replay the assistant tool-call message before its tool results.
      conversation.push(...finished.replay);

      let pauseForUser = false;
      const toolResults: Array<{
        toolCallId: string;
        name: string;
        result: string;
        isError: boolean;
      }> = [];

      // Sequential execution: the sandbox is stateful and the UI reads top-down.
      for (const [toolIndex, tc] of pendingToolCalls.entries()) {
        if (signal?.aborted) break;
        const rawArgs = safeParseJson(tc.arguments);
        // The model normally provides a pre-tool note. If it skips that note,
        // provide one ourselves; batched calls also each get their own intent.
        if (!roundText.trim() || toolIndex > 0) {
          writeActivityNarration(describeToolIntent(tc.name, rawArgs));
        }
        sse.writeToolStart(
          tc.id,
          tc.name,
          rawArgs,
          typeof rawArgs.description === "string"
            ? rawArgs.description
            : undefined,
          true,
        );

        // MCP connector tools route to their server over streamable HTTP.
        if (isMcpToolName(tc.name)) {
          const outcome = await mcp.call(tc.name, rawArgs);
          const isError = outcome.isError;
          sse.writeToolEnd(tc.id, tc.name, outcome.text, isError);
          writeActivityNarration(
            describeToolOutcome(tc.name, rawArgs, outcome.text, isError),
          );
          toolResults.push({
            toolCallId: tc.id,
            name: tc.name,
            result: outcome.text,
            isError,
          });
          continue;
        }

        const healingTool = healingTools.get(tc.name);
        let outcomeOutput: unknown;
        let outcomePause = false;

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
                  sse.writeToolData(tc.id, { ...data, tool_call_id: tc.id });
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

        if (outcomePause || tc.name === "ask_user_input_v0") {
          pauseForUser = true;
        }

        sse.writeToolEnd(tc.id, tc.name, resultStr, isError);
        writeActivityNarration(
          describeToolOutcome(tc.name, rawArgs, resultStr, isError),
        );
        toolResults.push({
          toolCallId: tc.id,
          name: tc.name,
          result: resultStr,
          isError,
        });
      }

      for (const result of toolResults) {
        conversation.push({
          role: "tool",
          tool_call_id: result.toolCallId,
          content: result.result,
        });
      }

      try {
        options.onModelTurn?.({
          stopReason: finished.reason,
          startedAtMs: modelTurnStartedAtMs,
          assistantCompletedAtMs,
          completedAtMs: Date.now(),
          assistant: captureOpenAIOutputItems(finished.output),
          toolResults: toolResults.map((result) =>
            toolResultPart(result.toolCallId, result.result, result.isError),
          ),
        });
      } catch {
        // Transcript capture must never break the visible response.
      }

      if (pauseForUser) {
        closeFrame();
        try {
          await onPauseForUser?.();
        } catch {
          // Lease release is best-effort; stream still completes.
        }
        break;
      }
    }
  } catch (error) {
    const aborted =
      signal?.aborted ||
      (error instanceof Error &&
        (error.name === "AbortError" ||
          error.name === "ResponseAborted" ||
          /aborted/i.test(error.message)));

    closeFrame();
    if (aborted) {
      sse.writeError("Generation aborted.");
      return;
    }

    const message = error instanceof Error ? error.message : String(error);
    sse.writeError(message);
    return;
  } finally {
    closeFrame();
    sse.writeDone();
    sse.finalize();
    await mcp.close().catch(() => {});
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
