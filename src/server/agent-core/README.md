# Clauxen agent-core (Provider / Novita only)

Claude Code–style agent loop for the web app. **All model calls use Vercel `Provider_*` / Novita** — no Anthropic OAuth, Bedrock, Vertex, Foundry, or Claude.ai Files API.

## Layout

```
agent-core/
  index.ts                 # Public API (import this)
  provider/
    messages-client.ts     # Provider_API_Key + Anthropic-compatible Messages URL
  runtime/
    run-agent.ts           # Wired loop → chat SSE / chat-view AgentTrace
  tools/
    index.ts               # Tool catalog used by the loop
  legacy-source/           # Stripped Claude Code remnants (NOT compiled; reference only)
```

## Auth / API

| Env | Role |
|-----|------|
| `Provider_API_Key` | Required (Vercel sensitive) |
| `Provider_BASE_URL` | OpenAI-compatible base; `/openai` → `/anthropic` for Messages |
| `Provider_Model_Clauxen_V1` | Default model slug |

Implemented via `@/server/config/env` + `@/server/inference/anthropic-messages-client`.

## Wiring

```
POST /api/v1/chats/[id]/generate
  → createChatStream / chat.service
  → runAgent from @/server/agent-core
  → Provider Messages stream + tools
  → Clauxen SSE → src/components/agent/*
```

## Removed from legacy Claude tree

Anthropic OAuth, `cli.js`/Ink/TUI, Bedrock/Vertex/Foundry client, Files API, Grove/referral/metrics org APIs, CCR remote/bridge, MCP Anthropic proxy config.
