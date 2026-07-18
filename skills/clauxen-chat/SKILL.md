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

| Concern | Path |
|---------|------|
| Client API | `src/frontend/hooks/use-chat-api.ts` |
| Session | `src/frontend/contexts/chat-session-context.tsx` |
| Generate | `src/app/api/v1/chats/[chatId]/generate/route.ts` |
| Stop | `.../generate/stop/route.ts` |
| Service | `src/backend/services/chat.service.ts` |
| Lease | `src/backend/chat/generation-registry.ts`, `chat-coord-client.ts` |
| Dedupe | `src/frontend/lib/dedupe-chat-messages.ts` |
| Hydrate | `src/frontend/lib/hydrate-chat-messages.ts` |
| Device cache | `src/frontend/lib/device-chat-cache.ts` |
| Branch sanitize | `src/backend/chat/sanitize-branch-messages.ts` |
| Follow-ups | `src/frontend/lib/follow-up-tags.ts` |

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
- [ ] Tests under `src/frontend/lib/*.test.ts` if lib logic changed

## Additional resources

- [reference.md](reference.md)
- [examples.md](examples.md)
