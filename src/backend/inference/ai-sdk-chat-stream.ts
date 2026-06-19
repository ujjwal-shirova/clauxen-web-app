import { stepCountIs, streamText } from "ai";
import {
  createClauxenUiMessageStream,
  encodeUiMessageStreamToBytes,
} from "@/backend/inference/clauxen-ui-stream";
import { ClauxenUiStreamWriter } from "@/backend/inference/clauxen-ui-stream-writer";
import {
  buildAgentPrepareStep,
  resolveAgentCapabilityMode,
} from "@/backend/inference/ai-sdk-prepare-step";
import {
  buildWebAiSdkTools,
  createToolEventSender,
  type AiSdkToolContext,
} from "@/backend/inference/ai-sdk-tool-kit";
import { novitaChatModel } from "@/backend/inference/novita-ai-sdk";
import { streamThinkingAgentChat } from "@/backend/inference/thinking-agent-stream";
import { env } from "@/backend/config/env";
import type { IncomingMessage, ThinkingType } from "@/backend/inference/novita";
import { stripMessageContentForModelApi } from "@/lib/model-context";
import {
  ChatTitleStreamFilter,
  flushChatTitleFilterTail,
} from "@/lib/chat-title";
import {
  buildCacheableSystemPrefix,
  orderMessagesForPromptCache,
} from "@/backend/inference/prompt-cache";
import { buildAgentSystemPrompt } from "@/backend/inference/agent-system-prompt";

const MAX_AGENT_STEPS = 8;
const DEFAULT_MAX_TOKENS = 8192;

// System prompt is now managed centrally in agent-system-prompt.ts

