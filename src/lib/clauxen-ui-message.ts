/** Custom data parts streamed alongside reasoning, tools, and answer text. */
export type ClauxenUIDataParts = {
  "agent-mode": { enabled: boolean };
  "agent-frame": { complete: boolean; frameId?: string };
  "agent-interim": { text: string };
  artifact: {
    artifactId: string;
    path: string;
    content: string;
    language?: string;
    description?: string;
  };
  "tool-data": {
    toolCallId: string;
    data: Record<string, unknown>;
  };
  "chat-title": { title: string };
  "answer-clear": Record<string, never>;
  "step-done": { label?: string };
};

/**
 * Minimal replacement for Vercel AI SDK's UIMessage type.
 * Only used for type-level operations — no runtime dependency.
 */
export type ClauxenUIMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  parts: Array<Record<string, unknown>>;
};

/** Preliminary tool stream chunk (bash stdout/stderr). */
export type ClauxenToolStreamOutput = {
  clauxenStream: "stdout" | "stderr";
  delta: string;
};
