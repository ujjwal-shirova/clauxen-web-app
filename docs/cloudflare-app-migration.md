# Cloudflare application deployment

The Next.js application is deployed independently of Vercel at:

https://clauxen-app.shirova.workers.dev

Production hosting was switched to Cloudflare on 10 October 2026. Both `clauxen.com` and `www.clauxen.com` are enabled Worker custom domains attached to `clauxen-app`; the two old Vercel CNAME records were removed in Cloudflare. Both domains returned HTTP 200 for `/overview`, with no `x-vercel-id` header. No Vercel project, deployment, environment variable or subscription was modified. The Vercel deployment remains available as a fallback. No Git push was made, because it could trigger a Vercel deployment. The existing Supabase database, authentication and realtime integration remain in use.

## Deployed resources

| Resource | Purpose |
| --- | --- |
| `clauxen-app` | Next.js pages, API handlers and generation queue consumer, using OpenNext |
| Workers Static Assets | JavaScript, styles, fonts and public assets |
| `clauxen-next-cache` | R2 incremental/prerender cache |
| `APP_CONFIG_KV` | Public model catalog cache and `feature-flags` JSON |
| Existing Hyperdrive `clauxen-supabase-chat` | Connections to the existing Postgres database; query caching disabled |
| Existing application R2 buckets | Private files, attachments, images, skills, artifacts and archives through native bindings |
| `clauxen-generation-slices` and its DLQ | Durable background AI generation slices |
| Cloudflare Images binding | Next.js image optimization |
| `clauxen-auth-email-app` | Separate auth-email Worker using the existing OTP namespace |
| `clauxen-app-watchdog` | Recovery Worker with a private service binding to the app |
| `clauxen-app-scheduled-tasks` | Scheduling Worker with its own automation queue and DLQ |

Both new scheduling/recovery Workers have active minute cron triggers and private service bindings to `clauxen-app`. Matching internal authentication secrets are configured. The old `clauxen-generations-watchdog` and `clauxen-scheduled-tasks` cron triggers were disabled through Cloudflare; their code and resources remain available for rollback. Shared history, billing, coordination and connector Workers were not redeployed.

The app still uses existing Cloudflare billing, coordination, history, sharing and connector Workers. The deployment does not move external AI providers or payments into Cloudflare.

## Runtime changes

- Upgraded Next.js to an OpenNext-supported version and added the Worker entry point and Wrangler configuration.
- Replaced Vercel-only telemetry, configuration and runtime-cache dependencies. Mutable user settings are read from Postgres rather than eventually consistent KV.
- Replaced native bcrypt, PDF parsing and QR-image processing dependencies with portable JavaScript implementations.
- Bundled prompts, built-in agent skills and the disposable-email list instead of reading deployed application files at runtime.
- Reused one small PostgreSQL pool within each API request or generation slice through Hyperdrive. Pools are isolated between invocations and close through `waitUntil()` after the handler returns; unscoped queries retain immediate cleanup.
- Streamed private R2 objects through signed, expiring, method-scoped URLs on the Worker origin. CORS is limited to the app's configured origins. Uploaded active documents download as attachments, and request query strings are redacted from Worker observability.
- Routed coordination, history, billing, sharing and auth-email calls through private Worker service bindings. Added `Server-Timing` headers to API responses for handler duration.
- Enqueued background generations directly. A queue event awaits an entire slice instead of using HTTP `after()`/`waitUntil()` for long model work.

Native bindings remove the need for R2 S3 credentials on this deployment. Local Node development retains the existing S3/local-storage fallbacks.

## Verification completed

- Next.js/OpenNext production build and actual Cloudflare deployment.
- Type checking and targeted lint checks.
- Seven request-resource/storage/queue tests, twelve existing background-generation tests and seven scheduling tests.
- Ten direct HTTP checks: app and marketing pages, redirects, protected endpoints, billing plan data, assets and optimized images.
- Temporary authenticated fixture: Supabase session, settings, chat creation/listing through Hyperdrive, signed R2 upload, completion, download and deletion. The fixture account and cascading database records were removed afterward.
- Short AI generation on the production domain completed with `WORKER_OK` after closing the response connection; the queue continued processing independently. The fixture account and records were deleted.
- Health checks for the new scheduling/recovery Workers. During cutover their minute schedules were enabled and the legacy schedules disabled.

No browser automation was used. Voice dictation, email delivery, payment execution, external tools and million-user load capacity have not been verified in this phase.

## Runtime performance check

