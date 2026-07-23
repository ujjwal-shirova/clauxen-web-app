---
name: clauxen-realtime-cache
description: >-
  Clauxen realtime and caching: device IndexedDB, chat-history Worker ladder, Realtime mute rules, invalidate/warm, static CDN headers. Use when changing hydrate caching, Realtime subscriptions, or performance of list/open chat.
---

# Clauxen realtime & cache

## Read first

- `docs/systems/realtime-and-caching.md`
- `docs/perf-architecture.md`
- `docs/perf-metrics.md`

## Layers

Browser IDB (list meta only) → Worker Cache API → KV → R2 archives → Hyperdrive → Postgres  
Warm/archive via CF Queues (`HISTORY_JOBS`) when available.  
Plus Vercel Runtime Cache / Edge Config for non-chat memo/flags.

## Hard rules

1. Do not zone-cache app HTML shells.
2. Do not poll chat list/messages.
3. Mute `chat_messages` Realtime while local SSE owns generation (except id remaps).
4. Sidebar Realtime refresh is silent (no full-list re-shimmer).
5. After writes: Worker invalidate + enqueue/warm; update IDB **list meta only** (no message bodies).
6. Do not duplicate the same content cache on KV and Runtime Cache without an invalidation plan.
7. Keep Hyperdrive caching disabled for chat history read-after-write consistency.

## Key files

`device-chat-cache.ts`, `warm-history-cache.ts`, `chat-presence-broadcast.ts`  
`workers/chat-history/`

## Additional resources

- Skill `clauxen-cloudflare-workers`
- Skill `clauxen-chat`
