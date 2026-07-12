#!/usr/bin/env bash
# brain-memory CLI — manage brain/MEMORY.md from the workspace root
set -euo pipefail

die() { echo "error: $*" >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# Prefer brain/tools/memory.sh; also support .cursor/skills/.../scripts/memory.sh
if [[ -f "$SCRIPT_DIR/../MEMORY.md" ]]; then
  ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
elif [[ -f "$SCRIPT_DIR/../../../../brain/MEMORY.md" ]]; then
  ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
else
  die "cannot locate workspace root from $SCRIPT_DIR"
fi
MEMORY="$ROOT/brain/MEMORY.md"
TODAY="$(date -u +%Y-%m-%d)"

ensure_memory() {
  [[ -f "$MEMORY" ]] || die "missing $MEMORY — create brain/MEMORY.md first"
}

stamp() {
  if grep -q '^\*\*Last updated:\*\*' "$MEMORY"; then
    sed -i.bak "s|^\*\*Last updated:\*\*.*|**Last updated:** $TODAY|" "$MEMORY"
    rm -f "$MEMORY.bak"
  fi
}

cmd_read() {
  ensure_memory
  cat "$MEMORY"
}

cmd_search() {
  ensure_memory
  local q="${1:-}"
  [[ -n "$q" ]] || die "usage: memory.sh search <keyword>"
  grep -n -i -E "$q" "$MEMORY" || true
}

cmd_note() {
  ensure_memory
  local text="${1:-}"
  [[ -n "$text" ]] || die "usage: memory.sh note \"fact\""
  # Insert before end of file under User notes — append after the section marker comments/bullets
  printf -- '- %s: %s\n' "$TODAY" "$text" >> "$MEMORY"
  stamp
  echo "noted: $text"
}

cmd_decision() {
  ensure_memory
  local decision="${1:-}" why="${2:-}"
  [[ -n "$decision" ]] || die "usage: memory.sh decision \"decision\" \"why\""
  local row="| $TODAY | $decision | ${why:-—} |"
  # Insert after the Decisions table header separator line
  if grep -q '^| Date | Decision | Why |$' "$MEMORY"; then
    awk -v row="$row" '
      BEGIN { done=0 }
      /^\| Date \| Decision \| Why \|$/ { print; getline; print; print row; done=1; next }
      { print }
      END { if (!done) print row }
    ' "$MEMORY" > "$MEMORY.tmp" && mv "$MEMORY.tmp" "$MEMORY"
  else
    printf '\n%s\n' "$row" >> "$MEMORY"
  fi
  stamp
  echo "decision recorded"
}

cmd_gotcha() {
  ensure_memory
  local text="${1:-}"
  [[ -n "$text" ]] || die "usage: memory.sh gotcha \"pitfall\""
  if awk '/^## Gotchas$/{s=1;next} s&&/^## /{exit} s&&/^- \(none recorded yet\)$/{found=1} END{exit !found}' "$MEMORY"; then
    awk -v text="- $text" '
      /^## Gotchas$/ { sect=1; print; next }
      sect && /^- \(none recorded yet\)$/ { print text; sect=0; next }
      /^## / { sect=0 }
      { print }
    ' "$MEMORY" > "$MEMORY.tmp" && mv "$MEMORY.tmp" "$MEMORY"
  else
    awk -v text="- $text" '
      /^## Gotchas$/ { sect=1; print; next }
      sect && /^## / { print text; sect=0 }
      { print }
      END { if (sect) print text }
    ' "$MEMORY" > "$MEMORY.tmp" && mv "$MEMORY.tmp" "$MEMORY"
  fi
  stamp
  echo "gotcha recorded"
}

cmd_thread() {
  ensure_memory
  local text="${1:-}"
  [[ -n "$text" ]] || die "usage: memory.sh thread \"item\""
  if awk '/^## Open threads$/{s=1;next} s&&/^## /{exit} s&&/^- \(none recorded yet\)$/{found=1} END{exit !found}' "$MEMORY"; then
    awk -v text="- $text" '
      /^## Open threads$/ { sect=1; print; next }
      sect && /^- \(none recorded yet\)$/ { print text; sect=0; next }
      /^## / { sect=0 }
      { print }
    ' "$MEMORY" > "$MEMORY.tmp" && mv "$MEMORY.tmp" "$MEMORY"
  else
    awk -v text="- $text" '
      /^## Open threads$/ { sect=1; print; next }
      sect && /^## / { print text; sect=0 }
      { print }
      END { if (sect) print text }
    ' "$MEMORY" > "$MEMORY.tmp" && mv "$MEMORY.tmp" "$MEMORY"
  fi
  stamp
  echo "thread recorded"
}

cmd_touch() {
  ensure_memory
  stamp
  echo "last updated → $TODAY"
}

usage() {
  cat <<'EOF'
usage: memory.sh <command> [args]

  read                         Print brain/MEMORY.md
  search <keyword>             Grep memory (case-insensitive)
  note "fact"                  Append dated user note
  decision "what" "why"        Add Decisions table row
  gotcha "pitfall"             Add under Gotchas
  thread "item"                Add under Open threads
  touch                        Refresh Last updated date
EOF
}

main() {
  local cmd="${1:-}"
  shift || true
  case "$cmd" in
    read) cmd_read ;;
    search) cmd_search "$@" ;;
    note) cmd_note "$@" ;;
    decision) cmd_decision "$@" ;;
    gotcha) cmd_gotcha "$@" ;;
    thread) cmd_thread "$@" ;;
    touch) cmd_touch ;;
    ""|-h|--help|help) usage ;;
    *) die "unknown command: $cmd" ;;
  esac
}

main "$@"
