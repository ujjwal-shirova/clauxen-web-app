import type { AgentFrame } from "@/lib/agent-frames";
import type { AgentSegment, WebSearchResult } from "@/lib/agent-segments";
import type { ChatArtifact } from "@/lib/chat-artifacts";
import type { Message } from "@/lib/types";

/** One user→assistant exchange in the login demo chat. */
export type DemoTurn = {
  id: string;
  prompt: string;
  reply: string;
};

export type DemoSceneMeta = {
  id: string;
  label: string;
};

/** Scene title cards between chat windows (product-demo chapters). */
export const DEMO_SCENES = {
  agent: {
    id: "agent",
    label: "Watch Clauxen research, use tools, and ship work",
  },
  files: {
    id: "files",
    label: "Drop in your docs — Clauxen reads them with you",
  },
} as const satisfies Record<string, DemoSceneMeta>;

/**
 * Agentic product-demo turn — search the web, fetch sources, create a file.
 * Short enough to type on camera; rich enough to look like a real Clauxen run.
 */
export const DEMO_AGENT_TURN: DemoTurn = {
  id: "agent",
  prompt:
    "Compare Claude, ChatGPT, and Gemini for product teams this quarter. Search current sources, then write a one-page competitive brief I can share tomorrow.",
  reply:
    "Here’s the brief — ready to share.\n\n**Bottom line:** Claude leads on deep agentic work and document quality, ChatGPT wins distribution and plugins, Gemini is strongest when the work already lives in Google.\n\nI saved the full one-pager as `Competitive_Brief_Q3.md` with sources, positioning notes, and a suggested Clauxen angle for your login demo.",
};

/** Files scene follow-up after the Finder drop. */
export const DEMO_FILES_TURN: DemoTurn = {
  id: "files",
  prompt: "Read these and tell me what to prioritize this week.",
  reply:
    "I went through all three.\n\n**This week**\n1. **Ship the agent demo clip** — the brief already frames search → tools → deliverable; that’s the story.\n2. **Tighten the Q3 messaging** — lead with “gets real work done,” not feature lists.\n3. **Budget:** keep the launch creative line; cut the unused analytics add-on (~$180/mo).\n\nWant me to turn this into a Monday standup checklist?",
};

/** @deprecated prefer DEMO_AGENT_TURN / DEMO_FILES_TURN */
export const DEMO_DAILY_TURN = DEMO_AGENT_TURN;
/** @deprecated */
export const DEMO_CHAT_TURNS: DemoTurn[] = [DEMO_AGENT_TURN];

const SEARCH_RESULTS: WebSearchResult[] = [
  {
    title: "Claude for work — Anthropic product overview",
    url: "https://www.anthropic.com/claude",
    snippet:
      "Projects, artifacts, and computer use for teams that need reliable research and writing.",
  },
  {
    title: "ChatGPT — OpenAI platform update",
    url: "https://openai.com/chatgpt",
    snippet:
      "Custom GPTs, browsing, and a large ecosystem of plugins for everyday product work.",
  },
  {
    title: "Gemini for Google Workspace",
    url: "https://gemini.google.com",
    snippet:
      "Deep integration with Docs, Sheets, and Gmail for teams already in Google.",
  },
];

const BRIEF_CONTENT = `# Competitive brief — Q3

## Snapshot
| Product | Best at | Watch-out |
|---|---|---|
| Claude | Deep research, long docs, careful agents | Smaller plugin surface |
| ChatGPT | Reach, GPTs, everyday workflows | Quality can vary by task |
| Gemini | Google Workspace glue | Weaker outside that stack |

## What Clauxen should show
A live agent loop: **search → tools → file deliverable** — the same story as this login demo.

## Sources
- anthropic.com/claude
- openai.com/chatgpt
- gemini.google.com
`;

export type AgentDemoKeyframe =
  | { kind: "thinking_start"; heading: string }
  | { kind: "thinking_stream"; text: string }
  | { kind: "thinking_done"; durationSeconds: number }
  | { kind: "narration"; text: string }
  | {
      kind: "tool_start";
      toolCallId: string;
      name: string;
      description?: string;
      args?: Record<string, unknown>;
      searchQuery?: string;
      filePath?: string;
      fileLanguage?: string;
    }
  | {
      kind: "tool_args";
      toolCallId: string;
      args: Record<string, unknown>;
      fileContent?: string;
    }
  | {
      kind: "tool_done";
      toolCallId: string;
      result?: string;
      searchResults?: WebSearchResult[];
      fileContent?: string;
    }
  | { kind: "answer_stream"; text: string }
  | { kind: "complete" };

