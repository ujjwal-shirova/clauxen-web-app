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
import {
  ChatTitleStreamFilter,
  flushChatTitleFilterTail,
  buildInlineChatTitleSystemInstruction,
} from "@/lib/chat-title";

const MAX_AGENT_STEPS = 8;
const DEFAULT_MAX_TOKENS = 8192;

const CLAUXEN_SYSTEM =
  "You are Clauxen, a helpful AI assistant. Answer clearly and concisely.";

function toCoreMessages(messages: IncomingMessage[]) {
  return messages.map((message) => ({
    role: message.role as "user" | "assistant" | "system",
    content: message.content,
  }));
}

function wireToolEvents(bridge: ClauxenUiStreamWriter, toolCallId?: string) {
  return createToolEventSender((event, data) => {
    if (event === "web_search_results") {
      bridge.onToolData({
        tool_call_id:
          typeof data.tool_call_id === "string" ? data.tool_call_id : toolCallId,
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
        language:
          typeof data.language === "string" ? data.language : undefined,
        description:
          typeof data.description === "string" ? data.description : undefined,
      });
      return;
    }
    if (event === "tool_progress") {
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
 * - Plain chat: no tools, single step
 * - Web search: deferred tools via prepareStep (no tool payload on step 0)
 * - Thinking: full autonomous toolkit; model decides when to call tools
 */
export function streamAiSdkChat(
  messages: IncomingMessage[],
  signal?: AbortSignal,
  options: AiSdkChatStreamOptions = {},
): ReadableStream<Uint8Array> {
  const thinkingEnabled = (options.thinkingType ?? "disabled") === "enabled";
  const webSearchEnabled = options.webSearchEnabled === true;
  const mode = resolveAgentCapabilityMode({ thinkingEnabled, webSearchEnabled });

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
    bridge.writeStart(false);

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

    const systemParts = [CLAUXEN_SYSTEM];
    if (options.generateChatTitle) {
      systemParts.push(buildInlineChatTitleSystemInstruction());
    }

    try {
      const modelSlug = options.model?.trim() || env.heliosModel;
      const toolInputJson = new Map<string, string>();
      const toolNames = new Map<string, string>();

      const result = streamText({
        model: novitaChatModel(modelSlug, options.baseUrl),
        messages: toCoreMessages(messages),
        ...(systemParts.length > 0 ? { system: systemParts.join("\n\n") } : {}),
        ...(tools ? { tools } : {}),
        maxOutputTokens: DEFAULT_MAX_TOKENS,
        temperature: thinkingEnabled ? 1 : 0.6,
        abortSignal: signal,
        stopWhen:
          mode === "plain"
            ? stepCountIs(1)
            : stepCountIs(MAX_AGENT_STEPS),
        ...(prepareStep ? { prepareStep } : {}),
      });

      for await (const part of result.fullStream) {
        if (part.type === "text-delta") {
          const visible = titleFilter ? titleFilter.push(part.text) : part.text;
          if (visible) bridge.onAnswerDelta(visible);
          continue;
        }
        if (part.type === "reasoning-delta") {
          bridge.onReasoningDelta(part.text);
          continue;
        }
        if (part.type === "tool-input-start") {
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
        if (part.type === "tool-input-delta") {
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
          toolInputJson.delete(part.toolCallId);
          toolNames.delete(part.toolCallId);
          bridge.onToolResult({
            tool_call_id: part.toolCallId,
            name: part.toolName,
            result:
              typeof part.output === "string"
                ? part.output
                : JSON.stringify(part.output ?? {}),
          });
          continue;
        }
        if (part.type === "finish-step") {
          bridge.onStepDone();
        }
      }

      if (titleFilter) {
        const tail = flushChatTitleFilterTail(titleFilter);
        if (tail) bridge.onAnswerDelta(tail);
      }
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
