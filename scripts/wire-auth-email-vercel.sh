#!/usr/bin/env bash
# Set AUTH_EMAIL_* on the Vercel project (production + preview + development).
# Accepts VERCEL_TOKEN or Vercel_Token (Cursor runtime secret name).
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
AUTH_EMAIL_URL="${AUTH_EMAIL_WORKER_URL:-https://clauxen-auth-email.${WORKER_SUBDOMAIN}.workers.dev}"

if [[ -z "${AUTH_EMAIL_INTERNAL_TOKEN:-}" ]]; then
  if [[ -f /tmp/clauxen-auth-email-internal-token.txt ]]; then
    AUTH_EMAIL_INTERNAL_TOKEN="$(tr -d '\n' </tmp/clauxen-auth-email-internal-token.txt)"
  else
    echo "AUTH_EMAIL_INTERNAL_TOKEN missing (and /tmp/clauxen-auth-email-internal-token.txt not found)." >&2
    exit 2
  fi
fi

export VERCEL_TOKEN TEAM_ID PROJECT_ID AUTH_EMAIL_URL AUTH_EMAIL_INTERNAL_TOKEN

python3 <<'PY'
import json, os, urllib.error, urllib.request

token = os.environ["VERCEL_TOKEN"]
team = os.environ["TEAM_ID"]
project = os.environ["PROJECT_ID"]
auth_url = os.environ["AUTH_EMAIL_URL"]
internal = os.environ["AUTH_EMAIL_INTERNAL_TOKEN"]
base = "https://api.vercel.com"
headers = {
    "Authorization": f"Bearer {token}",
    "Content-Type": "application/json",
}


def req(method: str, path: str, body: dict | None = None):
    data = None if body is None else json.dumps(body).encode()
    request = urllib.request.Request(
        f"{base}{path}", data=data, headers=headers, method=method
    )
    try:
        with urllib.request.urlopen(request) as resp:
            raw = resp.read().decode() or "{}"
            return json.loads(raw)
    except urllib.error.HTTPError as e:
        detail = e.read().decode()
        raise SystemExit(f"{method} {path} -> {e.code}: {detail}") from e


# Vercel: sensitive is production+preview only; development must be encrypted.
listed = req("GET", f"/v9/projects/{project}/env?teamId={team}&decrypt=false")
wanted = {"AUTH_EMAIL_WORKER_URL", "AUTH_EMAIL_INTERNAL_TOKEN"}
for row in listed.get("envs", []):
    key = row.get("key")
    env_id = row.get("id")
    if key in wanted and env_id:
        req("DELETE", f"/v9/projects/{project}/env/{env_id}?teamId={team}")
        print(f"Removed existing {key} ({env_id})")

for key, value in (
    ("AUTH_EMAIL_WORKER_URL", auth_url),
    ("AUTH_EMAIL_INTERNAL_TOKEN", internal),
):
    req(
        "POST",
        f"/v10/projects/{project}/env?teamId={team}",
        {
            "key": key,
            "value": value,
            "type": "sensitive",
            "target": ["production", "preview"],
        },
    )
    req(
        "POST",
        f"/v10/projects/{project}/env?teamId={team}",
        {
            "key": key,
            "value": value,
            "type": "encrypted",
            "target": ["development"],
        },
    )
    print(f"Set {key} → sensitive(production,preview) + encrypted(development)")

print(f"Vercel env wired for project {project}. Redeploy so Next.js picks up AUTH_EMAIL_*.")
PY
