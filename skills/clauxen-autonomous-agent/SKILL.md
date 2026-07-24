---
name: clauxen-autonomous-agent
description: >-
  Clauxen chat agent loop and transcript UI. Live path is src/server/inference (agent-engine + autonomous-tools) streaming into src/components/agent. Legacy src/autonomous-agent / agent-ui /api/autonomous-agent packages were removed.
---

# Clauxen chat agent

## Read first

- `docs/systems/autonomous-agent.md` (may be historical)
- `src/server/inference/agent-engine.ts`
- `src/components/agent/`

## Live path

```
POST /api/v1/chats/[chatId]/generate
  → src/server/inference/agent-engine.ts
  → Clauxen SSE
  → src/lib/agent-stream-reducer.ts
  → src/components/agent/* (trace / folds / tools)
```

## Key paths

| Path | Role |
|------|------|
| `src/server/inference/agent-engine.ts` | Tool loop + SSE frames |
| `src/server/inference/autonomous-tools/` | Tool definitions + executor |
| `src/lib/agent-stream-reducer.ts` | Client event → frames/segments |
| `src/components/agent/` | Chat-view agent UI |

## Removed

- `src/autonomous-agent/`, `src/app/agent-ui/`, `/api/autonomous-agent/**`
- Claude Code dump under `src/app/agent/`

## Additional resources

- [reference.md](reference.md)
