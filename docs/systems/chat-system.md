# Chat System

This document is the definitive deep dive into Clauxen chat: persistence, streaming, UI state, caching, branching, attachments, titles, transcripts, and stop/lease coordination.

---

## 1. Goals & UX principles

Clauxen chat aims for ChatGPT/Claude feel:

1. **Instant send** — optimistic bubbles appear immediately; URL swaps to `/c/{id}` as soon as the durable chat id exists (do not await message persist).
2. **No false shimmer** — no `loading.tsx` on `/new` or `/c/[chatId]`; SSR seed race ≤120ms; soft-nav keeps chat-view mounted.
3. **Stable keys** — messages carry `clientId` for React keys / streamKey / enter animation; DB id remaps must not remount turns.
4. **Stream owns the turn** — while this tab owns SSE, Supabase `chat_messages` Realtime is muted except id remaps (empty WAL updates must not clear the orb).
5. **Visible failures** — terminal SSE errors become visible assistant failure text; never blank “completed” assistants.
6. **Full-thread hydrate** — Worker-first `listAllChatMessages` limit 500; no scroll-up pagination UI.

---

## 2. Key files

| Concern | File |
|---|---|
| Client chat API | `src/frontend/hooks/use-chat-api.ts` |
| Local/guest chat | `src/frontend/hooks/use-chat.ts` |
| Session provider | `src/frontend/contexts/chat-session-context.tsx` |
| Chat view shell | `src/frontend/components/chat-view.tsx`, `chat-view-pane.tsx`, `chat-area.tsx` |
| Thread render | `src/frontend/components/conversation-thread.tsx` |
| Composer | `src/frontend/components/composer/*` |
| Dedupe | `src/frontend/lib/dedupe-chat-messages.ts` |
| Hydrate merge | `src/frontend/lib/hydrate-chat-messages.ts` |
| Device cache | `src/frontend/lib/device-chat-cache.ts` |
| Route seed | `src/frontend/lib/chat-route-seed.ts`, `src/backend/chat/load-chat-route-seed.ts` |
| Stream parse | `src/frontend/lib/chat-stream.ts` |
| Agent frames | `src/frontend/lib/agent-frames.ts`, `agent-stream-reducer.ts` |
| Follow-ups | `src/frontend/lib/follow-up-tags.ts` |
| Branch/edit | `src/frontend/lib/chat-branch.ts`, `branch-conversation.ts` |
| Generate API | `src/app/api/v1/chats/[chatId]/generate/route.ts` |
| Stop API | `src/app/api/v1/chats/[chatId]/generate/stop/route.ts` |
| Chat service | `src/backend/services/chat.service.ts` |
| Generation lease | `src/backend/chat/generation-registry.ts`, `chat-coord-client.ts` |
| History warm | `src/backend/chat/warm-history-cache.ts` |
| Sanitize branch | `src/backend/chat/sanitize-branch-messages.ts` |

---

## 3. Chat identity

### 3.1 Chat ids

- Column `chats.id` is **`text`**, not UUID-only.
- New chats use `generateChatId()` (long shareable string) with uniqueness check (`chat_id_exists` RPC / app validation).
- Legacy UUID strings still valid.
- Always validate route params with `requireChatIdParam`.

### 3.2 Message ids vs clientIds

- Server assigns durable message UUIDs (or text ids depending on migration state).
- Client assigns `clientId` at optimistic create time.
- React keys and stream association use `clientId` / `message-ui-key` helpers so remaps do not remount.
- Realtime remap of assistant id mid-stream must update the generation map; `appendMessageField` resolves by `clientId` so tokens are not written to a deleted id.

---

## 4. Data model (chat subset)

### 4.1 Tables

| Table | Purpose |
|---|---|
| `chats` | Chat metadata: title, model, project_id, owner, timestamps, soft-delete |
| `chat_messages` | Turn rows: role, content, content_json, status, parent/branch linkage |
| `chat_message_parts` | Structured parts (text, file attachments, tool payloads) |
| `chat_branches` | Branch metadata for edited forks |
| `pinned_chats` | User pin overrides |
| `chat_transcript_lines` | Training JSONL records (`role` + `message.content` parts) |
| `chat_transcripts_jsonl` | View aggregating one JSONL doc per chat |
| `conversation_shares` | Share tokens for `/share/[token]` |

