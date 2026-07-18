# Repository Map

Auto-oriented map of server repositories, services, and major frontend modules.
Generated to stay aligned with the tree as of documentation rewrite 2026-07-17.

## Backend repositories (`src/backend/repositories/`)

- `api-keys.repository.ts` — api keys data access
- `artifacts.repository.ts` — artifacts data access
- `billing.repository.ts` — billing data access
- `branches.repository.ts` — branches data access
- `chat-message-parts.repository.ts` — chat message parts data access
- `chats.repository.ts` — chats data access
- `connected-accounts.repository.ts` — connected accounts data access
- `customize.repository.ts` — customize data access
- `data-controls.repository.ts` — data controls data access
- `gifts.repository.ts` — gifts data access
- `messages.repository.ts` — messages data access
- `onboarding.repository.ts` — onboarding data access
- `pinned-chats.repository.ts` — pinned chats data access
- `profile.repository.ts` — profile data access
- `project-chats.repository.ts` — project chats data access
- `project-files.repository.ts` — project files data access
- `projects.repository.ts` — projects data access
- `research.repository.ts` — research data access
- `settings.repository.ts` — settings data access
- `shares.repository.ts` — shares data access
- `transcript.repository.ts` — transcript data access
- `user-files.repository.ts` — user files data access
- `user-skills.repository.ts` — user skills data access
- `workspaces.repository.ts` — workspaces data access

## Backend services (`src/backend/services/`)

- `auth-credentials.service.ts`
- `auth-email-otp.service.ts`
- `billing.service.ts`
- `chat.service.ts`
- `data-controls.service.ts`
- `files.service.ts`
- `follow-up-settings.service.ts`
- `gift.service.ts`
- `identity.service.ts`
- `onboarding.service.ts`
- `personalization-style-instructions.ts`
- `profile.service.ts`
- `project-ingestion.service.ts`
- `project-rag.service.ts`
- `security-settings.service.ts`
- `text-extract.service.ts`
- `user-personalization.service.ts`
- `workspace.service.ts`

## Backend domains

| Dir | Purpose |
|---|---|
| `auth/` | Session resolution |
| `billing/` | Razorpay checkout helpers |
| `cache/` | Edge cache helpers |
| `chat/` | Lease, seed, warm, sanitize branch |
| `config/` | Edge flags, CF perf profile |
| `db/` | Pool + errors |
| `email-verifier/` | Email validation |
| `http/` | Route wrappers |
| `inference/` | Models, tools, SSE |
| `infrastructure/` | Supabase infra helpers |
| `repositories/` | SQL/RPC |
| `sandbox/` | Sandbox integration |
| `search/` | Search integrations |
| `services/` | Orchestration |
| `storage/` | R2 |
| `telemetry/` | Inference logs |
| `training/` | Transcript format |
| `weather/` | Weather tool support |

## Frontend hooks

- `src/frontend/hooks/use-ai-stream.ts`
- `src/frontend/hooks/use-api-keys.ts`
- `src/frontend/hooks/use-app-notifications.tsx`
- `src/frontend/hooks/use-app-overlays.tsx`
- `src/frontend/hooks/use-artifacts.ts`
- `src/frontend/hooks/use-auth.ts`
- `src/frontend/hooks/use-chat-api.ts`
- `src/frontend/hooks/use-chat-scroll-activity.ts`
- `src/frontend/hooks/use-chat-scroll.ts`
- `src/frontend/hooks/use-chat-search.ts`
- `src/frontend/hooks/use-chat.ts`
- `src/frontend/hooks/use-checkout-currency.ts`
- `src/frontend/hooks/use-clear-auth-busy-on-return.ts`
- `src/frontend/hooks/use-document-title.ts`
- `src/frontend/hooks/use-instant-navigate.ts`
- `src/frontend/hooks/use-is-client.ts`
- `src/frontend/hooks/use-keyboard-shortcuts.ts`
- `src/frontend/hooks/use-message-enter-animation.ts`
- `src/frontend/hooks/use-message-visibility.ts`
- `src/frontend/hooks/use-minimum-loading.ts`
- `src/frontend/hooks/use-mobile.tsx`
- `src/frontend/hooks/use-project-chat.ts`
- `src/frontend/hooks/use-projects.ts`
- `src/frontend/hooks/use-research.ts`
- `src/frontend/hooks/use-settings.ts`
- `src/frontend/hooks/use-sidebar-state.ts`
- `src/frontend/hooks/use-toast.ts`

## Lib shared (`src/lib/`)

- `src/lib/app-preferences.ts`
- `src/lib/assistant-output-sanitize.ts`
- `src/lib/chat-id.ts`
- `src/lib/chat-models.ts`
- `src/lib/chat-routing.ts`
- `src/lib/chat-title.ts`
- `src/lib/checkout-currency.ts`
- `src/lib/checkout-payment-icons.ts`
- `src/lib/checkout-payment-tab.ts`
- `src/lib/checkout-tax.ts`
- `src/lib/clauxen-ui-message.ts`
- `src/lib/countries.ts`
- `src/lib/follow-up-prompt.ts`
- `src/lib/gstin.ts`
- `src/lib/inference-routing.ts`
- `src/lib/model-catalog.ts`
- `src/lib/model-config.ts`
- `src/lib/model-context.ts`
- `src/lib/model-effort.ts`
- `src/lib/onboarding-steps.ts`
- `src/lib/plans-catalog.ts`
- `src/lib/profile-names.ts`
- `src/lib/razorpay-payment-methods.ts`
- `src/lib/request-geo.ts`
- `src/lib/storage-quota.ts`
- `src/lib/supabase-query-error.ts`
- `src/lib/vercel-env.ts`
- `src/lib/work-roles.ts`

## Workers

- `workers/auth-email`
- `workers/chat-history`
- `workers/r2-gateway`
- `workers/chat-coord`

## Related

- [`../architecture-overview.md`](../architecture-overview.md)
- [`ui-component-catalog.md`](./ui-component-catalog.md)
- [`scripts-catalog.md`](./scripts-catalog.md)
