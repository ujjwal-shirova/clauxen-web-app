# Routing and Navigation

## 1. Canonical routes

Defined in `src/frontend/lib/app-routes.ts`.

### Main (real Next routes — keep mounted)

| Path | Surface |
|---|---|
| `/` | Boot → soft-replace `/new` (hash preserved) |
| `/new` | Blank chat |
| `/c/[chatId]` | Existing chat |
| `/library` | Library |
| `/projects`, `/projects/[id]`, `…/conversations/[convId]` | Projects |
| `/customize`, `/customize/skills`, `/customize/connectors` | Customize |

### Auth / marketing / legal

| Path | Surface |
|---|---|
| `/login` | Unified login |
| `/signup` | Redirect → login |
| `/onboarding` | First-run |
| `/auth/callback`, `/auth/confirm`, `/auth/magic`, `/auth/reset-password` | Auth handlers/pages |
| `/about` | About |
| `/legal/privacy`, `/legal/terms` | Legal |
| `/share/[token]` | Public share |
| `/checkout/[merchant]/[sessionId]` | Hosted checkout |

### Legacy overlay paths (redirect to hash)

`/settings`, `/settings/[tab]`, `/upgrade`, `/pricing`, `/gift`, `/apps` → `/new#…` (or parent + hash).

---

## 2. Hash overlays (ChatGPT-style)

Overlays are **fragments**, not Next navigations:

| Hash | Overlay |
|---|---|
| `#settings` | Settings General |
| `#settings/Personalization` | Settings tab |
| `#pricing` / `#upgrade` | Pricing |
| `#gift` | Gift |
| `#apps` | Apps |

Helpers:

- `parseOverlayHash` / `overlayToHash`
- `buildOverlayLocation(overlay, parentPathname)`
- `parseOverlayPath` / `overlayToPath` (legacy)

Open must be instant: `AppOverlaysProvider` uses `history.pushState` on `pathname#hash` (not path replacement).

Host via `AppOverlayHost` + `FullscreenPortal` → `document.body` (agent-panel transform traps fixed).

---

## 3. Soft navigation

`useInstantNavigate`:

1. `history.pushState` immediately (optimistic URL)
2. Soft Next.js sync underneath
3. Restore hash after soft nav when needed

Used for library/projects/customize/chats so the shell does not flash.

---

## 4. New chat path helpers

- `isNewChatPath` → `/`, `/new`, `''`
- `isMainAppPath` → main surfaces excluding legacy overlay paths

While sending from `/new`, keep chat-view once messages/activeChatId exist; navigate to `/c/{id}` when durable id ready.

---

## 5. No loading.tsx on chat routes

Decision: no `loading.tsx` on `/new` or `/c/[chatId]`. Combined with seed race ≤120ms, prevents post-create shimmer and keeps optimistic chat-view across soft-nav.

---

## 6. Proxy matcher

`src/proxy.ts` matches all non-static paths; skips `/api` session refresh; converts CF challenge POSTs.

---

## 7. Related

- [`frontend-architecture.md`](./frontend-architecture.md)
- [`chat-system.md`](./chat-system.md)