### 4.2 Message `content_json` highlights

- Attachment metadata for UI reload
- `agent_ui` timing (Thought for / Worked for) for reload durability
- Tool frames / structured agent segments as needed by renderer

### 4.3 Status lifecycle

Typical assistant statuses: streaming → completed | error | cancelled.

`gc_stale_streaming_messages` RPC cleans abandoned streaming rows.

---

## 5. API surface (chat)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/chats` | List chats (server; Worker preferred for sidebar) |
| POST | `/api/v1/chats` | Create chat |
| GET | `/api/v1/chats/:chatId` | Chat metadata |
| PATCH/DELETE | `/api/v1/chats/:chatId` | Rename / delete |
| GET/POST | `/api/v1/chats/:chatId/messages` | List / append messages |
| POST | `/api/v1/chats/:chatId/generate` | SSE generation |
| POST | `/api/v1/chats/:chatId/generate/stop` | Request stop (coord DO) |
| PUT | `/api/v1/chats/:chatId/branches` | Persist branch state (`sanitizeBranchMessages`) |
| POST | `/api/v1/chats/:chatId/pin` | Pin / unpin |
| POST | `/api/v1/chats/:chatId/title` | Title update / generate |
| POST | `/api/v1/chats/:chatId/share` | Create/revoke share |
| GET | `/api/v1/chats/:chatId/transcript` | Export transcript JSONL |
| GET | `/api/v1/chats/search` | Search chats |
| GET | `/api/v1/share/:token` | Public share payload |

Legacy: `POST /api/chat`, `POST /api/chat/title` for unauthenticated/local fallback.

---

## 6. Generation lease & stop

Cross-isolate coordination uses **`clauxen-chat-coord`** Durable Object:

1. `beginChatGeneration(chatId)` → `POST /lease` with `{ chatId, leaseId }`.
2. Conflict → HTTP 409 `generation_in_progress` (never abort existing turn to start another).
3. Client stop → `POST /api/v1/chats/:id/generate/stop` → Worker `POST /stop`.
4. Stream loop polls / observes `stopRequested`.
5. `endChatGeneration` → `POST /release`.

Local `generation-registry` is a helper; the Durable Object is the authority across Vercel isolates.

---

## 7. Generate request body

`POST /api/v1/chats/:chatId/generate` accepts approximately:

```json
{
  "messages": [ /* sanitized conversation for model */ ],
  "turn": {
    "content": "user visible text",
    "modelContent": "optional model-facing text",
    "fileIds": ["…"],
    "userClientId": "…",
    "assistantClientId": "…"
  },
  "generateChatTitle": true,
  "chatModel": "optional override",
  "homerReasoningEffort": "optional"
}
```

Guards:

- Empty messages → 400
- Invalid turn clientIds → 400 `invalid_turn`
- Edge Config `maintenanceMode` → 503
- Lease conflict → 409

After stream setup, `after()` may enqueue title generation, cache warm, embeddings.

---

## 8. Client send pipeline (`use-chat-api`)

High-level sequence:

1. **Validate** attachments / empty input.
2. **Optimistic append** user + placeholder assistant with `clientId`s.
3. If new chat: **createChat**, fire `onChatCreated` → `useInstantNavigate` to `/c/{id}`.
4. Persist user message (and parts) — may continue in parallel with stream start depending on turn API shape.
5. Open EventSource/fetch SSE to generate.
6. Reduce stream events into message fields (tokens, thinking, tools, frames).
7. On terminal success: mark completed, write device cache, allow Realtime again.
8. On terminal error: persist visible failure text; do not leave blank completed row.
9. Title: may arrive via stream event or follow-up title API; tab title updates live (`New chat - Clauxen` → title).

### 8.1 New-chat specific rules

- Keep showing chat-view once messages/`activeChatId` exist even if URL still `/new`.
- Sidebar shimmer until chat id + first message land.
- Document title brand-only (`Clauxen`) until a real title exists.

