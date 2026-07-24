# Development Guide

## 1. Prerequisites

- Node.js **24.x** (see `.nvmrc` / `package.json` engines `<27`)
- npm ≥ 10 (`packageManager` pins npm@11)
- Supabase project (or local) with migrations applied
- Optional: Redis for BullMQ ingestion
- Optional: Docker Compose for local Postgres+Redis (`docker compose up -d`)

---

## 2. First-time setup

```bash
npm install
cp .env.example .env.local
# fill minimum keys from README / environment-variables.md

npx supabase db push
# or: npm run supabase:db:push

npm run dev
# http://localhost:9002
```

Minimum chat-working env:

```
NEXT_PUBLIC_APP_URL=http://localhost:9002
AUTH_DEV_BYPASS=true
NEXT_PUBLIC_SUPABASE_URL=…
NEXT_PUBLIC_SUPABASE_ANON_KEY=…
SUPABASE_SERVICE_ROLE_KEY=…
DATABASE_URL=…
Provider_API_Key=…
Provider_BASE_URL=…
Provider_Model_Clauxen_V1=moonshotai/kimi-k2.6
JWT_SECRET=…
```

---

## 3. Common scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Next dev on 9002 |
| `npm run build` | Production build (`bootstrap-db-env` then next build) |
| `npm run start` | Start production server |
| `npm run lint` / `lint:fix` | ESLint |
| `npm run typecheck` | `next typegen` + `tsc --noEmit` |
| `npm run format` | Prettier |
| `npm test` | `tsx --test` on `src/**/*.test.ts` |
| `npm run worker` | BullMQ ingestion |
| `npm run supabase:blocked-emails:seed` | Seed blocked email domains |
| `npm run audit:public-env` | Public env audit |
| `npm run vercel:env:sync` | Sync Vercel env API |

---

## 4. Project conventions

1. Read `brain/MEMORY.md` before non-trivial work.
2. Slice-by-slice product work — do not boil the ocean.
3. Prefer existing patterns under `src/components/`, `src/hooks/`, and `src/server/`.
4. Server-only for secrets; fail closed on missing provider keys.
5. Hash overlays for settings/pricing — do not invent new path overlays.
6. Chat optimistic UI + clientId stability.
7. Do not add `loading.tsx` on `/new` or `/c/[chatId]`.
8. Branch PUT uses `sanitizeBranchMessages`.
9. After meaningful changes: commit/push when user wants (verified commits required for Vercel).

---

## 5. Directory cheat sheet

See [`../architecture-overview.md`](../architecture-overview.md) and [`repository-map.md`](../reference/repository-map.md).

---

## 6. Local Workers

Workers can be developed with Wrangler from `workers/*/`:

```bash
cd workers/auth-email && npm install && npx wrangler dev
```

For full parity you need Hyperdrive/KV/R2 bindings — often easier to point `.env.local` at deployed Workers.

---

## 7. Database

```bash
npx supabase db push
npx supabase migration new my_change
```

Prefer additive migrations. Keep RLS tight. Revoke EXECUTE on SECURITY DEFINER RPCs from anon/authenticated.

---

## 8. Debugging chat

1. Network: generate SSE status + body
2. `x-clauxen-cache` on history Worker
3. Check lease 409s via chat-coord
4. Confirm Realtime mute during stream
5. Dedupe scoring — live stream vs empty snapshot
6. Device cache: clear IndexedDB namespace if corrupt

---

## 9. Related

- [`testing-guide.md`](./testing-guide.md)
- [`contributing.md`](./contributing.md)
- [`../ops/operations-runbook.md`](../ops/operations-runbook.md)
