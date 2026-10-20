# Clauxen Supabase proxy

Live endpoint: `https://auth.clauxen.com`.

The `clauxen-supabase-proxy` Cloudflare Worker forwards `/auth/v1/`,
`/rest/v1/`, `/storage/v1/`, `/realtime/v1/`, `/functions/v1/` and `/graphql/v1/`
to `https://ntplcfsbcyhiqklkbldk.supabase.co`. `/health` is Worker liveness.
This is an HTTP API proxy, not a Postgres wire-protocol connection endpoint.

Clients supply their existing publishable key and bearer token. No service-role
key or deployment credential is installed in this Worker. Supabase remains the
identity issuer and enforces authorization/RLS. The Worker streams requests and
responses, preserves upstream CORS and Realtime upgrades, disables caching,
rejects public Auth admin routes, drops application cookies and untrusted
forwarding headers, and limits Auth traffic to 120 requests/minute/IP/location.
Cookie-dependent OAuth providers are outside this proxy's supported scope.

## OAuth branding solution — completed via OAuth Broker

To overcome the hosted Supabase limitation without paying $10/month for custom domains:
1. `clauxen-supabase-proxy` forwards incoming `/auth/v1/authorize?provider=github` (and `gitlab`) to Supabase configured as `custom:clauxen-github` / `custom:clauxen-gitlab`.
2. Supabase uses the first-party `clauxen-oauth-broker` Worker running on `auth.clauxen.com` as its custom OAuth provider.
3. The broker initiates PKCE with GitHub/GitLab using `redirect_uri=https://auth.clauxen.com/auth/v1/callback`.
4. GitHub and GitLab display the clean custom branding:
   **"Authorizing will redirect to https://auth.clauxen.com"**.
5. When the provider redirects back to `https://auth.clauxen.com/auth/v1/callback`:
   - The broker performs code exchange with the provider.
   - It performs identity resolution against Postgres (`clauxen_auth.resolve_oauth_identity`) to map existing user accounts by provider ID, avoiding account duplication or split history.
   - It issues a broker code to Supabase's callback.
   - Supabase completes the server-side code exchange against the broker's `/oauth/<provider>/token` and `/userinfo` endpoints.
   - Supabase issues the user session and redirects back to Clauxen's web/mobile callback.
6. Local test suites and live transport checks verify that both providers receive the custom callback with S256 PKCE and state protection.

## Cloudflare configuration

- Zone: `34254e54423cf2fa131806c367d9c6a7` (`clauxen.com`).
- Existing CNAME `auth.clauxen.com` → project origin is now proxied (automatic TTL).
- Route `5ec75b6156a84cb096ed1d0ed081018e`: `auth.clauxen.com/*` → Worker.
- The existing public-auth managed-challenge rule excludes exactly host
  `auth.clauxen.com` with path prefix `/auth/v1/`. Other rules are retained.
- Query strings are redacted from Worker invocation logs; code never logs
  requests, credentials, authorization codes or response bodies.

Deploy only this Worker. The local Cloudflare token can upload scripts but cannot
edit zone routes. For an initial deployment, use the authenticated Cloudflare MCP
to attach the route; subsequent uploads need no route modification. If Wrangler
reports a route permission failure after `Uploaded`, check script and route state
before concluding that the script upload failed.

## Verification

From the web repository:

```sh
./node_modules/.bin/tsx --test workers/supabase-proxy/proxy.test.ts
./node_modules/.bin/tsc -p workers/supabase-proxy/tsconfig.json
./node_modules/.bin/wrangler deploy --config workers/supabase-proxy/wrangler.jsonc --dry-run
node --env-file=.env.local workers/supabase-proxy/verify-live.mjs
```

On 2026-10-17: six transport tests and typechecking passed. Live checks verified
liveness 200, Auth settings 200, missing bearer 401, invalid refresh 400, preflight
200, admin routes 404, callback error forwarding 303, and GitHub/GitLab authorize
302 with their **original Supabase callback**. REST root returned the same 401 as
the direct origin (it requires a secret key); this is not evidence of a successful
authenticated data query. Human-account OAuth completion, authenticated data
access, storage transfers and Realtime WebSockets have not been live tested.
