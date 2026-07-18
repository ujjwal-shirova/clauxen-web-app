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

Browser IDB → Worker Cache API → KV → R2 archives → Hyperdrive → Postgres  
Plus Vercel Runtime Cache / Edge Config for non-chat memo/flags.

## Hard rules

1. Do not zone-cache app HTML shells.
2. Do not poll chat list/messages.
3. Mute `chat_messages` Realtime while local SSE owns generation (except id remaps).
4. Sidebar Realtime refresh is silent (no full-list re-shimmer).
5. After writes: Worker invalidate + warm; update device cache.
6. Do not duplicate the same content cache on KV and Runtime Cache without an invalidation plan.

## Key files

`device-chat-cache.ts`, `warm-history-cache.ts`, `chat-presence-broadcast.ts`  
`workers/chat-history/`

## Additional resources

- Skill `clauxen-cloudflare-workers`
- Skill `clauxen-chat`