function stringifyToolOutput(output: unknown): string {
  return typeof output === "string" ? output : JSON.stringify(output ?? {});
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function toCoreMessages(messages: IncomingMessage[]) {
  return messages.map((message) => ({
    role: message.role as "user" | "assistant" | "system",
    content: stripMessageContentForModelApi(message.content),
  }));
}

function wireToolEvents(bridge: ClauxenUiStreamWriter, toolCallId?: string) {
  return createToolEventSender((event, data) => {
    if (event === "web_search_results") {
      bridge.onToolData({
        tool_call_id:
          typeof data.tool_call_id === "string"
            ? data.tool_call_id
            : toolCallId,
        query: data.query,
        results: data.results,
      });
      return;
    }
    if (event === "web_fetch_result") {
      bridge.onToolData({
        tool_call_id: toolCallId,
        url: data.url,
        title: data.title,
        snippet: data.snippet,
      });
      return;
    }
    if (event === "file_created") {
      bridge.onArtifact({
        path: String(data.path ?? ""),
        content: String(data.content ?? ""),
        language: typeof data.language === "string" ? data.language : undefined,
        description:
          typeof data.description === "string" ? data.description : undefined,
      });
      return;
    }
    if (event === "file_updated") {
      bridge.onArtifact({
        path: String(data.path ?? ""),
        content: String(data.content ?? ""),
        language: typeof data.language === "string" ? data.language : undefined,
        description:
          typeof data.description === "string" ? data.description : undefined,
      });
      return;
    }
    if (event === "bash_stdout" && typeof data.text === "string") {
      bridge.onToolOutput(data.text, "stdout");
      return;
    }
    if (event === "bash_stderr" && typeof data.text === "string") {
      bridge.onToolOutput(data.text, "stderr");
      return;
    }
    if (event === "tool_progress") {
      bridge.onToolData(data);
      return;
    }
    if (
      event === "sandbox_ready" ||
      event === "code_executed" ||
      event === "weather_data" ||
      event === "places_data"
    ) {
      bridge.onToolData(data);
      return;
    }
    if (event === "clarification" && typeof data.question === "string") {
      bridge.onAnswerDelta(`\n\n**Clarification needed:** ${data.question}\n`);
    }
  });
}

export type AiSdkChatStreamOptions = {
  thinkingType?: ThinkingType;
  userId?: string;
  conversationId?: string;
  webSearchEnabled?: boolean;
  userCountryCode?: string;
  generateChatTitle?: boolean;
  model?: string;
  baseUrl?: string;
};

/**
 * Unified chat/agent stream via Vercel AI SDK on Novita.
 * - Plain chat: no tools, one step, system prompt allowed.
 * - Web search: compact web-only tools; Novita chat/completions has no
 *   Responses-style lazy tool_search, so first-step search remains possible.
 * - Thinking: delegated to the promptless Novita tool loop; tool schemas steer.
 */
export function streamAiSdkChat(
  messages: IncomingMessage[],
  signal?: AbortSignal,
  options: AiSdkChatStreamOptions = {},
): ReadableStream<Uint8Array> {
  const thinkingEnabled = (options.thinkingType ?? "disabled") === "enabled";
  const webSearchEnabled = options.webSearchEnabled === true;
  const mode = resolveAgentCapabilityMode({
    thinkingEnabled,
    webSearchEnabled,
  });

  if (mode === "thinking") {
    return streamThinkingAgentChat(messages, signal, {
      userId: options.userId,
      conversationId: options.conversationId,
      userCountryCode: options.userCountryCode,
      model: options.model?.trim() || env.thinkingModel,
      baseUrl: options.baseUrl,
    });
  }

  const uiStream = createClauxenUiMessageStream(async (bridge) => {
    bridge.writeStart(mode !== "plain");

    const titleFilter = options.generateChatTitle
      ? new ChatTitleStreamFilter((title) => {
          bridge.onChatTitle(title);
        })
      : null;

    const toolContext: AiSdkToolContext = {
      userId: options.userId,
      conversationId: options.conversationId,
      userCountryCode: options.userCountryCode,
    };

    const send = wireToolEvents(bridge);
    const tools =
      mode === "web" ? buildWebAiSdkTools(send, toolContext) : undefined;

    const toolNames = tools
      ? (Object.keys(tools) as Array<keyof typeof tools & string>)
      : [];
    const prepareStep =
      tools && toolNames.length > 0
        ? buildAgentPrepareStep(mode, toolNames)
        : undefined;

    const rawSystem = buildCacheableSystemPrefix(
      buildAgentSystemPrompt({ generateChatTitle: options.generateChatTitle }),
    );
    const systemParts = [rawSystem];

    try {
      const modelSlug = options.model?.trim() || env.heliosModel;
      const toolInputJson = new Map<string, string>();
      const toolNames = new Map<string, string>();
      let agentWorkStarted = false;
      let workFrameOpen = false;
      let frameCounter = 0;

      const ensureWorkFrame = () => {
        if (workFrameOpen) return;
        frameCounter += 1;
        bridge.onFrameStart(`frame-${frameCounter}`);
        workFrameOpen = true;
      };

      const closeWorkFrame = () => {
        if (!workFrameOpen) return;
        bridge.onFrameComplete();
        workFrameOpen = false;
      };

      // Order for prefix cache (system prefix first via separate system, conversation after).
      // Stripping already happened in toCoreMessages.
      const orderedCoreMessages = orderMessagesForPromptCache(
        [],
        toCoreMessages(messages),
      );

      const result = streamText({
        model: novitaChatModel(modelSlug, options.baseUrl),
        messages: orderedCoreMessages,
        ...(systemParts.length > 0 ? { system: systemParts.join("\n\n") } : {}),
        ...(tools ? { tools } : {}),
        maxOutputTokens: DEFAULT_MAX_TOKENS,
        temperature: thinkingEnabled ? 1 : 0.6,
        abortSignal: signal,
        stopWhen:
          mode === "plain" ? stepCountIs(1) : stepCountIs(MAX_AGENT_STEPS),
        ...(prepareStep ? { prepareStep } : {}),
      });

      for await (const part of result.fullStream) {
        if (part.type === "text-delta") {
          const visible = titleFilter ? titleFilter.push(part.text) : part.text;
          if (visible) bridge.onAnswerDelta(visible);
          continue;
        }
        if (part.type === "reasoning-start") {
          agentWorkStarted = true;
          ensureWorkFrame();
          continue;
        }
        if (part.type === "reasoning-delta") {
          agentWorkStarted = true;
          ensureWorkFrame();
          bridge.onReasoningDelta(part.text);
          continue;
        }
        if (part.type === "reasoning-end") {
          bridge.onReasoningEnd();
          continue;
        }
        if (part.type === "tool-input-start") {
          agentWorkStarted = true;
          ensureWorkFrame();
          bridge.onReasoningEnd();
          toolNames.set(part.id, part.toolName);
          toolInputJson.set(part.id, "");
          bridge.onToolExecuting({
            tool_call_id: part.id,
            name: part.toolName,
            description: part.title,
            args: {},
          });
          continue;
        }
        if (part.type === "tool-call") {
          agentWorkStarted = true;
          ensureWorkFrame();
          bridge.onReasoningEnd();
          toolNames.set(part.toolCallId, part.toolName);
          bridge.onToolExecuting({
            tool_call_id: part.toolCallId,
            name: part.toolName,
            description: part.title,
            args:
              part.input && typeof part.input === "object"
                ? (part.input as Record<string, unknown>)
                : {},
          });
          continue;
        }
        if (part.type === "tool-input-delta") {
          agentWorkStarted = true;
          ensureWorkFrame();
          bridge.onReasoningEnd();
          const name = toolNames.get(part.id) ?? "tool";
          const prior = toolInputJson.get(part.id) ?? "";
          const next = prior + part.delta;
          toolInputJson.set(part.id, next);
          bridge.onToolStreaming({
            tool_calls: [{ id: part.id, name, input: next }],
          });
          continue;
        }
        if (part.type === "tool-result") {
          agentWorkStarted = true;
          ensureWorkFrame();
          toolInputJson.delete(part.toolCallId);
          toolNames.delete(part.toolCallId);
          bridge.onToolResult({
            tool_call_id: part.toolCallId,
            name: part.toolName,
            result: stringifyToolOutput(part.output),
          });
          continue;
        }
        if (part.type === "tool-error") {
          agentWorkStarted = true;
          ensureWorkFrame();
          toolInputJson.delete(part.toolCallId);
          toolNames.delete(part.toolCallId);
          bridge.onToolResult({
            tool_call_id: part.toolCallId,
            name: part.toolName,
            result: stringifyToolOutput({ error: errorMessage(part.error) }),
          });
          continue;
        }
        if (part.type === "finish-step") {
          if (agentWorkStarted) {
            bridge.onStepDone();
            closeWorkFrame();
          }
          continue;
        }
        if (part.type === "error") {
          bridge.onError(errorMessage(part.error));
          continue;
        }
        if (part.type === "abort") {
          break;
        }
      }

      if (titleFilter) {
        const tail = flushChatTitleFilterTail(titleFilter);
        if (tail) bridge.onAnswerDelta(tail);
      }
      closeWorkFrame();
    } catch (error) {
      bridge.onError(
        error instanceof Error ? error.message : "Generation failed",
      );
    } finally {
      bridge.finalize();
    }
  });

  return encodeUiMessageStreamToBytes(uiStream);
}
