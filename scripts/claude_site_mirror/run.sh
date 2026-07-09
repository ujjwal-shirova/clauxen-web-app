#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
VENV="$ROOT/.venv-mirror"
PY="$VENV/bin/python"

if ! command -v aria2c >/dev/null 2>&1; then
  echo "aria2c not found — install: brew install aria2" >&2
  exit 1
fi

if [[ ! -x "$PY" ]]; then
  python3 -m venv "$VENV"
  "$VENV/bin/pip" install -r "$ROOT/scripts/claude_site_mirror/requirements.txt"
  "$VENV/bin/playwright" install chromium
fi

exec "$PY" "$ROOT/scripts/claude_site_mirror/mirror_claude_site.py" "$@"
