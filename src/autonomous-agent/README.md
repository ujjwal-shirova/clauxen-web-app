# Autonomous Agent

Server-side autonomous reasoning-and-tool-use loop with **no system prompt**. Tool schemas are the only steering mechanism. Integrated into **main chat** when web search or thinking is enabled; also exposed via SSE API and optional WebSocket server.

## Decision architecture (emergent, not scripted)

1. **Silent triage** — model judges from user text + tool descriptions (no `instructions` field).
2. **Tool pecking order** — encoded in `server/tools/definitions.ts` and `server/logic/tool-steering.ts`.
3. **Skills slot** — `read_skill` mandatory before `execute_code` / `file_write` (see tool description).
4. **Interleaved thinking** — `Reasoning*` events during stream; post-tool reflection is the next model turn.
5. **Stop condition** — loop ends when a turn has no tool calls; `MAX_ITERATIONS` is a safety rail only.

## Architecture

```
Main chat (/api/chat)
  → createChatSourceStream → streamAutonomousAgentChat
  → runAgentLoop (Novita Chat Completions)
  → clauxen-bridge → AgentOrchestrationView

Standalone API (/api/autonomous-agent/conversations/[id]/stream)
  → runConversationTurn → conversation store + event log + runAgentLoop

OpenAI Responses path (AUTONOMOUS_AGENT_BACKEND=responses)
  → runResponsesTurn → normalizer.ts → tool-loop.ts
```

## Directory layout

| Path | Purpose |
|------|---------|
| `server/stream/agent-orchestrator.ts` | Unified entry — routes Completions vs Responses |
| `server/stream/run-turn.ts` | Chat Completions agent loop |
| `server/stream/completion-stream.ts` | Completions SSE → normalized events + partial JSON |
| `server/stream/tool-loop.ts` | Shared post-turn tool execution + `StepDone` |
| `server/stream/conversation-turn.ts` | Conversation-scoped turns + event replay |
| `server/stream/responses-turn.ts` | OpenAI Responses API loop |
| `server/stream/normalizer.ts` | Responses SSE → normalized events |
| `server/stream/clauxen-bridge.ts` | Normalized events → main chat UI stream |
| `server/stream/chat-stream.ts` | Entry for main chat pipeline |
| `server/logic/decision-surface.ts` | No-system-prompt guards, input builders |
| `server/logic/tool-steering.ts` | Pecking order docs + UI labels |
| `server/skills/skill-catalog.ts` | Discover/read Cursor/Codex SKILL.md files |
| `server/tools/` | Tool definitions, executor, implementations |
| `server/store/` | Conversation state + per-run event log |
| `types/events.ts` | Normalized event vocabulary |
| `client/stream-reducer.ts` | Normalized event → state reducer |

## Normalized events

`RunStarted` → `Reasoning*` / `TextMessage*` / `ToolCall*` → `ToolCallProgress` (partial search) → `ToolCallResult` → `StepDone` → `RunFinished`

## Tools

| Tool | Role |
|------|------|
| `read_skill` | Sandbox facts before code/files |
| `web_search` | Live web (Exa) |
| `web_fetch` | Deep-read a known URL |
| `execute_code` | Python sandbox |
| `file_read` / `file_write` | Scoped workspace |
| `ask_user_clarification` | Pause instead of guessing |

## Environment

```bash
NOVITA_API_KEY=...                        # Required
EXA_API_KEY=...                           # web_search / web_fetch
AUTONOMOUS_AGENT_BACKEND=completions      # or responses (default: completions)
AUTONOMOUS_AGENT_MAX_ITERATIONS=25        # Safety rail only
```

## Commands

```bash
npm run dev                    # Main chat at /
npm run autonomous-agent:ws    # WebSocket on port 8081
```

The standalone `/autonomous-agent` page was removed — logic lives in this module and main chat only.
