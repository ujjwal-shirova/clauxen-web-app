import type { UIMessage } from "ai";

/** Custom data parts streamed alongside reasoning, tools, and answer text. */
export type ClauxenUIDataParts = {
  "agent-mode": { enabled: boolean };
  "agent-frame": { complete: boolean; frameId?: string };
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

export type ClauxenUIMessage = UIMessage<unknown, ClauxenUIDataParts>;

/** Preliminary tool stream chunk (bash stdout/stderr). */
export type ClauxenToolStreamOutput = {
  clauxenStream: "stdout" | "stderr";
  delta: string;
};
