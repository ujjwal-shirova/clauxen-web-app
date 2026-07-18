---
name: clauxen-frontend
description: >-
  Clauxen frontend: ChatView, overlays, soft-nav, preferences, sidebar UX, providers, Tailwind/shadcn patterns. Use when editing React components under src/frontend, hash overlays (#settings/#pricing), useInstantNavigate, AppPreferences, sidebar hover/selection, or composer UI.
---

# Clauxen frontend

## Read first

- `docs/systems/frontend-architecture.md`
- `docs/systems/routing-and-navigation.md`
- `src/frontend/lib/app-routes.ts`

## Navigation

| Action | Mechanism |
|--------|-----------|
| Main surfaces | `useInstantNavigate` (pushState + soft Next) |
| Settings/pricing/gift/apps | `history.pushState` **hash** on parent |
| Close overlay | Clear hash; stay on parent |
| `/` | Soft-replace → `/new` (preserve hash) |

Legacy `/settings/*` `/upgrade` `/gift` `/apps` → `/new#…`.

## Overlay hosting

`AppOverlayHost` + `FullscreenPortal` → `document.body`  
(`.agent-panel` `translateZ(0)` traps `position: fixed`).

## Preferences

`AppPreferencesProvider` applies theme/font/motion/follow-ups to `<html>` and persists `settings.general`.  
Chat fonts style **`[data-assistant-content]` only**.

## Sidebar UX rules

- Selection highlight on **row container** only
- Hover = one continuous pill; pin/menu no nested hover wash
- First list fetch may shimmer; Realtime refresh is **silent**

## Streamdown

Load CSS idle via `StreamdownStyles` — **do not** re-import `streamdown/styles.css` in `(main)/layout`.

## Design note

When creating new marketing surfaces, follow user frontend design rules. Inside the existing app chrome, **preserve** established Clauxen patterns.

## Additional resources

- [reference.md](reference.md)
- `docs/reference/ui-component-catalog.md`
