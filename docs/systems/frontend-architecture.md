# Frontend Architecture

## 1. Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 App Router |
| UI | React 19, Tailwind CSS v4, shadcn/ui (Radix) |
| State | React context + Zustand (selective) + TanStack Query (where used) |
| Markdown | streamdown, react-markdown, remark-gfm, rehype-katex, rehype-harden |
| Motion | framer-motion (intentional, not noise) |
| Themes | next-themes + `.dark` CSS tokens |
| Forms | react-hook-form + zod |

Client code lives primarily under `src/`. Pages under `src/app/` are thin route shells.

---

## 2. Directory map

```
src/
  app/                 # minor app-level client helpers
  components/          # ~94 top-level TSX modules + subfolders
    agent/             # agent timeline / orb / frames
    agent-swarm/       # multi-agent visualization experiments
    app-notifications/ # push/email notification popover
    auth/              # login forms, OAuth buttons, OTP
    composer/          # chat input, attachments, mic
    customize/         # skills / connectors UI
    icons/             # brand / payment icons
    mascot/            # Clauxen mascot
    onboarding/        # first-run steps
    projects/          # project UI pieces
    settings/          # settings panes + constants
    ui/                # shadcn primitives
  contexts/            # providers
  hooks/               # ~27 hooks
  lib/                 # pure client utilities + tests
  stores/              # zustand stores
  styles/              # CSS modules / global fragments
  workers/             # browser workers if any
```

---

## 3. Providers tree (conceptual)

Typical `(main)` layout mounts (order matters for overlay/portal behavior):

1. Theme / next-themes
2. Auth provider (`auth-context`)
3. App preferences (`app-preferences-context`) — applies DOM attrs
4. Chat session (`chat-session-context` → `useChatApi`)
5. App overlays (`use-app-overlays`)
6. Artifact viewer context
7. Follow-up prompt context
8. Notifications
9. Shell layout (sidebar + main panel)
10. `AppOverlayHost` → `FullscreenPortal` to `document.body`

**Why portal?** `.agent-panel` uses `transform: translateZ(0)` which traps `position: fixed`. Overlays must portal to `document.body`.

---

## 4. Contexts

### 4.1 `auth-context.tsx`

- Boots with `GET /api/v1/auth/session?quiet=1` (local JWT/hint, no profile sync) for fast FCP
- Full session sync runs in background after first paint
- Exposes user, loading, sign-in/out helpers
- Works with Supabase browser client for OAuth

### 4.2 `chat-session-context.tsx`

- API-only: wires `useChatApi`
- Keeps local IndexedDB guest path (`useChat`) out of the main signed-in bundle
- Exposes active chat, messages, send, stop, select, pin, rename, branch APIs

### 4.3 `app-preferences-context.tsx`

Applies and persists:

| Pref | DOM effect | Storage |
|---|---|---|
| Theme light/dark/system | `class=dark` on `<html>` | `user_settings.settings.general` |
| Chat font | `data-chat-font` | same |
| Motion | data attrs / reduced motion | same |
| Follow-up chips | preference flag | same |

Chat fonts style **`[data-assistant-content]` only** — not app chrome labels.

Font loading: Inter + Playfair in root layout; other Google chat fonts on demand via `ChatFontLoader`.

### 4.4 Overlay / artifact / follow-up contexts

- Overlays: hash-driven modal surfaces
- Artifact viewer: side panel for generated artifacts
- Follow-up: coordinates prompt chip clicks → send

---

## 5. Critical hooks

| Hook | Role |
|---|---|
| `use-chat-api.ts` | Signed-in chat orchestration (large; SSE, hydrate, cache) |
| `use-chat.ts` | Guest/local storage chat |
| `use-instant-navigate.ts` | pushState + soft Next sync; restores hash after soft nav |
| `use-app-overlays.tsx` | Open/close overlays via `history.pushState` on `pathname#hash` |
| `use-auth.ts` | Auth helpers |
| `use-settings.ts` | Settings load/PATCH |
| `use-projects.ts` / `use-project-chat.ts` | Projects surfaces |
| `use-document-title.ts` | Live tab titles |
| `use-sidebar-state.ts` | Collapse/expand |
| `use-chat-scroll.ts` / `use-chat-scroll-activity.ts` | Stick-to-bottom, activity |
| `use-message-visibility.ts` | LOD / virtualization helpers |
| `use-message-enter-animation.ts` | Enter animations keyed by clientId |
| `use-ai-stream.ts` | Lower-level stream helpers |
| `use-artifacts.ts` | Artifacts library |
| `use-research.ts` | Research runs |
| `use-api-keys.ts` | `clx_…` key management UI |
| `use-app-notifications.tsx` | Push/Email toggles (optimistic; no PATCH response overwrite) |
| `use-checkout-currency.ts` | INR/USD checkout prefs |
| `use-keyboard-shortcuts.ts` | Shortcut map |
| `use-clear-auth-busy-on-return.ts` | Clears busy flags on bfcache return |

