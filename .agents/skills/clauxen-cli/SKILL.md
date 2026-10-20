---
name: clauxen-cli
description: Use the installed GitHub (gh), GitLab (glab), Cloudflare (wrangler), and Supabase (supabase) CLIs on macOS with Keychain-backed launchers. Apply whenever terminal-based provider access, automation, or CLI commands are needed across the system.
metadata:
  version: v1
  platform: macos
---

# Clauxen CLI System Tools

A curated, secure CLI toolchain pre-configured for automated execution across macOS for AI agents and developer workflows.

Launchers are installed permanently and available on PATH across user shell sessions:
- `gh`: `/Users/ujjwal_tyagi/.local/bin/gh` (GitHub CLI v2.95+)
- `glab`: `/Users/ujjwal_tyagi/.local/bin/glab` (GitLab CLI v1.123+)
- `wrangler`: `/Users/ujjwal_tyagi/.local/bin/wrangler` (Cloudflare CLI v4.151+)
- `supabase`: `/Users/ujjwal_tyagi/.local/bin/supabase` (Supabase CLI v2.109+)
- `clauxen-cli`: `/Users/ujjwal_tyagi/.local/bin/clauxen-cli` (Management & diagnostic tool)

---

## Security & Credential Rules (CRITICAL FOR AGENTS)

1. **NEVER attempt to read or dump secret tokens**:
   - Do NOT run `cat` on config files, token stores, or environment files.
   - Do NOT run token extraction commands (such as `gh auth token`, `glab config get token`, `wrangler auth token`, or `supabase projects api-keys`). These are intentionally blocked by the launcher safeguards.
   - Do NOT pass `--token`, `--debug`, or `--show-token` in command flags.
2. **Keyring & Keychain Storage**:
   - All credentials reside encrypted in the macOS Keychain (`gh` keyring, `glab` keyring, `com.shirova.clauxen.cli` service, and encrypted Wrangler configs).
   - The launchers securely inject required credentials directly into child process execution environments without exposing plaintext values to shell history or logs.
   - Any accidental token patterns (`gho_*`, `ghp_*`, `glpat-*`, `sbp_*`, Bearer tokens) are automatically intercepted and redacted (`[REDACTED]`) from stdout/stderr.
3. **Verify Auth Safely**:
   - Use `clauxen-cli doctor` to verify connectivity and auth across all 4 platforms without displaying secrets.

---

## Standard Workflows & Commands

### 1. GitHub CLI (`gh`)
- List user repositories: `gh repo list shirova-ai`
- View open pull requests: `gh pr list`
- Create a PR: `gh pr create --title "..." --body "..."`
- Issue tracking: `gh issue list`
- Inspect workflow runs: `gh run list`

### 2. GitLab CLI (`glab`)
- Check status: `glab auth status`
- List repositories: `glab repo list`
- View merge requests: `glab mr list`
- Create a merge request: `glab mr create --fill`
- Issue management: `glab issue list`

### 3. Cloudflare CLI (`wrangler`)
- Check identity: `wrangler whoami`
- List Workers / Services: `wrangler deploy --dry-run`
- Manage KV namespaces: `wrangler kv namespace list`
- D1 Databases: `wrangler d1 list`
- R2 Storage: `wrangler r2 bucket list`

### 4. Supabase CLI (`supabase`)
- List projects: `supabase projects list --output json`
- Link project: `supabase link --project-ref <id>`
- Generate database types: `supabase gen types typescript --linked`
- Database migrations: `supabase db diff`, `supabase migration list`

---

## Troubleshooting & Re-Authentication

If a token has expired or requires renewal, run:
- Health check: `clauxen-cli doctor`
- GitHub renewal: `gh auth login --hostname github.com --web`
- GitLab renewal: `glab auth login --hostname gitlab.com --web --git-protocol ssh`
- Cloudflare renewal: `wrangler login --use-keyring` (or `clauxen-cli store cloudflare`)
- Supabase renewal: `supabase login --no-browser` (or `clauxen-cli store supabase`)