### 8.2 Select chat rules

`handleSelectChat` must:

- Never let sparse SSR seed wipe optimistic/live turns.
- Skip SSR seed when chat is live or already hydrated.
- Prefer device cache then Worker reconcile.

---

## 9. Hydration & dedupe

### 9.1 Device cache

`device-chat-cache.ts`:

- Per-user IndexedDB namespace
- Mirrors recent chat list metadata
- Caches up to **40** chat bodies
- No polling — Realtime + silent SWR refresh
- Server remains source of truth

### 9.2 Worker hydrate

- Prefer `CHAT_HISTORY_WORKER_URL` / public URL with Bearer JWT
- Cache ladder: Cache API → KV → R2 → Hyperdrive
- Full thread up to 500 messages; rare mega-threads silently multi-page before paint
- SSR seed uses same path with `hasMore: false`

### 9.3 Dedupe scoring

`dedupe-chat-messages.ts` merges:

- Optimistic live rows
- Server snapshots
- Realtime patches
- IDB cold snapshots

**Critical rule:** live streaming assistant always wins over empty completed cold snapshots (otherwise orb dies on new-chat/follow-up).

### 9.4 Recents filter

`filterStartedRecentChats` must keep chats when local messages are `undefined` (not yet hydrated). Never treat “not hydrated” as empty — that hid all chats on reload.

### 9.5 RAM eviction

Inactive chat eviction omits `messageIds` keys (not `[]`) so Recents filter does not hide switched-away chats.

---

## 10. Agent activity transcript / orb

- One minimal chronological trace per assistant turn: `thinking → narration → tool → thinking … → final answer`.
- Thinking is a native Anthropic thinking block. Its model-authored `<agent_heading>` becomes the shimmering live label; the reasoning viewport auto-scrolls while open.
- Narration is tagged `<agent_narration>` text: concise user-visible progress, never final-answer content and never hidden reasoning.
- Tool rows use streamed structured input/output and rich result surfaces; failed tools persist `is_error`.
- The final answer is ordinary untagged assistant markdown outside the activity trace.
- Streaming orb stays visible during activity-only phases and hides once final answer markdown streams.
- `content_json.agent_ui.modelTurns` persists exact ordered Messages API rounds (including thinking signatures and tool-result users) so reload does not flatten the transcript.

Renderer: `assistant-content-renderer.tsx` + agent components under `components/agent/`.

---

## 11. Follow-up suggestions

1. Settings → Follow-up suggestions ON → inject `buildFollowUpSystemInstruction`.
2. Model emits `<prompt>…</prompt>` tags in markdown.
3. UI extracts via `follow-up-tags.ts` into dedicated buttons.
4. Never render as markdown `clauxen-prompt://` links — rehype-harden shows `[blocked]`.
5. Toggle OFF → strip tags to plain text and omit instruction.

---

## 12. Edit & branch

- User edit is **inline** (`UserMessageInlineEditor`) — no expand dialog.
- Attachments render inside the card; edit grows chips + bottom plus/mic/send (no model selector).
- Clear-all cancels edit.
- Send creates a branch via `editMessageWithBranch`.
- Sticky edit host uses same pin/unpin path as collapsed (`preventScroll` focus + blur on user viewport scroll).
- Click main `[data-component="agent-panel"]` (not sidebar) collapses edit.
- Branch PUT **must** use `sanitizeBranchMessages` (keeps ids/frames). Never `sanitizeMessages` for branch state — that stripped ids and caused reload duplicate assistants.

---

## 13. Attachments

Supported in composer: images, text docs, PDFs (chips).

Flow:

1. Presign → Worker PUT → complete
2. Link `fileIds` on turn / `chat_message_parts`
3. Metadata.attachments for UI reload
4. Model receives extracted text / vision payloads as configured by inference tools

Production requires `WORKER_URL` (Vercel body size limit).

---

## 14. Titles

- Inline strip / finalize helpers in `src/lib/chat-title.ts`
- Optional generate-on-first-turn
- Optimistic title updates; persist async
- Pin/rename/title: optimistic UI first; pin overrides stay until server list agrees (Hyperdrive/list cache lag)

