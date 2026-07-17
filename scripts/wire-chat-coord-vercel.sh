#!/usr/bin/env bash
# Wire clauxen-chat-coord Worker URL + internal token onto Vercel envs.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SUBDOMAIN="${CLOUDFLARE_WORKERS_SUBDOMAIN:-ujjwal-8fc}"
COORD_URL="${CHAT_COORD_WORKER_URL:-https://clauxen-chat-coord.${SUBDOMAIN}.workers.dev}"

if [[ -z "${VERCEL_TOKEN:-}" ]]; then
  echo "VERCEL_TOKEN required"
  exit 2
fi

if [[ -z "${CHAT_COORD_INTERNAL_TOKEN:-}" ]]; then
  if [[ -f /tmp/clauxen-chat-coord-internal-token.txt ]]; then
    CHAT_COORD_INTERNAL_TOKEN="$(tr -d '\n' </tmp/clauxen-chat-coord-internal-token.txt)"
  else
    CHAT_COORD_INTERNAL_TOKEN="$(openssl rand -hex 32)"
    printf '%s' "$CHAT_COORD_INTERNAL_TOKEN" > /tmp/clauxen-chat-coord-internal-token.txt
    chmod 600 /tmp/clauxen-chat-coord-internal-token.txt
  fi
  export CHAT_COORD_INTERNAL_TOKEN
fi

PROJECT="${VERCEL_PROJECT_ID:-prj_fvcWCHb6BfJHggIDiUQDXH9sOBjr}"
TEAM="${VERCEL_TEAM_ID:-team_uO4zWwgLWJfc9GpMMrr5KOwa}"

put_env() {
  local key="$1"
  local value="$2"
  local target="$3"
  npx vercel env rm "$key" "$target" --yes --token "$VERCEL_TOKEN" --scope "$TEAM" 2>/dev/null || true
  printf '%s' "$value" | npx vercel env add "$key" "$target" --token "$VERCEL_TOKEN" --scope "$TEAM"
}

for target in production preview development; do
  echo "==> $target CHAT_COORD_*"
  put_env CHAT_COORD_WORKER_URL "$COORD_URL" "$target"
  put_env CHAT_COORD_INTERNAL_TOKEN "$CHAT_COORD_INTERNAL_TOKEN" "$target"
done

echo "Wired CHAT_COORD_WORKER_URL=$COORD_URL"
