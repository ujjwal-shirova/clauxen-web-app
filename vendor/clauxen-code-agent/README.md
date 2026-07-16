# Clauxen Code agent (vendored)

Copied from `Clauxen Code CLI/src` for the Clauxen Web App agent platform.

## What was copied

| Path | Role |
|------|------|
| `core/` | QueryEngine, query loop, Tool contract, tasks |
| `services/api/` | Anthropic streaming client (CLI) |
| `services/tools/` | StreamingToolExecutor, tool orchestration |
| `tools/` | Full tool catalog (Bash, Grep, WebSearch, …) |
| `types/`, `constants/`, `schemas/` | Message / tool schemas |
| `memory/`, `skills/`, `tasks/` | Agent memory & skills |
| `utils/` (selected) | messages, collapseReadSearch, groupToolUses, format, tool* |

**Not copied:** Ink terminal UI (`src/ui`), vim, voice, buddy, gateway OpenAI proxy.

## How the web app uses this

Runtime integration is **Anthropic Messages API only** via:

- `src/backend/inference/anthropic-messages-client.ts`
- `src/backend/inference/agent-engine.ts` (loop + SSE frames for Worked-for timeline)

This vendor tree is the **reference implementation** of Clauxen Code’s agent OS. The web engine ports its loop (stream → tools → tool_result → repeat) onto `@anthropic-ai/sdk` and the existing Clauxen SSE / timeline UI.

Do **not** import Ink/bun modules from this tree into Next.js routes directly — use the web inference adapters above.
