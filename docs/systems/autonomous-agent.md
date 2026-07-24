# Chat agent loop

Live runtime: **`@/server/agent-core`** (Provider / Novita Messages only).

## 1. Concept

Server-side tool-use loop for main chat generate. Uses layered system prompts (`src/prompts/virgil.md` + platform UI appendix + personalization). Tools are always armed; the model decides when to call them.

DOM transcript: `ClauxenSseStream` → `src/components/agent/*` (not Ink/TUI).

---

## 2. Request path

```
POST /api/v1/chats/[chatId]/generate
  → chat.service / createChatStream
  → runAutonomousAgent from @/server/agent-core
  → Provider Messages stream (Provider_API_Key)
  → tool execution (parallel when safe)
  → SSE → agent-stream-reducer → components/agent/*
```

---

## 3. Directory layout

| Path | Purpose |
|---|---|
| `src/server/agent-core/index.ts` | Public import surface |
| `src/server/agent-core/runtime/query-loop.ts` | Main loop (stream → tools → tool_result → repeat) |
| `src/server/agent-core/query/deps.ts` | Injectable `callModel` deps (Claude Code pattern) |
| `src/server/agent-core/provider/messages-client.ts` | Provider Messages client re-export |
| `src/server/agent-core/tools/` | Tool catalog + executor re-exports |
| `src/server/inference/autonomous-tools/` | Tool implementations (sandbox, Exa, files) |
| `src/server/inference/clauxen-sse-stream.ts` | SSE framing for chat UI |
| `src/server/inference/system-prompt.ts` | Prompt assembly (`src/prompts/`) |
| `src/server/inference/agent-engine.ts` | Deprecated shim → agent-core |
| `src/components/agent/` | Chat-view transcript UI |
| `src/server/agent-core/legacy-source/` | Stripped Claude Code reference (not compiled) |

---

## 4. Tools

| Tool | Role |
|---|---|
| `web_search` | Exa search |
| `web_fetch` | Deep-read URL |
| `execute_code` | Python sandbox |
| `bash_tool` | Shell in sandbox |
| `create_file` | Deliverable files (auto-presents as artifact) |
| `read_skill` | Skill catalog lookup |
| `weather_fetch`, `places_search`, `image_search` | Free data cards |
| `ask_user_input_v0` | Pause for user clarification |

---

## 5. APIs

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/v1/chats/:id/generate` | Main chat SSE (uses agent-core) |
| POST | `/api/v1/agent/stream` | Standalone agent SSE |
| POST | `/api/v1/agent/chat` | Agent chat helper |
| GET | `/api/v1/agent/models` | Agent model list |
| POST | `/api/v1/agent/sandbox` | Agent sandbox helper |

Removed: `/api/autonomous-agent/*`, `src/app/agent-ui/`, WebSocket server.

---

## 6. Related

- [`inference-and-models.md`](./inference-and-models.md)
- [`chat-system.md`](./chat-system.md)
- `src/server/agent-core/README.md`
