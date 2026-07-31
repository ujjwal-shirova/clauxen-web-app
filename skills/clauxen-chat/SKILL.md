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




## Agent transcript architecture (2026-07-31 unified timeline)

- Per-round model text **before** tool calls streams as `narration` segments; a round with **no tool calls** is promoted to the durable answer via SSE `answer_finalize` (reducer marks the segment `isFinal` and sets `message.content` — restyle in place, never teleport).
- No model-authored XML protocol (deleted `<agent_heading>`/`<agent_narration>`/`answer_clear`/intro+interim narratives). Sole exception: first-turn `<chat_title>` for the sidebar, stripped client-side.
- **ONE main timeline per assistant turn** (`AgentMainTimeline` in `agent-orchestration.tsx`): a round-dot fold header that holds narration prose, thinking phases, searches, tool calls, and MCP connector calls as chronological rows on the rail. While any step runs, the header shimmers the live step label (`deriveLiveActivityLabel`) and stays expanded; once the answer takes over it collapses to `N steps · Ns` (hover chevron; user toggles stick).
- Narration is its own transcript row (quiet prose with a rail dot) — separate from interleaved thinking (`Thought for Ns`, muted, hover-only chevron) and from the final answer, which always renders **below** the timeline. The promoted `isFinal` narration never duplicates inside the timeline.
- Web search rows show favicons + **"N sources"** hover popover; the bottom **source chip strip renders in real time** as soon as search results land (no completion gate) with `data-sources-live` enter animation. The assistant action bar's Sources button stays completion-gated.
- Follow-up `<prompt>` chips are sanitized (`follow-up-tags.ts`): agent narration echoes (`Let me…`, `I'll…`) and dupes never render as suggestions.
- Turn pairing self-heals in `dedupeChatMessages` (store bridge + thread): duplicate user bubbles collapse at any distance (temp/durable + clientId + 2-min timestamp window), and order is healed by createdAt with user-before-assistant on equal persisted timestamps so a user bubble can never land below its own answer.
- Activity labels shimmer **only while that step runs**; descendants of `.shimmer-text[data-shimmer-active]` are forced transparent so tone classes don't paint over the gradient.
- Nested scrolling is axis-aware (`src/lib/nested-scroll.ts`): x-only code/table blocks must never swallow vertical deltas; JS only preventDefaults when an intermediate scroller is pinned at its end.
- Premature SSE close soft-completes (legacy + UI-message paths); generate keepalives every 5s; do not paint "Connection was interrupted" when useful tokens/tools already rendered.
- Every generate injects `<current_datetime>` (client IANA timezone + server clock) so the model knows today's day/date/year for web search.
- MCP servers come from env `CLAUXEN_MCP_SERVERS` (JSON array of `{id,url,headers?}`); tools appear as `mcp__<serverId>__<toolName>` and render via `AgentMcpToolBlock` inside the same timeline.
- Skills load from the bundled `skills-pack/` directory only — never developer-homedir paths.



## Hard rules

1. **clientId** for React keys / stream — DB id remaps must not remount.
2. **No** `loading.tsx` on `/new` or `/c/[chatId]`.
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

