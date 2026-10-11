# Supabase social OAuth callbacks

Clauxen uses the canonical Supabase project endpoint for Auth:

`https://ntplcfsbcyhiqklkbldk.supabase.co`

The provider callback URL is therefore:

`https://ntplcfsbcyhiqklkbldk.supabase.co/auth/v1/callback`

Use that callback as the primary value for Google, GitHub, GitLab, X, and any
other Supabase social provider.

## Custom-domain compatibility

When the paid Supabase custom domain is active, Google and GitLab may also keep
this callback in their allowlists:

`https://auth.clauxen.com/auth/v1/callback`

GitHub OAuth Apps accept one callback URL, so GitHub must use the canonical
project callback. Do not set `NEXT_PUBLIC_SUPABASE_URL` or `SUPABASE_URL` to the
custom domain unless Supabase reports that domain as active.

The two hostnames route to the same Supabase project and are not independent
infrastructure. Registering both callbacks provides migration compatibility,
not service-level failover. If the Supabase project is unavailable, the custom
domain cannot keep Auth online by itself.

## Application redirect allowlist

The social provider callback above is different from the application callback.
Keep these application URLs in Supabase Authentication → URL Configuration:

- `https://www.clauxen.com/auth/callback`
- `https://clauxen.com/auth/callback`
- the required preview and local-development callback URLs

The app passes one of these URLs as `redirectTo`; Supabase exchanges the social
provider response first and then returns the browser to the application.

## Google One Tap on arrival

`GoogleOneTap` is mounted inside the root authentication providers. After the
initial session check, guests receive Google's One Tap prompt automatically,
without clicking first. Google Identity Services uses the native FedCM account
prompt in supported browsers; the browser controls its appearance and position.
Signed-in visitors and visitors with the app sign-in dialog open are excluded.
The component requests the prompt once per mount and respects Google's dismissal
cooldown. The existing Google sign-in button remains available if it is suppressed.

The component uses `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, falling back to Clauxen's
existing web OAuth client:
`103785677444-ctlfhurfg8864m59bclrqsvt6h9f7t8r.apps.googleusercontent.com`.
This client must be included in Supabase Authentication → Providers → Google.
In Google Auth Platform → Clients, register each deployment under **Authorized
JavaScript origins**, including `https://www.clauxen.com`, `https://clauxen.com`,
and, for local testing, `http://localhost` and `http://localhost:9002`.
Origins have no path; they are separate from OAuth redirect URIs.

`next.config.ts` permits the GIS script, styles, frames and requests in the CSP
and permits `identity-credentials-get` on the same origin. Each prompt generates
a random nonce: its SHA-256 digest goes to Google and its raw value goes to
Supabase's `signInWithIdToken`. The existing browser Supabase client persists the
session cookies, then the app refreshes its authenticated identity in place.

Google Cloud origin registration and a real Google account are required for an
end-to-end test. Browser settings, Google account state and dismissal cooldowns
can suppress the prompt even when the integration is configured correctly.
Run `node --test tests/google-one-tap.test.mjs` for offline lifecycle and token
exchange regression checks, and `npm run test:auth` for session regression checks.
