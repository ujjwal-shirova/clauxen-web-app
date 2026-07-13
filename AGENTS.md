# AGENTS.md

Clauxen is a Next.js 16 (App Router, React 19) AI chat platform. See `README.md`,
`docs/backend.md`, and `docs/vercel-deployment.md` for the full architecture and
the complete environment-variable list. Standard scripts live in `package.json`
(`dev`, `build`, `lint`, `typecheck`, `test`).

## Cursor Cloud specific instructions

### Node version (important)
- The project requires **Node >= 24** (`.nvmrc` = 24) and `.npmrc` has `engine-strict=true`,
  so `npm install` fails on the base image's default `/exec-daemon/node` (v22).
- Node 24 is installed via `nvm` and made the default; `~/.bashrc` prepends the nvm
  Node bin ahead of `/exec-daemon/node`. In a fresh **login** shell `node -v` should
  print `v24.x`. If a non-interactive shell still resolves v22, run
  `. "$HOME/.nvm/nvm.sh" && nvm use 24` first. The startup update script also selects
  Node 24 via nvm before `npm install`.

### Running the app (dev)
- `npm run dev` serves on **http://localhost:9002** (not 3000).
- Local env lives in `.env.local` (git-ignored; created during setup from `.env.example`).
  It is not in the repo/PR — if missing on a fresh VM, recreate it from `.env.example`.

### What runs without external services
- Dev server boots, `npm run build`, `npm test`, and `npm run typecheck` all pass with
  no database or secrets.
- The **chat inference pipeline** works end-to-end without a DB via the legacy
  `POST /api/chat` route (used when `AUTH_REQUIRED_FOR_CHAT=false`): route handler →
  autonomous agent (`src/backend/inference/agent-engine.ts`) → provider → SSE stream.
  It only needs an OpenAI-compatible provider at `Provider_BASE_URL` + `Provider_API_Key`.
  For local demos without a paid key, point `Provider_BASE_URL` at a local
  OpenAI-compatible stub that serves `POST /v1/chat/completions` (streaming + non-streaming).

### What needs external services / secrets (blocks the authenticated UI)
- The browser auth client throws unless `NEXT_PUBLIC_SUPABASE_URL` (https or `localhost`)
  and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set. With them set, `src/proxy.ts` middleware
  gates all non-public routes: unauthenticated users are redirected to `/login`.
- Reaching the chat UI at `/new` requires a **real Supabase project (GoTrue) + Postgres**:
  - Middleware's onboarding gate needs a real Supabase user id (a dev-bypass cookie alone
    has no Supabase JWT, so it loops to `/onboarding`).
  - Even the `AUTH_DEV_BYPASS=true` login (`POST /api/v1/auth/login`) writes to Postgres
    (`registerDevUser` / security events), so it fails without `DATABASE_URL`.
- The migrations in `supabase/migrations/` are Supabase-specific (require `auth`/`storage`
  schemas, roles like `anon`/`service_role`, and extensions `vector`/`pg_net`/`pgmq`/`pg_cron`),
  so a plain local Postgres is not enough — use a hosted Supabase project or the Supabase
  local stack (Docker) and apply migrations with `npx supabase db push`.

### Known issue
- `npm run lint` fails with `Converting circular structure to JSON` from
  `@eslint/eslintrc` `FlatCompat` while loading `next/core-web-vitals` (see
  `eslint.config.mjs`). This reproduces with a clean `npm ci` and is an upstream
  ESLint/eslint-config-next incompatibility, not an install problem. `npm run typecheck`
  and `npm test` are the reliable static checks.