Tab titles use hyphen: `New chat - Clauxen`.

---

## 15. Transcripts (training)

`chat_transcript_lines` stores Anthropic Messages-style JSONL records:

- `role` + ordered `message.content` parts: `text`, signed `thinking`, `redacted_thinking`, `tool_use`, `tool_result`
- Every client-tool round is persisted as the exact assistant block array followed immediately by a user-role `tool_result` array
- `turn_ended` markers
- View `chat_transcripts_jsonl` aggregates per chat
- Export: `GET /api/v1/chats/:chatId/transcript`
- Format builders: `src/backend/training/transcript-format.ts`

Failures to append transcript are logged as warnings — they must not fail the user-visible turn.

---

## 16. Realtime rules

| Channel | Use |
|---|---|
| `postgres_changes` on `chats` | Sidebar list silent refresh (no full-list re-shimmer) |
| `postgres_changes` on `chat_messages` | Hydrate other tabs; **muted** while local SSE owns generation |
| Broadcast | Typing / presence (`chat-presence-broadcast.ts`) — not WAL |

Id remaps during stream must update generation maps.

---

## 17. Pin / sidebar UX

- Sidebar selection highlight only on row container (avoid nested global `button[aria-current]` pill).
- Hover is one continuous pill; pin/menu actions never paint nested backgrounds.
- Recents shimmer on first list fetch only; realtime refresh is silent.

---

## 18. Stop generation

1. UI stop button → `POST .../generate/stop`
2. Coord DO marks `stopRequested`
3. Stream ends as cancelled
4. Assistant row shows cancelled/partial state appropriately
5. Lease released

---

## 19. Failure modes & mitigations

| Symptom | Likely cause | Mitigation |
|---|---|---|
| Blank completed assistant | SSE errors swallowed | Propagate terminal errors to UI text |
| Orb vanishes mid-turn | Empty Realtime WAL or cold snapshot wins dedupe | Mute Realtime; live stream wins scoring |
| Chat vanishes from Recents | Eviction wrote `messageIds: []` | Omit keys instead |
| Duplicate assistants on reload | Branch PUT used `sanitizeMessages` | Use `sanitizeBranchMessages` |
| 409 on send | Lease held | Stop or wait; do not force second lease |
| Upload fails on Vercel | Missing `WORKER_URL` | Deploy r2-gateway + set env |
| Post-create shimmer | `loading.tsx` or long SSR seed | Removed; seed ≤120ms |
| Scroll jumps back during generation | User wheel event masked by a recent programmatic follow scroll | User input cancels follow + sync-unpins immediately; stream follow uses eased JS scrolling |
| Scroll jumps upward while reading history | LOD downgraded without height lock; unpinned growth not compensated | Capture full height before `full→plain/placeholder`; preserve distance-from-bottom on resize |
| Older user bubble replaces the current sticky turn | Cached/hysteretic active-turn index or per-turn z-index escalation | Resolve the active turn every animation frame; only the active turn gets elevated z-index (`lib/chat-sticky.ts`) |
| Code/table header docks late or jumps | Header offset gated on JS pin attrs / narrow near-bottom band | CSS-first `top: calc(header + --turn-user-msg-height)` always; wider near-bottom band while generating |

---

## 20. Testing touchpoints

Unit/selfcheck tests under `src/frontend/lib/*.test.ts`:

- `dedupe-chat-messages.test.ts`
- `hydrate-chat-messages.test.ts`
- `device-chat-cache.test.ts`
- `chat-route-seed.test.ts`
- `follow-up-tags.test.ts`
- `chat-stream.test.ts`
- `agent-frames.test.ts`

Run: `npm test`.

---

## 21. Related

- [`inference-and-models.md`](./inference-and-models.md)
- [`cloudflare-workers.md`](./cloudflare-workers.md)
- [`realtime-and-caching.md`](./realtime-and-caching.md)
- [`frontend-architecture.md`](./frontend-architecture.md)
- [`../perf-architecture.md`](../perf-architecture.md)
