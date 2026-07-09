# Vercel deployment — environment variables

Set these in **Vercel → Project → Settings → Environment Variables** for Production, Preview, and Development.

## Model routing (Homer / Helios / Virgil)

Defined in `src/lib/model-catalog.ts`. Each model has its own base URL and upstream slug:

| Model | Provider | Base URL env | Model env |
|---|---|---|---|
| Homer | Anthropic | `NOVITA_ANTHROPIC_BASE_URL` | `SHIROVA_HOMER_MODEL` |
| Helios | OpenAI-compatible | `NOVITA_OPENAI_BASE_URL` | `SHIROVA_HELIOS_MODEL` |
| Virgil | OpenAI-compatible | `NOVITA_OPENAI_BASE_URL` | `SHIROVA_VIRGIL_MODEL` |

Set `NOVITA_AI_KEY` on Vercel for all three paths.

## Required (core app)

| Variable | Description |
|---|---|
| `DATABASE_URL` | Supabase Postgres direct connection string (Session mode / port 5432) |
| `JWT_SECRET` | Strong random secret for project auth JWT |
| `NOVITA_AI_KEY` | Inference API key |
| `NEXT_PUBLIC_APP_URL` | `https://your-domain.vercel.app` or custom domain |

## Required (file storage on Vercel)

Vercel serverless has **no persistent disk**. R2 is mandatory in production (`VERCEL=1` is set automatically).

| Variable | Description |
|---|---|
| `R2_ACCOUNT_ID` | Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | R2 S3 API token access key |
| `R2_SECRET_ACCESS_KEY` | R2 S3 API token secret |
| `R2_S3_ENDPOINT` | Full S3 endpoint from R2 dashboard |
| `R2_IMAGES_BUCKET` | `clauxen-images` |
| `R2_DOCUMENTS_BUCKET` | `clauxen-documents` |
| `R2_ARTIFACTS_BUCKET` | `clauxen-artifacts` |
| `R2_SKILLS_BUCKET` | `clauxen-skills` |
| `R2_CHAT_ARCHIVES_BUCKET` | `clauxen-chat-archives` |

Optional:

| Variable | Description |
|---|---|
| `R2_API_TOKEN` | Cloudflare API token (CI/admin only) |
| `R2_PUBLIC_BASE_URL` | Custom domain for public object URLs |
| `STORAGE_REQUIRE_R2` | Set `true` to force R2 even outside Vercel |

## Required (Supabase Auth — production)

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role (server-only admin tasks) |
| `AUTH_DEV_BYPASS` | Set `false` in production |

### Supabase redirect URLs (Auth → URL Configuration)

Add to **Authentication → URL Configuration**:

| URL | Purpose |
|---|---|
| `{NEXT_PUBLIC_APP_URL}/auth/callback` | OAuth + PKCE code exchange |
| `{NEXT_PUBLIC_APP_URL}/auth/confirm` | Email / magic link / recovery OTP |
| `http://localhost:9002/auth/callback` | Local development |

Enable OAuth providers in Supabase Dashboard: Google, GitHub, Facebook, Twitter (X). Instagram skipped v1.

See [`docs/auth-migration.md`](auth-migration.md) for dev-cookie → GoTrue migration notes.

## Required (R2 Worker gateway)

| Variable | Description |
|---|---|
| `WORKER_URL` | Deployed `workers/r2-gateway` URL (e.g. `https://clauxen-r2-gateway.workers.dev`) |

Deploy the worker:

```bash
cd workers/r2-gateway
npm install
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_ANON_KEY
npm run deploy
```

Set `WORKER_URL` on Vercel to the deployed worker origin.

## Sync from local `.env.example`

```bash
vercel link
vercel env pull .env.vercel   # optional: inspect what Vercel has
```

Add or update vars in the Vercel dashboard from `.env.example` / your local `.env.local`. There is a committed `.env.example` template at the repo root.

To add a single var from CLI:

```bash
vercel env add R2_S3_ENDPOINT production
```

## Buckets (Cloudflare R2)

| Bucket | Purpose |
|---|---|
| `clauxen-images` | Avatars, chat images, thumbnails |
| `clauxen-documents` | Project uploads, user library (RAG source files) |
| `clauxen-artifacts` | Generated files from chats |
| `clauxen-skills` | Uploaded skill packages (`.zip`, `.skill`, `.md`) |
| `clauxen-chat-archives` | Structured chat JSON exports |

Metadata for all objects is stored in Supabase Postgres (`project_files`, `user_files`, `artifacts`, `user_skills`, `storage.objects`).

## Upload limits on Vercel

Serverless function request bodies are limited (~4.5 MB on Hobby). Use the R2 Worker presign flow (`WORKER_URL` + `/api/v1/files/presign`) for larger uploads.

## Database schema

After setting `DATABASE_URL` (Supabase direct connection):

```bash
npx prisma migrate dev
npx prisma generate
# or, for the Supabase-managed schema:
npx supabase db push
```

## Deploy

See **[`docs/vercel-production-setup.md`](vercel-production-setup.md)** for production auth, env sync, and security checklist.

```bash
vercel link
vercel --prod
```

### Vercel project settings (recommended)

| Setting | Value |
|---|---|
| Framework Preset | Next.js |
| Node.js Version | **24.x** (matches `package.json` `engines`) |
| Install Command | `npm ci` (set in `vercel.json`) |
| Build Command | `npm run build` (`next build`; Prisma is pre-generated locally — see note below) |
| Fluid Compute | **Enabled** (default on new projects — full Node.js for API routes) |

### Repo config files

| File | Purpose |
|---|---|
| `vercel.json` | Install/build commands, security headers, streaming route `maxDuration` |
| `.vercelignore` | Excludes `.tools/`, vendored Python agents |
| `.npmrc` | `engine-strict=true`, audit level |
| `next.config.ts` | `optimizePackageImports`, R2 image domains, security headers |

Ensure `buildCommand` is `npm run build` (see `vercel.json`).
