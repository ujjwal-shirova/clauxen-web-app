#!/usr/bin/env bash
# Deploy Clauxen Cloudflare Workers (chat-history, r2-gateway, auth-email).
# Accepts either CLOUDFLARE_API_TOKEN or Cloudflare_Token (Cursor runtime secret name).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-8fc7a67e9057989309921f362784ecf4}"

# Cursor Cloud runtime secret aliases
if [[ -z "${CLOUDFLARE_API_TOKEN:-}" && -n "${Cloudflare_Token:-}" ]]; then
  export CLOUDFLARE_API_TOKEN="$Cloudflare_Token"
fi
if [[ -z "${VERCEL_TOKEN:-}" && -n "${Vercel_Token:-}" ]]; then
  export VERCEL_TOKEN="$Vercel_Token"
fi
if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" && -n "${Supabase_Token:-}" ]]; then
  export SUPABASE_ACCESS_TOKEN="$Supabase_Token"
fi

if ! command -v npx >/dev/null 2>&1; then
  echo "npx is required" >&2
  exit 1
fi

if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  echo "CLOUDFLARE_API_TOKEN / Cloudflare_Token is not set."
  echo "Add it as a Cursor Environment secret (or export it), then re-run."
  exit 2
fi

export CLOUDFLARE_ACCOUNT_ID="$ACCOUNT_ID"

echo "==> Deploying clauxen-chat-history"
(
  cd "$ROOT/workers/chat-history"
  npx wrangler deploy
)

echo "==> Deploying clauxen-r2-gateway"
(
  cd "$ROOT/workers/r2-gateway"
  if [[ -n "${SUPABASE_URL:-}${NEXT_PUBLIC_SUPABASE_URL:-}" ]]; then
    printf '%s' "${SUPABASE_URL:-$NEXT_PUBLIC_SUPABASE_URL}" | npx wrangler secret put SUPABASE_URL
  fi
  if [[ -n "${SUPABASE_ANON_KEY:-}${NEXT_PUBLIC_SUPABASE_ANON_KEY:-}" ]]; then
    printf '%s' "${SUPABASE_ANON_KEY:-$NEXT_PUBLIC_SUPABASE_ANON_KEY}" | npx wrangler secret put SUPABASE_ANON_KEY
  fi
  npx wrangler deploy
)

echo "==> Deploying clauxen-auth-email (OTP via Email Service → no-reply@clauxen.com)"
(
  cd "$ROOT/workers/auth-email"
  # Stable shared secret between Next.js and Worker (generate if missing).
  if [[ -z "${AUTH_EMAIL_INTERNAL_TOKEN:-}" ]]; then
    AUTH_EMAIL_INTERNAL_TOKEN="$(openssl rand -hex 32)"
    echo "Generated AUTH_EMAIL_INTERNAL_TOKEN (also set this on Vercel)."
  fi
  printf '%s' "$AUTH_EMAIL_INTERNAL_TOKEN" | npx wrangler secret put AUTH_EMAIL_INTERNAL_TOKEN
  npx wrangler deploy
  echo "$AUTH_EMAIL_INTERNAL_TOKEN" > /tmp/clauxen-auth-email-internal-token.txt
  chmod 600 /tmp/clauxen-auth-email-internal-token.txt
)

WORKER_SUBDOMAIN="${CLOUDFLARE_WORKERS_SUBDOMAIN:-ujjwal-8fc}"
AUTH_EMAIL_URL="https://clauxen-auth-email.${WORKER_SUBDOMAIN}.workers.dev"

echo
echo "Done. Wire on Vercel (production + preview):"
echo "  AUTH_EMAIL_WORKER_URL=$AUTH_EMAIL_URL"
echo "  AUTH_EMAIL_INTERNAL_TOKEN=<from /tmp/clauxen-auth-email-internal-token.txt>"
echo "  CHAT_HISTORY_WORKER_URL=https://clauxen-chat-history.${WORKER_SUBDOMAIN}.workers.dev"
echo "  WORKER_URL=https://clauxen-r2-gateway.${WORKER_SUBDOMAIN}.workers.dev"
echo
echo "Cloudflare Email Service: onboard clauxen.com and allow sender no-reply@clauxen.com"
