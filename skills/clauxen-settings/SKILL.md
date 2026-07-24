---
name: clauxen-settings
description: >-
  Clauxen settings and personalization: hash overlays, settings tabs, AppPreferences, modular style .md, notifications optimistic toggles, profile fields. Use when editing settings UI, personalization, theme/font prefs, capabilities, or #settings overlays.
---

# Clauxen settings

## Read first

- `docs/systems/settings-and-personalization.md`
- `src/components/settings/constants.ts`

## Delivery

Hash overlays on parent: `#settings`, `#settings/Personalization`, …  
Legacy paths redirect to `/new#…`. Close overlay → stay on parent.

## Persistence

| Concern | Where |
|---------|--------|
| General | `user_settings.settings.general` |
| Personalization | `settings.personalization` |
| Names | `profiles.display_name` / `preferred_name` |

API: `GET/PATCH /api/v1/settings`.

## Hard rules

1. `AppPreferencesProvider` must **apply** prefs to DOM (not save-only).
2. Notifications: optimistic toggles — **no** PATCH response overwrite flicker.
3. Modular personalization under `src/prompts/personalization/` — no duplicate Personality row.
4. Follow-up system instruction only when follow-ups setting ON.
5. Chat fonts → `[data-assistant-content]` only.

## Additional resources

- [reference.md](reference.md)