/** Timed beats for the agent product-demo animation. */
export const DEMO_AGENT_KEYFRAMES: Array<{
  waitMs: number;
  frame: AgentDemoKeyframe;
}> = [
  {
    waitMs: 180,
    frame: { kind: "thinking_start", heading: "Scoping a fair comparison" },
  },
  {
    waitMs: 40,
    frame: {
      kind: "thinking_stream",
      text: "Need current positioning, not stale blog takes. Search official pages first, then compress into a one-pager the team can actually use.",
    },
  },
  { waitMs: 520, frame: { kind: "thinking_done", durationSeconds: 4 } },
  {
    waitMs: 280,
    frame: {
      kind: "narration",
      text: "I’ll pull fresh sources, then draft the brief as a shareable file.",
    },
  },
  {
    waitMs: 360,
    frame: {
      kind: "tool_start",
      toolCallId: "demo-search-1",
      name: "web_search",
      description: "Searching current product pages",
      searchQuery: "Claude ChatGPT Gemini product teams 2026",
      args: { query: "Claude ChatGPT Gemini product teams 2026" },
    },
  },
  {
    waitMs: 1100,
    frame: {
      kind: "tool_done",
      toolCallId: "demo-search-1",
      searchResults: SEARCH_RESULTS,
      result: JSON.stringify({ results: SEARCH_RESULTS }),
    },
  },
  {
    waitMs: 420,
    frame: {
      kind: "tool_start",
      toolCallId: "demo-fetch-1",
      name: "web_fetch",
      description: "Reading Anthropic’s Claude overview",
      args: { url: "https://www.anthropic.com/claude" },
    },
  },
  {
    waitMs: 900,
    frame: {
      kind: "tool_done",
      toolCallId: "demo-fetch-1",
      result: JSON.stringify({
        url: "https://www.anthropic.com/claude",
        title: "Claude for work — Anthropic",
        text: "Claude emphasizes careful reasoning, long-context documents, and agentic computer use for real workflows.",
      }),
    },
  },
  {
    waitMs: 380,
    frame: {
      kind: "tool_start",
      toolCallId: "demo-file-1",
      name: "create_file",
      description: "Creating Competitive_Brief_Q3.md",
      filePath: "Competitive_Brief_Q3.md",
      fileLanguage: "markdown",
      args: {
        path: "Competitive_Brief_Q3.md",
        description: "Creating Competitive_Brief_Q3.md",
        language: "markdown",
        content: "",
      },
    },
  },
  {
    waitMs: 80,
    frame: {
      kind: "tool_args",
      toolCallId: "demo-file-1",
      args: {
        path: "Competitive_Brief_Q3.md",
        description: "Creating Competitive_Brief_Q3.md",
        language: "markdown",
        content: BRIEF_CONTENT,
      },
      fileContent: BRIEF_CONTENT,
    },
  },
  {
    waitMs: 1400,
    frame: {
      kind: "tool_done",
      toolCallId: "demo-file-1",
      fileContent: BRIEF_CONTENT,
      result: JSON.stringify({
        path: "Competitive_Brief_Q3.md",
        content: BRIEF_CONTENT,
      }),
    },
  },
  { waitMs: 420, frame: { kind: "answer_stream", text: DEMO_AGENT_TURN.reply } },
  { waitMs: 200, frame: { kind: "complete" } },
];

export function buildUserMessage(turn: DemoTurn, index: number): Message {
  return {
    id: `demo-user-${turn.id}-${index}`,
    role: "user",
    content: turn.prompt,
    createdAt: Date.now(),
  };
}

export function buildAssistantMessage(
  turn: DemoTurn,
  index: number,
  content: string,
  isStreaming: boolean,
  createdAt = Date.now(),
): Message {
  return {
    id: `demo-assistant-${turn.id}-${index}`,
    role: "assistant",
    content,
    isStreaming,
    createdAt,
  };
}

function emptyAgentFrame(startedAtMs: number): AgentFrame {
  return {
    id: "demo-frame-1",
    segments: [],
    complete: false,
    startedAtMs,
  };
}

function upsertSegment(
  segments: AgentSegment[],
  next: AgentSegment,
): AgentSegment[] {
  const idx = segments.findIndex((s) => s.id === next.id);
  if (idx < 0) return [...segments, next];
  const copy = segments.slice();
  copy[idx] = next;
  return copy;
}

function artifactForBrief(messageId: string, createdAtMs: number): ChatArtifact {
  return {
    id: `${messageId}:create:demo-file-1`,
    path: "Competitive_Brief_Q3.md",
    fileName: "Competitive_Brief_Q3.md",
    content: BRIEF_CONTENT,
    language: "markdown",
    description: "One-page competitive brief",
    createdAtMs,
  };
}

/**
 * Apply one agent demo keyframe onto an assistant message (immutable).
 * Used by LoginDemoPlayer to animate the real agent UI.
 */
