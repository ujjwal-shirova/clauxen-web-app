# Autonomous Agent

Code: `src/app/agent-ui/`. Upstream README: `src/app/agent-ui/README.md`.

## 1. Concept

Server-side reasoning-and-tool-use loop with **no system prompt**. Tool schemas are the only steering mechanism.

Integrated into main chat when web search or thinking is enabled; also exposed via SSE API and optional WebSocket server (`npm run autonomous-agent:ws`).

---

## 2. Decision architecture

1. Silent triage from user text + tool descriptions
2. Tool pecking order in `server/tools/definitions.ts` + `server/logic/tool-steering.ts`
3. Skills slot — `read_skill` before `execute_code` / `file_write`
4. Interleaved thinking — Reasoning* events; post-tool reflection is next model turn
5. Stop when a turn has no tool calls; `MAX_ITERATIONS` is a safety rail

---

## 3. Directory layout

| Path | Purpose |
|---|---|
| `server/stream/agent-orchestrator.ts` | Completions vs Responses routing |
| `server/stream/run-turn.ts` | Completions agent loop |
| `server/stream/completion-stream.ts` | Completions SSE → events |
| `server/stream/tool-loop.ts` | Shared tool execution |
| `server/stream/conversation-turn.ts` | Conversation-scoped turns |
| `server/stream/responses-turn.ts` | OpenAI Responses API loop |
| `server/stream/normalizer.ts` | Responses → normalized events |
| `server/stream/clauxen-bridge.ts` | → main chat UI stream |
| `server/stream/chat-stream.ts` | Main chat entry |
| `server/logic/decision-surface.ts` | No-system-prompt guards |
| `server/skills/skill-catalog.ts` | SKILL.md discovery |
| `server/tools/` | Definitions + executor |
| `server/store/` | Conversation + event log |
| `types/events.ts` | Event vocabulary |
| `client/stream-reducer.ts` | Client reducer |

---

## 4. Normalized events

`RunStarted` → `Reasoning*` / `TextMessage*` / `ToolCall*` → `ToolCallProgress` → `ToolCallResult` → `StepDone` → `RunFinished`

---

## 5. Tools

| Tool | Role |
|---|---|
| `read_skill` | Sandbox facts before code/files |
| `web_search` | Exa |
| `web_fetch` | Deep-read URL |
| `execute_code` | Python sandbox |
| (+ file read/write, clarify, etc. as defined) | |

---

## 6. APIs

- Main chat bridge via generate pipeline
- `/api/autonomous-agent/conversations` (+ `/stream`)
- `/api/v1/agent/*`

---

## 7. Related

- [`inference-and-models.md`](./inference-and-models.md)
- [`chat-system.md`](./chat-system.md)
