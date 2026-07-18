# Chat reference

## Hydrate order

1. Device IndexedDB (if warm)
2. SSR seed ≤120ms
3. Silent Worker `listAllChatMessages` (limit 500)
4. Never let sparse seed wipe live/optimistic turns

## Agent frame UX

- Orb visible during timelines; hide when answer markdown streams
- Live: `Label · duration`
- Thinking-only → `Thought for Ns`
- Tools → `Worked for …`

## Attachments

Presign → Worker PUT (Bearer JWT) → complete → `fileIds` on turn + `chat_message_parts`.

Production requires `WORKER_URL`.
