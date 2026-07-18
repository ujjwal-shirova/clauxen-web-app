# Architecture reference

## Hot paths

1. **New chat send:** optimistic UI → createChat → DO lease → SSE → invalidate/warm → `after()` title/embed
2. **Open `/c/[id]`:** IndexedDB → SSR seed ≤120ms → silent Worker reconcile
3. **Sidebar:** device meta → Worker list + Realtime + DO generating hint
4. **Files:** browser → r2-gateway → R2; Postgres metadata only

## Canonical conventions

1. Server-only `Provider_*` secrets
2. Hash overlays (`#settings/…`) not path overlays
3. Chat ids are **text** (`generateChatId`)
4. Optimistic pin/rename/title; reconcile with server
5. SSE owns turn; mute Realtime messages mid-stream (except id remaps)
6. Verified commits required for Vercel

## Docs index

See `docs/README.md`.
