---
name: clauxen-autonomous-agent
description: >-
  Clauxen autonomous agent loop: no-system-prompt tool steering, normalized events, bridge into main chat, standalone SSE/WS APIs. Use when editing src/autonomous-agent, agent tools, skill catalog, or agent stream bridging.
---

# Clauxen autonomous agent

## Read first

- `docs/systems/autonomous-agent.md`
- `src/autonomous-agent/README.md`

## Model

No system prompt. Tools steer. `read_skill` before code/file writes. Stop when turn has no tool calls.

## Integration

Main chat generate may bridge via `clauxen-bridge` when search/thinking enabled.  
Standalone: `/api/autonomous-agent/conversations/.../stream`  
WS: `npm run autonomous-agent:ws`

## Key paths

`server/stream/*`, `server/tools/`, `server/logic/tool-steering.ts`, `client/stream-reducer.ts`

## UI mapping

Keep **one** activity frame; map Reasoning/Tool/Text events to orb + Thought/Worked labels (`clauxen-chat` skill).

## Additional resources

- [reference.md](reference.md)
