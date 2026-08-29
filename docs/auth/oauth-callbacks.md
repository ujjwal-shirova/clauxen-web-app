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
