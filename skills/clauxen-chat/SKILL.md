---
name: clauxen-chat
description: >-
  Clauxen chat system: send, SSE streaming, hydrate, dedupe, device cache, branches, follow-ups, agent orb/frames, leases, stop. Use when working on chat UI, use-chat-api, generate routes, streaming bugs, orb, follow-ups, pin/title, attachments in chat, or /c/[chatId] behavior.
---

# Clauxen chat

## Read first

- `docs/systems/chat-system.md`
- Gotchas: `docs/reference/gotchas-encyclopedia.md` (chat section)
- MEMORY decisions about SSE / Realtime / dedupe / clientId

## Key files

| Concern         | Path                                                                                                                        |
| --------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Client API      | `src/hooks/use-chat-api.ts`                                                                                                 |
| Session         | `src/contexts/chat-session-context.tsx`                                                                                     |
| Generate        | `src/app/api/v1/chats/[chatId]/generate/route.ts`                                                                           |
| Stop            | `.../generate/stop/route.ts`                                                                                                |
| Service         | `src/server/services/chat.service.ts`                                                                                       |
| Agent loop      | `src/server/agent-core/runtime/query-loop.ts`                                                                               |
| Agent prompt    | `src/prompts/clauxen.md`                                                                                                    |
| SSE writer      | `src/server/inference/clauxen-sse-stream.ts`                                                                                |
| MCP harness     | `src/server/mcp/{types,client,registry}.ts`                                                                                 |
| Skills catalog  | `src/server/inference/autonomous-tools/skill-catalog.ts` + `skills-pack/`                                                   |
| Stream reducer  | `src/lib/agent-stream-reducer.ts`                                                                                           |
| Work groups     | `src/lib/agent-work-groups.ts` + `src/lib/agent-activity-labels.ts`                                                         |
| Agent UI        | `src/components/agent/agent-orchestration.tsx`, `agent-work-group.tsx`, `agent-tool-blocks.tsx`, `agent-thinking-phase.tsx` |
| Lease           | `src/server/chat/generation-registry.ts`, `chat-coord-client.ts`                                                            |
| Dedupe          | `src/lib/dedupe-chat-messages.ts`                                                                                           |
| Hydrate         | `src/lib/hydrate-chat-messages.ts`                                                                                          |
| Device cache    | `src/lib/device-chat-cache.ts`                                                                                              |
| Branch sanitize | `src/server/chat/sanitize-branch-messages.ts`                                                                               |
| Follow-ups      | `src/lib/follow-up-tags.ts`                                                                                                 |

## Agent transcript architecture (2026-07-29 rebuild)

- Per-round model text **before** tool calls streams as `narration` segments; a round with **no tool calls** is promoted to the durable answer via SSE `answer_finalize` (reducer marks the segment `isFinal` and sets `message.content` — restyle in place, never teleport).
- No model-authored XML protocol (deleted `<agent_heading>`/`<agent_narration>`/`answer_clear`/intro+interim narratives). Sole exception: first-turn `<chat_title>` for the sidebar, stripped client-side.
- Work-group headers are **Cursor-style tool-mix summaries** for multi-step work (`Edited N files, 1 search, ran 1 command` with muted verbs + brighter counts + green/red diffs); single-step groups may still use narration-derived labels. Narration **always** renders as standalone prose **outside** the timeline — never nested inside a group body.
- Group headers have **no chevron**; children are flush-left (no tree rail). Thinking uses muted `Thought for Ns` with chevron **hover-only** (stays visible while expanded); body is plain text (no card).
- Web search stays as a single row; favicon chips + **"N sources"** open a **hover popover** (scrollable sources) — no expanded results list in the timeline.
- Fold chrome only for thinking+tool(s) or 2+ tools; lone Thought/tool stay bare. Group headers shimmer while any member runs and auto-collapse on completion.
- Expand/collapse scroll-anchors through the CSS transition so the body grows **downward** (user bubble does not jump up).
- Citation chips render **inline while streaming**; the bottom source strip + Sources action button appear only **after the turn finishes** (`!isStreaming`).
- Premature SSE close soft-completes (legacy + UI-message paths); generate keepalives every 5s; do not paint "Connection was interrupted" when useful tokens/tools already rendered.
- Every generate injects `<current_datetime>` (client IANA timezone + server clock) so the model knows today's day/date/year for web search.
- MCP servers come from env `CLAUXEN_MCP_SERVERS` (JSON array of `{id,url,headers?}`); tools appear as `mcp__<serverId>__<toolName>`.
- Skills load from the bundled `skills-pack/` directory only — never developer-homedir paths.

## Hard rules

1. **clientId** for React keys / stream — DB id remaps must not remount.
2. **No `loading.tsx`** on `/new` or `/c/[chatId]`.
3. Navigate to `/c/{id}` **as soon as** durable chat id exists.
4. While this tab owns SSE: **mute** `chat_messages` Realtime except id remaps.
5. Live streaming assistant **wins** over empty cold snapshots in dedupe.
6. Terminal SSE errors → **visible** assistant failure text (never blank completed).
7. Branch PUT → `sanitizeBranchMessages` only (not `sanitizeMessages`).
8. Follow-ups: extract `<prompt>` tags to buttons — never `clauxen-prompt://` links.
9. Recents: `undefined` messages ≠ empty — keep chat in list.
10. RAM eviction: **omit** `messageIds` keys (do not write `[]`).
11. Single agent activity frame per turn; persist `agent_ui` on `content_json`.
12. Lease via chat-coord DO; 409 if already generating — never force second lease.

## Checklist when changing chat

- [ ] Optimistic + clientId stable
- [ ] Errors visible
- [ ] Realtime mute still correct
- [ ] Dedupe scoring: live stream wins
- [ ] Device cache + Worker invalidate/warm
- [ ] Tests under `src/lib/*.test.ts` if lib logic changed

## Additional resources

- [reference.md](reference.md)
- [examples.md](examples.md)