export function applyAgentDemoKeyframe(
  message: Message,
  keyframe: AgentDemoKeyframe,
  startedAtMs: number,
): Message {
  const frames = message.agentFrames?.length
    ? message.agentFrames.map((f) => ({
        ...f,
        segments: [...f.segments],
      }))
    : [emptyAgentFrame(startedAtMs)];
  const frame = frames[0]!;
  let content = message.content;
  let isStreaming = true;
  let agentFrameComplete = false;
  let agentArtifacts = message.agentArtifacts;

  switch (keyframe.kind) {
    case "thinking_start": {
      frame.segments = upsertSegment(frame.segments, {
        kind: "thinking",
        id: "demo-thinking-1",
        heading: keyframe.heading,
        content: "",
        isStreaming: true,
        startedAtMs,
      });
      break;
    }
    case "thinking_stream": {
      frame.segments = upsertSegment(frame.segments, {
        kind: "thinking",
        id: "demo-thinking-1",
        heading:
          (
            frame.segments.find((s) => s.id === "demo-thinking-1") as
              | Extract<AgentSegment, { kind: "thinking" }>
              | undefined
          )?.heading ?? "Working",
        content: keyframe.text,
        isStreaming: true,
        startedAtMs,
      });
      break;
    }
    case "thinking_done": {
      const prev = frame.segments.find((s) => s.id === "demo-thinking-1") as
        | Extract<AgentSegment, { kind: "thinking" }>
        | undefined;
      frame.segments = upsertSegment(frame.segments, {
        kind: "thinking",
        id: "demo-thinking-1",
        heading: prev?.heading,
        content: prev?.content ?? "",
        isStreaming: false,
        durationSeconds: keyframe.durationSeconds,
        startedAtMs,
      });
      break;
    }
    case "narration": {
      frame.segments = upsertSegment(frame.segments, {
        kind: "narration",
        id: "demo-narration-1",
        content: keyframe.text,
        isStreaming: false,
      });
      break;
    }
    case "tool_start": {
      frame.segments = upsertSegment(frame.segments, {
        kind: "tool",
        id: keyframe.toolCallId,
        toolCallId: keyframe.toolCallId,
        name: keyframe.name,
        status: "running",
        description: keyframe.description,
        args: keyframe.args,
        argsComplete: true,
        searchQuery: keyframe.searchQuery,
        filePath: keyframe.filePath,
        fileLanguage: keyframe.fileLanguage,
        fileContent:
          typeof keyframe.args?.content === "string"
            ? keyframe.args.content
            : undefined,
        startedAtMs: Date.now(),
      });
      break;
    }
    case "tool_args": {
      const prev = frame.segments.find((s) => s.id === keyframe.toolCallId) as
        | Extract<AgentSegment, { kind: "tool" }>
        | undefined;
      if (prev) {
        frame.segments = upsertSegment(frame.segments, {
          ...prev,
          args: { ...prev.args, ...keyframe.args },
          fileContent: keyframe.fileContent ?? prev.fileContent,
          status: "running",
        });
      }
      break;
    }
    case "tool_done": {
      const prev = frame.segments.find((s) => s.id === keyframe.toolCallId) as
        | Extract<AgentSegment, { kind: "tool" }>
        | undefined;
      if (prev) {
        frame.segments = upsertSegment(frame.segments, {
          ...prev,
          status: "done",
          result: keyframe.result,
          searchResults: keyframe.searchResults ?? prev.searchResults,
          fileContent: keyframe.fileContent ?? prev.fileContent,
          completedAtMs: Date.now(),
        });
        if (prev.name === "create_file") {
          agentArtifacts = [
            artifactForBrief(message.id, Date.now()),
          ];
        }
      }
      break;
    }
    case "answer_stream": {
      content = keyframe.text;
      break;
    }
    case "complete": {
      isStreaming = false;
      agentFrameComplete = true;
      frame.complete = true;
      frame.completedAtMs = Date.now();
      content = content || DEMO_AGENT_TURN.reply;
      if (!agentArtifacts?.length) {
        agentArtifacts = [artifactForBrief(message.id, Date.now())];
      }
      break;
    }
  }

  frames[0] = frame;
  return {
    ...message,
    content,
    isStreaming,
    agentMode: true,
    agentFrameComplete,
    agentFrames: frames,
    agentSegments: frame.segments,
    agentArtifacts,
    thinkingDurationSeconds:
      keyframe.kind === "thinking_done"
        ? keyframe.durationSeconds
        : message.thinkingDurationSeconds,
  };
}

export function buildStreamingAgentAssistant(
  turn: DemoTurn,
  index: number,
  createdAt = Date.now(),
): Message {
  return {
    id: `demo-assistant-${turn.id}-${index}`,
    role: "assistant",
    content: "",
    isStreaming: true,
    agentMode: true,
    agentFrameComplete: false,
    agentFrames: [emptyAgentFrame(createdAt)],
    agentSegments: [],
    createdAt,
  };
}
