#!/usr/bin/env bash
# Deploy Clauxen Cloudflare Workers for chat view (edge cache + R2 gateway).
# Requires: CLOUDFLARE_API_TOKEN (or wrangler login) + CLOUDFLARE_ACCOUNT_ID
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-8fc7a67e9057989309921f362784ecf4}"

if ! command -v npx >/dev/null 2>&1; then
  echo "npx is required" >&2
  exit 1
fi

if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  echo "CLOUDFLARE_API_TOKEN is not set."
  echo "Export a token with Workers + R2 edit, or run: npx wrangler login"
  echo "Then re-run this script."
  exit 2
fi

export CLOUDFLARE_ACCOUNT_ID="$ACCOUNT_ID"

echo "==> Deploying clauxen-chat-history (Cache API / KV / R2 / Hyperdrive)"
(
  cd "$ROOT/workers/chat-history"
  npx wrangler deploy
)

echo "==> Deploying clauxen-r2-gateway"
(
  cd "$ROOT/workers/r2-gateway"
  if [[ -n "${SUPABASE_URL:-}" ]]; then
    printf '%s' "$SUPABASE_URL" | npx wrangler secret put SUPABASE_URL
  fi
  if [[ -n "${SUPABASE_ANON_KEY:-}" ]]; then
    printf '%s' "$SUPABASE_ANON_KEY" | npx wrangler secret put SUPABASE_ANON_KEY
  fi
  npx wrangler deploy
)

echo
echo "Done. Next on Vercel:"
echo "  CHAT_HISTORY_WORKER_URL / NEXT_PUBLIC_CHAT_HISTORY_WORKER_URL = https://clauxen-chat-history.<subdomain>.workers.dev"
echo "  CHAT_HISTORY_INTERNAL_TOKEN = <same as Worker secret>"
echo "  WORKER_URL = https://clauxen-r2-gateway.<subdomain>.workers.dev"