The 10 October optimization deploy added private service bindings and pool reuse within each API invocation. Three sequential warm reads per endpoint measured handler durations of 51–118 ms for settings, 46–76 ms for chat listing, and 71–97 ms for subscription data. These `Server-Timing` values exclude network latency and framework/startup work outside the API wrapper. The test client saw 357–634 ms end-to-end for these warm requests. These are small functional samples, not a load benchmark or proof of uniform latency improvement.

Chat creation took 792 ms end-to-end, compared with 1,026 ms in the preceding single sample; file completion took 613 ms versus 913 ms. Other requests varied, and the short model generation completed at the 13.3-second polling observation versus 8.7 seconds previously. Provider latency, cold starts and network distance still affect response time.

The production zone has an existing managed challenge on `/login` and some other public/auth entry points. Direct HTTP receives `403` with `cf-mitigated: challenge`; the Worker origin itself returns the intended `307` login redirect. Production checks distinguish this challenge from application failures. Browser challenge clearance was not tested, and the existing security rules were preserved.

## Deploying again

Use Node.js 24 and install from the lockfile:

```sh
npm ci
npm run test:cloudflare
npm run test:background
npm run test:scheduled
npm run cf:build
npm run cf:deploy
node scripts/verify-cloudflare-http.mjs
```

`cloudflare-run.mjs` loads ignored local environment files and runs the local CLI without changing Vercel. The generated `cloudflare-env.d.ts` contains binding types and secret names, never secret values. Refresh it after changing bindings with `npm run cf:typegen`.

`verify-cloudflare-data.mjs` requires the existing Supabase values in ignored `.dev.vars`. It creates a temporary confirmed account without sending email, tests data/storage paths, then deletes that account. It invokes no AI or payment provider.

The manual GitHub Actions workflow `.github/workflows/deploy-cloudflare-app.yml` is prepared but has not been pushed or run. Automatic push triggers on the legacy Workers workflow were removed locally to prevent its Vercel-wiring step from running on a future push. Later configure its Cloudflare token and public frontend build settings. It preserves remote Worker secrets and never deploys to Vercel. Do not use the older `deploy-cloudflare-workers.yml` workflow for this staging deployment: that existing workflow includes Vercel wiring and redeploys shared legacy Workers.

## Deferred credentials and cutover

Available local configuration was copied to the new app before the request to defer further API-key work. Missing or stale provider credentials remain for the next phase. `Assembly_Provider_Key` is confirmed absent locally; Vercel marks it sensitive and will not export its value. The Shirova gateway credential also needs review if existing API clients use that gateway. Do not regenerate payment encryption or user-facing API secrets without checking compatibility with existing data/clients.

The ignored `scripts/prepare-cloudflare-env.mjs` output files contain secrets; the script itself is tracked and only reads local files. It writes `.dev.vars` and `tmp/cloudflare-secrets.json` with restrictive permissions. Upload a reviewed app secret file with:

```sh
node scripts/cloudflare-run.mjs wrangler secret bulk tmp/cloudflare-secrets.json --name clauxen-app
```

Frontend `NEXT_PUBLIC_*` values are compiled into the build. Changing them requires rebuilding and redeploying; changing only remote secrets is insufficient. The app uses the production public app URL for callback configuration. OAuth/magic-link callback and provider flows are left for the user to debug following cutover.

The user requested domain cutover before completing provider debugging. The custom domains are now saved in `wrangler.jsonc`, and the new minute cron schedules are saved in the two `wrangler.app.jsonc` files. The final app deployment version is `89aeb92a-7a94-4d93-a5dc-dfb389668329`.

The original hosting records are saved in `docs/cloudflare-dns-rollback.json`. For rollback, detach the two Worker custom domains, restore those CNAME records, disable the new minute schedulers and re-enable the two legacy schedulers. The unchanged Vercel deployment can then serve production again without redeployment. Leave `auth`, `platform`, mail and TXT records alone.

Missing API keys and full provider-flow debugging are deliberately deferred at the user's request. DNS/Worker routing is complete; this does not imply every external feature has been verified.

## Cost and capacity controls

Static assets use Cloudflare's asset/CDN path. The app has a 30,000 ms CPU ceiling per invocation, 5% log sampling, eight concurrent generation consumers, and four concurrent automation consumers, with bounded retries and dead-letter queues. These protect the database and limit background bursts; they do not guarantee a monthly spending cap. The CPU limit measures computation, not time waiting for an AI provider.

Cloudflare hosting does not remove Supabase, inference, image transformation, storage operation, queue or external-tool costs. Increasing concurrent generation throughput requires measuring Postgres/Hyperdrive, provider quotas, coordinator load and per-user quotas. No claim of millions of simultaneous users or a guaranteed total bill is made by this migration.
