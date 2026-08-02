# Environment Variables

Template: `.env.example` (committed). Local: `.env.local` (never commit).  
Production: Vercel env — **sensitive** on Production+Preview, **encrypted** on Development (API forbids sensitive on Development).

Reconcile tool: `scripts/reconcile-vercel-env.mjs`.  
Never overwrite unreadable sensitive values with `.env.local` unless `FORCE_OVERWRITE_SENSITIVE=1` for intentional rotation.

Also see [`../vercel-deployment.md`](../vercel-deployment.md).

---

## 1. App (public)

| Variable                              | Purpose                                                 |
| ------------------------------------- | ------------------------------------------------------- |
| `NEXT_PUBLIC_APP_URL`                 | Canonical origin                                        |
| `NEXT_PUBLIC_AUTH_REQUIRED_FOR_CHAT`  | Client gate hint                                        |
| `NEXT_PUBLIC_SUPABASE_URL`            | Supabase URL                                            |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`       | Anon key (only — do not duplicate publishable key name) |
| `NEXT_PUBLIC_CHAT_HISTORY_WORKER_URL` | Browser history Worker                                  |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID`         | Razorpay.js public key                                  |

---

## 2. App (server)

| Variable                 | Purpose                                  |
| ------------------------ | ---------------------------------------- |
| `AUTH_DEV_BYPASS`        | Dev cookie auth (`false` on Vercel prod) |
| `AUTH_REQUIRED_FOR_CHAT` | Server gate                              |
| `STORAGE_REQUIRE_R2`     | Force R2 outside Vercel                  |
| `JWT_SECRET`             | Signing secret                           |
| `DATABASE_URL`           | Postgres (prefer pooler on serverless)   |
| `DATABASE_POOL_MAX`      | Default `1` per isolate                  |
| `REDIS_URL`              | BullMQ (optional)                        |
| `EDGE_CONFIG`            | Vercel Edge Config connection            |
| `ALLOWED_DEV_ORIGINS`    | Extra Next allowed origins               |

---

## 3. Supabase secrets

| Variable                    | Purpose                    |
| --------------------------- | -------------------------- |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role (server only) |

Optional for scripts: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `X_CLIENT_ID`, `X_CLIENT_SECRET`.

---

## 4. Cloudflare R2

| Variable                     | Purpose                                                |
| ---------------------------- | ------------------------------------------------------ |
| `R2_ACCOUNT_ID`              | Account                                                |
| `R2_ACCESS_KEY_ID`           | S3 key                                                 |
| `R2_SECRET_ACCESS_KEY`       | S3 secret                                              |
| `R2_S3_ENDPOINT`             | Endpoint                                               |
| `R2_API_TOKEN`               | Admin/CI                                               |
| `CLOUDFLARE_API_TOKEN`       | Deploy Workers / ops                                   |
| `CLOUDFLARE_ACCOUNT_ID`      | Account id                                             |
| `R2_IMAGES_BUCKET`           | images                                                 |
| `R2_DOCUMENTS_BUCKET`        | documents                                              |
| `R2_ARTIFACTS_BUCKET`        | artifacts                                              |
| `R2_SKILLS_BUCKET`           | skills                                                 |
| `R2_CHAT_ARCHIVES_BUCKET`    | archives                                               |
| `R2_AUDIO_RECORDINGS_BUCKET` | Private dictation recordings (falls back to documents) |
| `R2_USER_FILES_BUCKET`       | user files alias                                       |
| `R2_PUBLIC_BASE_URL`         | Public CDN domain optional                             |

---

## 5. Workers

| Variable                      | Purpose         |
| ----------------------------- | --------------- |
| `WORKER_URL`                  | r2-gateway      |
| `CHAT_HISTORY_WORKER_URL`     | Server history  |
| `CHAT_HISTORY_INTERNAL_TOKEN` | Warm/invalidate |
| `CHAT_COORD_WORKER_URL`       | Lease Worker    |
| `CHAT_COORD_INTERNAL_TOKEN`   | Lease auth      |
| `AUTH_EMAIL_WORKER_URL`       | OTP Worker      |
| `AUTH_EMAIL_INTERNAL_TOKEN`   | OTP auth        |

---

## 6. Inference (sensitive)

| Variable                      | Purpose                |
| ----------------------------- | ---------------------- |
| `Provider_API_Key`            | Provider key           |
| `Provider_BASE_URL`           | OpenAI-compatible base |
| `Provider_SANDBOX_TIMEOUT_MS` | Sandbox timeout        |
| `Provider_Model_Clauxen_V1`   | Default model slug     |
| `SHIROVA_THINKING_TYPE`       | Thinking mode          |

---

## 7. Tools

| Variable                     | Purpose                                           |
| ---------------------------- | ------------------------------------------------- |
| `EXA_API_KEY`                | Web search                                        |
| `FAL_KEY`                    | Images                                            |
| `PARALLEL_API_KEY`           | Parallel                                          |
| `GOOGLE_PLACES_API_KEY`      | Places                                            |
| `Assembly_Provider_Key`      | AssemblyAI Streaming v3 key (server only)         |
| `ASSEMBLYAI_STREAMING_HOST`  | Optional data-zone host; defaults to edge routing |
| `E2B_API_KEY` / `E2B_DOMAIN` | Optional sandbox                                  |

---

## 8. Billing

| Variable                       | Purpose        |
| ------------------------------ | -------------- |
| `RAZORPAY_KEY_ID`              | Server         |
| `RAZORPAY_KEY_SECRET`          | Server         |
| `RAZORPAY_WEBHOOK_SECRET`      | Webhook        |
| `CHECKOUT_USD_INR_RATE`        | FX display     |
| `APPLE_PAY_DOMAIN_ASSOCIATION` | Apple Pay file |

---

## 9. Audit

```bash
npm run audit:public-env
```

Ensures secrets are not accidentally `NEXT_PUBLIC_`.

---

## 10. Related

- [`../vercel-deployment.md`](../vercel-deployment.md)
- [`../vercel-production-setup.md`](../vercel-production-setup.md)
- [`../ops/operations-runbook.md`](../ops/operations-runbook.md)
