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
| Ask user input  | `src/lib/pending-ask-user-input.ts` + `src/components/agent/ask-user-input-card.tsx`                                        |
| Agent UI        | `src/components/agent/agent-orchestration.tsx`, `agent-work-group.tsx`, `agent-tool-blocks.tsx`, `agent-thinking-phase.tsx` |
| Lease           | `src/server/chat/generation-registry.ts`, `chat-coord-client.ts`                                                            |
| Dedupe          | `src/lib/dedupe-chat-messages.ts`                                                                                           |
| Hydrate         | `src/lib/hydrate-chat-messages.ts`                                                                                          |
| Device cache    | `src/lib/device-chat-cache.ts`                                                                                              |
| Branch sanitize | `src/server/chat/sanitize-branch-messages.ts`                                                                               |
| Follow-ups      | `src/lib/follow-up-tags.ts`                                                                                                 |




## Agent transcript architecture (work-group timeline)

- Per-round model text **before** tool calls streams as `narration` segments; a round with **no tool calls** is promoted to the durable answer via SSE `answer_finalize` (reducer marks the segment `isFinal` and sets `message.content` — restyle in place, never teleport).
- No model-authored XML protocol (deleted `<agent_heading>`/`<agent_narration>`/`answer_clear`/intro+interim narratives). Sole exception: first-turn `<chat_title>` for the sidebar, stripped client-side.
- **Flat agent ledger** (`groupAgentWorkItems`): narration outside; every thinking/tool step renders bare flush-left (no aggregate fold / rail / dots). Live rows use dark verb shimmer + light-gray detail; Analyzing expands via hover chevron into a theme-aware terminal.
- **Narration stays outside activity steps** — quiet prose between tools, never nested under a timeline header. Final answer always renders below the activity stack. The promoted `isFinal` narration never duplicates as mid-turn prose.
- **`ask_user_input_v0`**: timeline shows compact "Asked for your input"; the interactive `AskUserInputCard` **replaces the composer** via `findPendingAskUserInput` (reads `tool.args.questions`).
- Web search rows: hover the **entire** “Searched the web … N sources” label for a Cursor-compact scrollable sources popover (not only the badge). Inline citation chips convert live during stream; paren/comma clusters around chips are unwrapped (`unwrapCitationLinkDecorators`). The assistant action bar's Sources button stays completion-gated.
- Follow-up `<prompt>` chips are sanitized (`follow-up-tags.ts`): agent narration echoes (`Let me…`, `I'll…`) and dupes never render as suggestions.
- Turn pairing self-heals in `dedupeChatMessages` (store bridge + thread): duplicate user bubbles collapse at any distance (temp/durable + clientId + 2-min timestamp window), and order is healed by createdAt with user-before-assistant on equal persisted timestamps so a user bubble can never land below its own answer.
- Activity **verbs** shimmer only while that step runs (detail stays light gray outside `.shimmer-text`); descendants of `.shimmer-text[data-shimmer-active]` are forced transparent so tone classes don't paint over the gradient.
- Nested scrolling is axis-aware (`src/lib/nested-scroll.ts`): chat viewport owns vertical scroll; x-only / passthrough agent chrome + source chips/previews never swallow vertical deltas; only the create-file stream pane and web-search popover list are intentional nested y-scrollers.
- Dictation: while `connecting`, keep the normal composer and show a spinner on the mic button — do not swap in the “Connecting dictation…” surface. Listening / cancel / check appear only after connect.
- Premature SSE close soft-completes (legacy + UI-message paths); generate keepalives every 5s; do not paint "Connection was interrupted" when useful tokens/tools already rendered.
- **TTFT:** `beginChatGeneration` claims the local map instantly and returns without awaiting chat-coord DO; SSE `start` flushes before Supabase `beginChatTurn` / ownership RTT; DO lease is awaited inside `resolveContext` (and gates turn insert) so cross-isolate single-writer still holds. History/personalization soft-budgeted (~120ms). Durable ids via `turn_ready`.
- Every generate injects `<current_datetime>` (client IANA timezone + server clock) so the model knows today's day/date/year for web search.
- MCP servers come from env `CLAUXEN_MCP_SERVERS` (JSON array of `{id,url,headers?}`); tools appear as `mcp__<serverId>__<toolName>` and render via `AgentMcpToolBlock` inside work-group timeline rows.
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

