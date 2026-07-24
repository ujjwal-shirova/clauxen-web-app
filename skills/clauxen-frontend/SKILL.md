---
name: clauxen-frontend
description: >-
  Clauxen UI: ChatView, overlays, soft-nav, preferences, sidebar UX, providers, Tailwind/shadcn patterns. Use when editing React under src/components or src/hooks, hash overlays (#settings/#pricing), useInstantNavigate, AppPreferences, sidebar hover/selection, or composer UI.
---

# Clauxen frontend

## Read first

- `docs/systems/frontend-architecture.md`
- `docs/systems/routing-and-navigation.md`
- `src/lib/app-routes.ts`

## Layout

| Path | Role |
|------|------|
| `src/components/` | All product UI |
| `src/components/agent/` | Chat-view agent transcript (trace, folds, tools) |
| `src/hooks/` | Client hooks |
| `src/lib/` | Client helpers + stream reducers |
| `src/contexts/`, `src/stores/` | Providers / stores |

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

## Additional resources

- [reference.md](reference.md)
