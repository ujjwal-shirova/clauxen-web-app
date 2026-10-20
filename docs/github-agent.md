# Clauxen Agent for GitHub

GitHub App owner: **shirova-ai**, not the developer's personal GitHub account.

Shared backend: `workers/github-agent/` in the web repository. Cloudflare Worker
`clauxen-github-agent` serves `https://www.clauxen.com/github` and
`/api/v1/github/*`. Android and the web agent use the same Supabase user IDs and
connection records. Supabase project: `ntplcfsbcyhiqklkbldk`.

## Registration and credentials

1. Apply the checked-in migration `20261017120935_clauxen_github_agent.sql`.
2. Configure ignored `workers/github-agent/.dev.vars` from `.dev.vars.example`.
   Generate SEAL_KEY from 32 random bytes encoded as base64. SETUP_TOKEN and
   INTERNAL_TOKEN must be separate random secrets. Back up SEAL_KEY securely;
   replacing it without re-encrypting records makes existing credentials unreadable.
3. Deploy the integration with `python3 workers/github-agent/deploy.py`.
   This deploys only that Worker. Its route records must exist in the Cloudflare
   zone; the local API token may lack route-write access, so use the authenticated
   Cloudflare MCP for those two scoped routes. Never disable zone protections.
4. POST `/api/v1/github/manifest/start` with `Authorization: Bearer SETUP_TOKEN`
   from an administrator's terminal. Open the returned review_url. It prepares
   the manifest for `https://github.com/organizations/shirova-ai/settings/apps/new`.
5. Complete GitHub's owner re-authentication and app registration. GitHub sends a
   one-time code to the manifest callback. The Worker exchanges it server-side and
   stores the private key, client secret and webhook secret encrypted in the
   private schema. Credentials are never shown to browser JavaScript or Android.
   The callback verifies that GitHub reports `shirova-ai` as the app owner.
6. Add the logo through the organization's GitHub App settings afterward.
7. Open `/github`, authorize the GitHub account and install the app on selected
   repositories. This GitHub authorization is separate from signing into Clauxen
   with GitHub through Supabase. Organization approval may be required.

The app requests Contents write, Pull requests write and Metadata read. It does
not request organization administration, workflow write, or repository deletion.
Installation lifecycle events arrive automatically and must not be included as
selectable manifest event subscriptions.

## Web and mobile

Web: Clauxen Code settings links to `/github`. Browser Supabase session cookies
are signature-verified against the canonical issuer and authenticated audience.

Android: Settings > GitHub calls authenticated POST `/api/v1/github/launch`,
then opens a Custom Tab with a ten-minute one-use launch nonce in the URL fragment.
Browser JavaScript immediately removes the fragment and exchanges the nonce for
an HttpOnly, Secure, SameSite=Lax five-minute connection cookie. No Supabase or
GitHub access token goes into a URL. The account connection stays server-side and
is shared with the web app; the short-lived cookie is only a browser handoff.

The agent runtime exposes `github_agent` with operations `repositories`, `read`,
and `create_change`. The executor supplies the authenticated context's user ID;
the model cannot nominate a different user. The main app calls through the
GITHUB_AGENT service binding with GITHUB_AGENT_INTERNAL_TOKEN. That secret must
match INTERNAL_TOKEN on the integration Worker. Configure the same binding and
secret on every runtime that calls these tools (including continuation workers).

## Repository operations

- Enumerate installations/repositories using the *user's* GitHub App OAuth token.
- Revalidate user access, and require repository `permissions.push` for writes.
- Mint a short-lived installation token scoped to exactly that repository and
  required operation permissions. Never return it to a client or model.
- Read metadata/files and capture the base branch head SHA before proposing edits.
- `create_change` requires a UUID request_id, expected_head_sha, base_branch,
  title, body, and an array of complete UTF-8 file contents.
- Changes create blobs, a tree and a commit, then create a NEW
  `clauxen/<request_id>` branch and a **draft** pull request. The base branch is
  never modified and no force update or merge endpoint is exposed.
- Author/committer use Clauxen Agent's actual GitHub bot identity. A co-author
  trailer credits the verified connected GitHub user. An identity label alone
  does not promise GitHub's Verified signature badge.
- Workflow edits, path traversal, malformed request IDs and stale base heads are
  rejected. This first contract handles text additions/updates, not binary files,
  file deletion or force-pushing an existing branch.
- Persisted changes deduplicate request IDs per Clauxen user and reject reuse with a different payload fingerprint. If a run fails after
  creating a branch, inspect the stored result/branch before recovery. Never
  retry blindly with a new UUID; a timeout may already have created the branch.

## Security and verification

All integration tables are in `private`, RLS enabled, and revoked from anon,
authenticated and PUBLIC. The privileged Worker performs explicit user ownership
checks; there are no client-facing SECURITY DEFINER credential RPCs. Credentials
use AES-256-GCM with record-specific authenticated context. OAuth state is random,
hashed, single-use, browser-bound and expires after ten minutes. PKCE protects the
user OAuth exchange. Expiring GitHub tokens refresh under a row lock. Webhooks
verify SHA-256 HMAC over the raw body and deduplicate delivery IDs transactionally.

Disconnect clears the stored Clauxen connection and pending states, preventing
future agent operations. GitHub installation removal/revocation remains available
in GitHub settings. Already-issued tokens are short-lived; uninstalling an app
revokes its installation access independently.

Checks:

```sh
./node_modules/.bin/tsx --test workers/github-agent/agent.test.ts
./node_modules/.bin/tsc -p workers/github-agent/tsconfig.json
node workers/github-agent/verify-live.mjs
./node_modules/.bin/wrangler deploy --config workers/github-agent/wrangler.jsonc --dry-run
```

Live checks must include actual organization ownership, successful OAuth, selected
repository enumeration, a disposable test branch/PR, and removing repository access.
Do not claim a live successful commit until GitHub returns its SHA and PR URL.
No @mention-triggered background coding runner is installed by this integration;
it connects the existing Clauxen web/mobile chat agent to GitHub repository tools.
