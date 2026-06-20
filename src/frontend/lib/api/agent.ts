import { apiFetch } from "@/frontend/lib/api/client";

export type AgentContentPart =
  | { type: "text"; text: string }
  | {
      type: "image_url";
      image_url: { url: string; detail?: "auto" | "low" | "high" };
    }
  | { type: "video_url"; video_url: { url: string } };

export type AgentChatMessage = {
  role: "system" | "user" | "assistant";
  content: string | AgentContentPart[];
};

export type AgentChatPayload = {
  model?: string; // upstream slug
  chatModel?: "homer" | "helios" | "virgil"; // logical id -> selects full .md system prompt
  mode?: "chat" | "structured";
  enableThinking?: boolean;
  enableTools?: boolean;
  reasoningSplit?: boolean;
  conversationId?: string;
  messages: AgentChatMessage[];
};

export type AgentChatResponse = {
  message: {
    role: "assistant";
    content?: string | null;
    reasoning_content?: string | null;
    reasoning_details?: unknown;
  };
  usage: unknown;
  model: string;
};

export type NovitaModel = {
  id: string;
  title?: string;
  description?: string;
  context_size?: number;
  features?: string[];
};

export type SandboxRecipe = {
  language: "python";
  install: string;
  environment: Record<string, string>;
  code: string;
};

export type AgentArtifact = {
  id: string;
  path: string;
  content: string;
  language: string;
  description?: string;
};

export type AgentToolExecution = {
  id: string;
  name: string;
  status: "running" | "done" | "error";
  output?: string;
  startedAt: number;
  completedAt?: number;
};

export type AgentStreamHandlers = {
  onTextDelta?: (text: string) => void;
  onReasoningDelta?: (text: string) => void;
  onToolExecuting?: (payload: { tool_call_id: string; name: string }) => void;
  onToolResult?: (payload: {
    tool_call_id: string;
    name: string;
    result: string;
  }) => void;
  onFileCreated?: (payload: {
    path: string;
    content: string;
    language?: string;
    description?: string;
  }) => void;
  onFileUpdated?: (payload: {
    path: string;
    content: string;
    language?: string;
  }) => void;
  onSandboxReady?: (payload: {
    auto_created?: boolean;
    sandboxId?: string;
  }) => void;
  onCacheUsage?: (payload: Record<string, unknown>) => void;
  onBashOutput?: (payload: { text: string; kind: "stdout" | "stderr" }) => void;
  onDone?: (payload: { finish_reason: string }) => void;
  onError?: (message: string) => void;
};

export async function runAgentChat(payload: AgentChatPayload) {
  return apiFetch<AgentChatResponse>("/api/v1/agent/chat", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function streamAgentChat(
  payload: AgentChatPayload,
  handlers: AgentStreamHandlers,
  signal?: AbortSignal,
) {
  const response = await fetch("/api/v1/agent/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
    credentials: "include",
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || `Agent stream failed (${response.status})`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response stream");

  const decoder = new TextDecoder();
  let buffer = "";
  let currentEvent = "message";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (line.startsWith("event: ")) {
        currentEvent = line.slice(7).trim();
        continue;
      }
      if (!line.startsWith("data: ")) continue;

      let data: Record<string, unknown>;
      try {
        data = JSON.parse(line.slice(6)) as Record<string, unknown>;
      } catch {
        continue;
      }

      switch (currentEvent) {
        case "text_delta":
          handlers.onTextDelta?.(String(data.text ?? ""));
          break;
        case "reasoning_delta":
          handlers.onReasoningDelta?.(String(data.text ?? ""));
          break;
        case "tool_executing":
          handlers.onToolExecuting?.({
            tool_call_id: String(data.tool_call_id ?? ""),
            name: String(data.name ?? ""),
          });
          break;
        case "tool_result":
          handlers.onToolResult?.({
            tool_call_id: String(data.tool_call_id ?? ""),
            name: String(data.name ?? ""),
            result: String(data.result ?? ""),
          });
          break;
        case "file_created":
          handlers.onFileCreated?.({
            path: String(data.path ?? ""),
            content: String(data.content ?? ""),
            language: data.language ? String(data.language) : undefined,
            description: data.description
              ? String(data.description)
              : undefined,
          });
          break;
        case "file_updated":
          handlers.onFileUpdated?.({
            path: String(data.path ?? ""),
            content: String(data.content ?? ""),
            language: data.language ? String(data.language) : undefined,
          });
          break;
        case "sandbox_ready":
          handlers.onSandboxReady?.(data as { auto_created?: boolean });
          break;
        case "bash_stdout":
          handlers.onBashOutput?.({
            text: String(data.text ?? ""),
            kind: "stdout",
          });
          break;
        case "bash_stderr":
          handlers.onBashOutput?.({
            text: String(data.text ?? ""),
            kind: "stderr",
          });
          break;
        case "cache_usage":
          handlers.onCacheUsage?.(data as Record<string, unknown>);
          break;
        case "done":
          handlers.onDone?.({
            finish_reason: String(data.finish_reason ?? "stop"),
          });
          break;
        case "error":
          handlers.onError?.(String(data.message ?? "Stream error"));
          break;
      }
    }
  }
}

export async function listAgentModels() {
  return apiFetch<{ data?: NovitaModel[] }>("/api/v1/agent/models");
}

export async function createSandboxRecipe(payload: {
  kind: "browser" | "desktop";
  task?: string;
  model?: string;
  viewOnly?: boolean;
}) {
  return apiFetch<SandboxRecipe>("/api/v1/agent/sandbox", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
