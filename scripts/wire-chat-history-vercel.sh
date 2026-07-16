#!/usr/bin/env bash
# Wire the chat-history Worker URL and shared invalidation secret on Vercel.
set -euo pipefail

if [[ -z "${VERCEL_TOKEN:-}" && -n "${Vercel_Token:-}" ]]; then
  export VERCEL_TOKEN="$Vercel_Token"
fi

if [[ -z "${VERCEL_TOKEN:-}" ]]; then
  echo "VERCEL_TOKEN / Vercel_Token is not set." >&2
  exit 2
fi

TEAM_ID="${VERCEL_TEAM_ID:-team_uO4zWwgLWJfc9GpMMrr5KOwa}"
PROJECT_ID="${VERCEL_PROJECT_ID:-prj_fvcWCHb6BfJHggIDiUQDXH9sOBjr}"
WORKER_SUBDOMAIN="${CLOUDFLARE_WORKERS_SUBDOMAIN:-ujjwal-8fc}"
CHAT_HISTORY_URL="${CHAT_HISTORY_WORKER_URL:-https://clauxen-chat-history.${WORKER_SUBDOMAIN}.workers.dev}"

if [[ -z "${CHAT_HISTORY_INTERNAL_TOKEN:-}" ]]; then
  if [[ -f /tmp/clauxen-chat-history-internal-token.txt ]]; then
    CHAT_HISTORY_INTERNAL_TOKEN="$(tr -d '\n' </tmp/clauxen-chat-history-internal-token.txt)"
  else
    echo "CHAT_HISTORY_INTERNAL_TOKEN is required." >&2
    exit 2
  fi
fi

export VERCEL_TOKEN TEAM_ID PROJECT_ID CHAT_HISTORY_URL CHAT_HISTORY_INTERNAL_TOKEN

python3 <<'PY'
import json
import os
import urllib.error
import urllib.request

token = os.environ["VERCEL_TOKEN"]
team = os.environ["TEAM_ID"]
project = os.environ["PROJECT_ID"]
worker_url = os.environ["CHAT_HISTORY_URL"]
internal_token = os.environ["CHAT_HISTORY_INTERNAL_TOKEN"]
targets = ["production", "preview", "development"]
base = "https://api.vercel.com"
headers = {
    "Authorization": f"Bearer {token}",
    "Content-Type": "application/json",
}


def request(method: str, path: str, body: dict | None = None):
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(
        f"{base}{path}", data=data, headers=headers, method=method
    )
    try:
        with urllib.request.urlopen(req) as response:
            raw = response.read().decode() or "{}"
            return json.loads(raw)
    except urllib.error.HTTPError as error:
        detail = error.read().decode()
        raise SystemExit(f"{method} {path} -> {error.code}: {detail}") from error


for key, value in (
    ("NEXT_PUBLIC_CHAT_HISTORY_WORKER_URL", worker_url),
    ("CHAT_HISTORY_WORKER_URL", worker_url),
    ("CHAT_HISTORY_INTERNAL_TOKEN", internal_token),
):
    request(
        "POST",
        f"/v10/projects/{project}/env?teamId={team}&upsert=true",
        {
            "key": key,
            "value": value,
            "type": "encrypted",
            "target": targets,
        },
    )
    print(f"Set {key} for {targets}")

print("Chat-history Worker environment is wired. Redeploy Vercel to use it.")
PY
