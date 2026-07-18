---
name: clauxen-api
description: >-
  Clauxen HTTP API surface: /api/v1 routes, auth requirements, SSE generate, legacy /api/chat and /api/projects. Use when adding or changing route handlers, API contracts, or clx_ API keys.
---

# Clauxen API

## Read first

- `docs/reference/api-reference.md`

## Conventions

- Primary: `/api/v1/*`
- Auth: session cookie/JWT, or `Authorization: Bearer clx_…`, or dev cookie when bypass on
- Errors: `AppError` + status + optional `code`
- `/api/*` → `no-store` (vercel.json)
- Streaming: `CLAUXEN_STREAM_HEADERS`, maxDuration up to 300s on generate/agent/sandbox

## Adding a route

1. Place under `src/app/api/v1/.../route.ts`
2. Use `withApiRouteParams` / session helpers from `src/backend/http` + `requireSession`
3. Call service → repository (no fat SQL in route)
4. Document in `docs/reference/api-reference.md`
5. Set `vercel.json` memory/timeout if long-running

## Additional resources

- [reference.md](reference.md)
