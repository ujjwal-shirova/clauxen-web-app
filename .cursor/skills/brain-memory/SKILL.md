---
name: brain-memory
description: >-
  Read, search, and update project brain memory at brain/MEMORY.md. Use when the
  user says remember/note/forget, when recalling project decisions or preferences,
  after context summarization, or before non-trivial work that needs durable
  project facts. Also use when asked to check or update the brain.
---

# Brain memory

Project memory file: `brain/MEMORY.md` (workspace root).

## When to use

- User: "remember", "note that", "don't forget", "update memory", "what's in the brain"
- Start of a task after long/summarized context
- Before changing auth, deploy, remotes, or infra the memory mentions
- After learning a durable decision, preference, or gotcha

## Operations

Prefer the CLI when editing so format stays consistent:

```bash
# Read full memory
./brain/tools/memory.sh read

# Search
./brain/tools/memory.sh search "keyword"

# Append a dated user note
./brain/tools/memory.sh note "Short durable fact"

# Append a decision row (date auto)
./brain/tools/memory.sh decision "What we decided" "Why"

# Append a gotcha
./brain/tools/memory.sh gotcha "Pitfall to avoid"

# Append an open thread
./brain/tools/memory.sh thread "Open item"

# Stamp last-updated
./brain/tools/memory.sh touch
```

You may also Read / StrReplace `brain/MEMORY.md` directly for structural edits.

## Rules

1. Always **read before write** if unsure what is already stored.
2. Keep bullets **one line**, dated `YYYY-MM-DD` when adding notes.
3. **Never** store secrets (API keys, tokens, passwords, private keys).
4. Prefer updating the right section (Preferences / Decisions / Gotchas / Open threads / User notes) over dumping into User notes.
5. After meaningful memory updates in the same session as code changes, include `brain/MEMORY.md` in the commit when appropriate.
