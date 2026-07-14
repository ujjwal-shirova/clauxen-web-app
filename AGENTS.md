# AGENTS.md

Project-specific memory also lives in `brain/MEMORY.md` (read it first — enforced by
`.cursor/rules/brain-memory.mdc`). This file captures environment/run guidance.

## Cursor Cloud specific instructions

Clauxen is a Next.js 16 (App Router, React 19, Turbopack) AI chat platform. Standard
commands live in `README.md` / `package.json` scripts; only non-obvious caveats are noted here.

### Node version (important)
- The repo requires Node `24.x` and `.npmrc` sets `engine-strict=true`, so `npm install`
  fails on Node 22.
- The VM's default `node` on a fresh, non-login shell can resolve to `/exec-daemon/node`
  (v22), which shadows nvm even after `nvm use 24`. Node 24 is installed via nvm and
  `~/.bashrc` prepends it, so interactive agent shells get v24 automatically.
- If a command hits an engine/version error, force Node 24 for that shell:
  `export PATH="$(dirname "$(nvm which 24)"):$PATH"` (this is exactly what the startup
  update script does).

### Running the app
- Dev server: `npm run dev` → http://localhost:9002. It boots fine with no external
  services (DB/Supabase/inference are connected lazily, only when an endpoint is hit).
- The main app UI requires an authenticated Supabase user: `/` and `/new` redirect to
  `/login`. `/login` and `/about` are public and render without a session.
- No Docker is available in the VM, so `docker-compose.yml` (local Postgres/Redis) cannot
  be used as-is; use a real/managed Postgres + Supabase instead.

### Environment variables (what is / isn't available here)
- The project is linked to Vercel (`.vercel/project.json`, gitignored). With the injected
  `Vercel_Token` you can `npx vercel@41.7.0 env pull .env.local --environment=development
  --yes --token "$Vercel_Token"`.
- `vercel env pull` only returns non-Sensitive values. The Sensitive secrets come back
  EMPTY and cannot be retrieved this way: `Provider_API_Key` (inference), all
  `POSTGRES_*` / `DATABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`.
- Pulled dev env is configured for the hosted domains (`AUTH_DEV_BYPASS=false`,
  `AUTH_REQUIRED_FOR_CHAT=true`, `STORAGE_REQUIRE_R2=true`, app URL `www.clauxen.com`).
  For local dev override to: `AUTH_DEV_BYPASS=true`, `AUTH_REQUIRED_FOR_CHAT=false`,
  `STORAGE_REQUIRE_R2=false`, `NEXT_PUBLIC_APP_URL=http://localhost:9002`.

### Exercising core chat without full infra
- The legacy `POST /api/chat` path needs no auth and no DB when
  `AUTH_REQUIRED_FOR_CHAT=false`. It runs the real autonomous-agent + `ClauxenSseStream`
  pipeline and streams `answer_delta` frames.
- Inference always calls an OpenAI-compatible `/v1/chat/completions` at `Provider_BASE_URL`
  with `Provider_API_Key` (production points at Novita). There is NO built-in mock/offline
  model. To run the pipeline without the paid key, point `Provider_BASE_URL` at any local
  OpenAI-compatible server (e.g. Ollama, or a small stub) and set any non-empty
  `Provider_API_Key`.
- The browser chat UI always uses API mode (Supabase auth + DB); `AUTH_REQUIRED_FOR_CHAT`
  only relaxes the legacy `/api/chat` route, not the main UI.

### Lint / test / build status
- `npm run build` and `npm run typecheck` pass.
- `npm run lint` currently FAILS with "Converting circular structure to JSON". Root cause:
  `eslint.config.mjs` wraps `next/core-web-vitals` via legacy `FlatCompat.extends`, but
  `eslint-config-next@16` ships a flat config, so `@eslint/eslintrc` tries to
  `JSON.stringify` `eslint-plugin-react@7.37.5`'s circular `configs`. This is a
  pre-existing config issue, independent of environment setup.
- `npm run test` runs `tsx --test src/**/*.test.ts`.
