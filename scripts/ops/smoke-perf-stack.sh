#!/usr/bin/env bash
# Smoke-check Clauxen triple-stack Workers + Hyperdrive (no Speed Insights).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SUBDOMAIN="${CLOUDFLARE_WORKERS_SUBDOMAIN:-ujjwal-8fc}"
HISTORY="https://clauxen-chat-history.${SUBDOMAIN}.workers.dev"
COORD="https://clauxen-chat-coord.${SUBDOMAIN}.workers.dev"
R2="https://clauxen-r2-gateway.${SUBDOMAIN}.workers.dev"
HYPERDRIVE_ID="${HYPERDRIVE_ID:-54df64d31cce4e6f8f34415c6fb4e849}"

fail=0

check_health() {
  local name="$1" url="$2"
  local body
  body="$(curl -fsS --max-time 10 "$url/health" || true)"
  if echo "$body" | grep -q '"ok"'; then
    echo "OK  $name health"
  else
    echo "FAIL $name health: $body"
    fail=1
  fi
}

check_health "chat-history" "$HISTORY"
check_health "chat-coord" "$COORD"
# r2-gateway may not expose /health — probe root
if curl -fsS --max-time 10 -o /dev/null -w "%{http_code}" "$R2/" | grep -Eq '^(200|401|404|405)$'; then
  echo "OK  r2-gateway reachable"
else
  echo "WARN r2-gateway probe inconclusive (non-fatal)"
fi

echo "==> Hyperdrive caching"
hd="$(cd "$ROOT" && npx wrangler@latest hyperdrive get "$HYPERDRIVE_ID" 2>/dev/null || true)"
if echo "$hd" | grep -q '"disabled": true'; then
  echo "OK  Hyperdrive caching disabled"
else
  echo "FAIL Hyperdrive caching not disabled"
  echo "$hd" | head -40
  fail=1
fi

TOKEN_FILE="/tmp/clauxen-chat-coord-internal-token.txt"
if [[ -f "$TOKEN_FILE" ]]; then
  TOKEN="$(tr -d '\n' <"$TOKEN_FILE")"
  CHAT_ID="smoke-$(date +%s)"
  LEASE_ID="lease-$(date +%s)"
  echo "==> chat-coord lease roundtrip"
  code="$(curl -sS -o /tmp/coord-lease.json -w "%{http_code}" \
    -X POST "$COORD/lease" \
    -H "content-type: application/json" \
    -H "x-clauxen-internal: $TOKEN" \
    -d "{\"chatId\":\"$CHAT_ID\",\"leaseId\":\"$LEASE_ID\"}")"
  if [[ "$code" == "200" ]] && grep -q '"ok":true' /tmp/coord-lease.json; then
    echo "OK  lease acquired"
  else
    echo "FAIL lease acquire HTTP $code $(cat /tmp/coord-lease.json)"
    fail=1
  fi
  code2="$(curl -sS -o /tmp/coord-lease2.json -w "%{http_code}" \
    -X POST "$COORD/lease" \
    -H "content-type: application/json" \
    -H "x-clauxen-internal: $TOKEN" \
    -d "{\"chatId\":\"$CHAT_ID\",\"leaseId\":\"other-$LEASE_ID\"}")"
  if [[ "$code2" == "409" ]]; then
    echo "OK  second lease conflicts (409)"
  else
    echo "FAIL expected 409 got $code2 $(cat /tmp/coord-lease2.json)"
    fail=1
  fi
  curl -fsS -X POST "$COORD/release" \
    -H "content-type: application/json" \
    -H "x-clauxen-internal: $TOKEN" \
    -d "{\"chatId\":\"$CHAT_ID\",\"leaseId\":\"$LEASE_ID\"}" >/dev/null
  echo "OK  lease released"
else
  echo "WARN no $TOKEN_FILE — skip lease roundtrip"
fi

if [[ "$fail" -ne 0 ]]; then
  echo "Smoke failed."
  exit 1
fi
echo "Smoke passed."
