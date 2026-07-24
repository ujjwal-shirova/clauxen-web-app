---
name: clauxen-autonomous-agent
description: >-
  Clauxen chat agent loop. Live path is @/server/agent-core (Provider/Novita
  Messages only) → SSE → src/components/agent. No Anthropic OAuth.
---

# Clauxen chat agent

## Read first

- `src/server/agent-core/README.md`
- `src/server/agent-core/runtime/query-loop.ts`
- `src/components/agent/`

## Live path

```
POST /api/v1/chats/[chatId]/generate
  → @/server/agent-core runAgent / runAutonomousAgent
  → Provider_API_Key + Messages stream
  → Clauxen SSE
  → src/lib/agent-stream-reducer.ts
  → src/components/agent/* (DOM)
```

## Key paths

| Path | Role |
|------|------|
| `src/server/agent-core/` | Public agent API (Provider only) |
| `src/server/agent-core/runtime/query-loop.ts` | Loop implementation |
| `src/server/agent-core/provider/messages-client.ts` | Provider Messages client |
| `src/server/agent-core/tools/` | Tool catalog + executor re-exports |
| `src/server/inference/autonomous-tools/` | Tool implementations (sandbox, Exa, files) |
| `src/components/agent/` | Chat-view transcript UI |
| `src/server/agent-core/legacy-source/` | Stripped Claude remnants (not compiled) |

## Env

`Provider_API_Key`, `Provider_BASE_URL`, `Provider_Model_Clauxen_V1`

## Additional resources

- [reference.md](reference.md)