---

## 6. Chat UI composition

```
ChatView
├── ChatViewHeader (title, share, model)
├── ChatViewPane
│   ├── ConversationThread
│   │   ├── user bubbles (inline editor)
│   │   ├── assistant turns (orb + frames + markdown)
│   │   └── follow-up chips
│   ├── ChatArtifactsPanel (optional)
│   └── Composer
│       ├── attachment chips
│       ├── textarea
│       └── send / stop / plus
└── ChatRightRailControls (optional)
```

Supporting:

- `assistant-content-renderer.tsx` — markdown + hardened links + math
- `code-block.tsx` — syntax highlighting (`lib/syntax-highlight`)
- `chat-sources.tsx` — citations
- `share-dialog.tsx` — share link UI
- `chat-options-menu.tsx` / `chat-row-menu-content.tsx` — sidebar menus

### Performance LOD

- RAM message window (approx 24/48) for inactive regions
- Height-lock LOD for offscreen turns
- Overlay code-split
- Streamdown CSS idle-loaded via `StreamdownStyles` — do **not** re-import `streamdown/styles.css` in `(main)/layout`

---

## 7. Sidebar

- Pinned section + Recents
- First fetch: shimmer; realtime refresh: silent
- Row hover: single continuous pill
- Selection highlight: row container only
- Pin/menu: no nested hover backgrounds (global button:hover was splitting highlight)

---

## 8. Settings UI

Settings are primarily **hash overlays** on parent pages:

- `#settings`
- `#settings/Personalization`
- `#settings/Security`
- etc.

Legacy `/settings/[tab]` soft-redirects to `/new#settings/…`.

Tabs defined in `components/settings/constants.ts` (`settingsNav`):

General, Personalization, Notifications, Account, Security, Privacy, Billing, Storage, Capabilities, Reflect, Time and focus, Safety, Parental controls, Trusted contact, Clauxen Code, Keyboard, Skills, Connectors, Plugins.

Deep dive: [`settings-and-personalization.md`](./settings-and-personalization.md).

---

## 9. Auth UI

- Unified login at `/login` — Continue with Email checks existence → password login **or** create + OTP
- Magic link signup label under email (new users): 5-min link → `/auth/magic` set-password → onboarding
- OAuth buttons: Google, GitHub, GitLab (product preference; Apple/X may exist in code but login UI preference varies — see MEMORY)
- Clickable auth labels use `.auth-text-link` (no button hover wash)
- `/signup` redirects to `/login`

---

## 10. Checkout UI

Components under `checkout-*.tsx`:

- Currency selector (INR/USD)
- UPI QR modal (INR-only; prefer browser India heuristic over geo that wrongly hides UPI)
- Card form, Apple Pay association route
- Local UPI/card SVG icons — **no** Stripe/logo CDNs
- Preparing / error banners

---

## 11. Navigation patterns

See [`routing-and-navigation.md`](./routing-and-navigation.md).

Summary:

| Action | Mechanism |
|---|---|
| Main surface change | `useInstantNavigate` |
| Open settings/pricing | `history.pushState` hash on current parent |
| Close overlay | Clear hash; stay on parent |
| Home | `/` → soft replace `/new` |
| New chat send | Navigate to `/c/{id}` instantly on durable id |

---

## 12. Styling conventions

- Design tokens via CSS variables; dark class `.dark`
- Avoid generic AI aesthetic traps when creating new marketing surfaces (see user frontend design rules)
- Existing app chrome should preserve established Clauxen patterns
- Global button hover CSS is dangerous inside composite rows — scope carefully

---

## 13. Telemetry & UX helpers

- `client-telemetry.tsx` — client analytics hooks
- `client-toaster.tsx` — sonner toasts
- `chunk-load-recovery.tsx` — recover from stale chunk errors after deploy
- `use-minimum-loading.ts` — avoid flash of empty loading states

---

## 14. Testing

Frontend lib tests via `tsx --test`:

```bash
npm test
```

Prefer testing pure lib modules (dedupe, hydrate, follow-up tags, route seed) over brittle component snapshots.

---

## 15. Related

- [`chat-system.md`](./chat-system.md)
- [`routing-and-navigation.md`](./routing-and-navigation.md)
- [`../reference/ui-component-catalog.md`](../reference/ui-component-catalog.md)
