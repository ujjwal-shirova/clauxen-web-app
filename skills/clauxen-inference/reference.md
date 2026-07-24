# Inference reference

## Autonomous agent

Live loop: `@/server/agent-core` → `runtime/query-loop.ts` → Provider Messages → SSE → `src/components/agent/*`.

## Titles

Prefer `after()` / background jobs so title work stays off TTFT critical path.
