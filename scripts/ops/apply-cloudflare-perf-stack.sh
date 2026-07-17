#!/usr/bin/env bash
# Apply Cloudflare + Hyperdrive performance stack for Clauxen.
# Requires valid CLOUDFLARE_API_TOKEN in env (or .env.local sourced).
# Does NOT commit or push.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

if [[ -f .env.local ]]; then
  # shellcheck disable=SC1091
  set -a && source .env.local && set +a
fi

if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  echo "CLOUDFLARE_API_TOKEN missing — cannot call Cloudflare API."
  echo "Create a token with: Workers Scripts Edit, Hyperdrive Edit, Account Settings Read,"
  echo "  Zone Cache Purge / Cache Rules Edit (if zone is on Cloudflare)."
  exit 1
fi

ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-8fc7a67e9057989309921f362784ecf4}"
HYPERDRIVE_ID="${HYPERDRIVE_ID:-54df64d31cce4e6f8f34415c6fb4e849}"

echo "==> Whoami"
npx wrangler@latest whoami

echo "==> Disable Hyperdrive query caching for chat read-after-write consistency"
npx wrangler@latest hyperdrive update "$HYPERDRIVE_ID" \
  --caching-disabled \
  || echo "Hyperdrive update skipped (check token permissions)"

echo "==> Deploy chat-history Worker"
(
  cd workers/chat-history
  npx wrangler@latest deploy
)

echo "==> Deploy r2-gateway Worker"
(
  cd workers/r2-gateway
  npx wrangler@latest deploy
)

echo "==> Deploy auth-email Worker"
(
  cd workers/auth-email
  npx wrangler@latest deploy
)

echo "==> Deploy chat-coord Worker (Durable Object leases)"
if [[ -d "$ROOT/workers/chat-coord" ]]; then
  (
    cd workers/chat-coord
    npx wrangler@latest deploy
  )
else
  echo "  workers/chat-coord missing — skip"
fi

echo "==> Done. Verify:"
echo "  curl -sS https://clauxen-chat-history.ujjwal-8fc.workers.dev/health"
echo "  Ensure Vercel has NEXT_PUBLIC_CHAT_HISTORY_WORKER_URL + CHAT_HISTORY_INTERNAL_TOKEN + WORKER_URL"
echo "  Ensure Vercel has CHAT_COORD_WORKER_URL + CHAT_COORD_INTERNAL_TOKEN"
echo "  Cloudflare zone (if proxied): HTTP/3, Early Hints, Tiered Cache Smart, Argo Smart Routing ON;"
echo "  Cache Rules: cache /_next/static/* (1y) and /assets/* (1d+SWR); bypass /api/* and HTML shells."
echo "  Supabase: Dedicated Pooler addon + transaction pooler :6543 for Vercel DATABASE_URL."
