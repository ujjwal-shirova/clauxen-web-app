# Settings and Personalization

## 1. Information architecture

Hybrid Claude + ChatGPT settings (no Voice). Tabs in `settingsNav`:

| Tab | Focus |
|---|---|
| General | Theme, chat font, motion, follow-up chips |
| Personalization | Style, characteristics, custom instructions, memory note |
| Notifications | Push / Email toggles |
| Account | Profile, sessions |
| Security | MFA / sign-in activity |
| Privacy | Export / delete / archive |
| Billing | Plan / invoices |
| Storage | Quota |
| Capabilities | Web search, canvas, connector search, memory generate |
| Reflect | Reflect features |
| Time and focus | Focus prefs |
| Safety / Parental / Trusted contact | Safety suite |
| Clauxen Code | Code product prefs |
| Keyboard | Shortcuts |
| Skills / Connectors / Plugins | Extensibility |

Conflicts resolved intentionally (see constants comment): Memory generate → Capabilities; export/delete → Privacy; Apps → Connectors only; Notifications own tab.

---

## 2. Delivery mechanism

Primary UX: **hash overlays** on parent (`/new`, `/c/…`):

- `#settings`
- `#settings/Personalization`
- `#pricing`, `#gift`, `#apps`

Legacy `/settings/*`, `/upgrade`, `/gift`, `/apps` soft-redirect to `/new#…`.

Closing overlay stays on parent page.

---

## 3. Persistence

| Concern | Storage |
|---|---|
| General prefs | `user_settings.settings.general` |
| Personalization | `user_settings.settings.personalization` |
| Capabilities | settings JSONB + capabilities flags |
| Profile names | `profiles.display_name`, `preferred_name` |
| Notifications | optimistic local + settings / notification_preferences |

API: `GET/PATCH /api/v1/settings` (+ specialized security/storage/data routes).

`AppPreferencesProvider` applies theme/font/motion/follow-ups to `<html>` and persists.

Notifications: row-click toggles; persist optimistic — **do not** overwrite UI from slow PATCH response (fixes 2–4s flicker).

---

## 4. Personalization → model

Modular markdown under `src/prompts/personalization/`:

- `base-style/` — default, efficient, candid, professional, quirky, cynical, friendly
- `warm/`, `enthusiastic/`, `headers-lists/`, `emoji/` — each More|Default|Less

Loaded by `personalization-style-instructions.ts`.

Custom instructions + occupation append via `user-personalization.service.ts` into `buildModelSystemPrompt({ append })`.

Follow-ups: `follow-up-settings.service.ts` + `buildFollowUpSystemInstruction`.

---

## 5. Profile fields mapping

| UI | DB |
|---|---|
| Full name | `profiles.display_name` |
| Nickname | `profiles.preferred_name` |
| Occupation | personalization JSON |
| Custom instructions | personalization JSON |

Onboarding name/role hydrate settings.

---

## 6. Related UI files

- `src/components/settings/*`
- `src/hooks/use-settings.ts`
- `src/lib/settings-defaults.ts`
- `src/contexts/app-preferences-context.tsx`
- `src/components/chat-font-loader.tsx`

---

## 7. Related

- [`inference-and-models.md`](./inference-and-models.md)
- [`routing-and-navigation.md`](./routing-and-navigation.md)
- [`authentication.md`](./authentication.md)
