import type { Provider } from "@supabase/supabase-js";
import type { OAuthProvider } from "@/frontend/components/auth/auth-shared";

/**
 * App OAuth providers → Supabase GoTrue provider + options.
 * Prefer `x` (OAuth 2.0) over legacy `twitter` (OAuth 1.0a).
 */
export const OAUTH_PROVIDER_OPTIONS: Record<
  OAuthProvider,
  {
    provider: Provider;
    /** Space-separated scopes when the provider supports them. */
    scopes?: string;
  }
> = {
  google: { provider: "google" },
  github: { provider: "github" },
  // X / Twitter OAuth 2.0 — email requires “Request email from users” in the X app.
  x: {
    provider: "x",
    scopes: "tweet.read users.read offline.access users.email",
  },
  apple: { provider: "apple" },
  gitlab: { provider: "gitlab" },
};

export function oauthSignInOptions(provider: OAuthProvider): {
  provider: Provider;
  scopes?: string;
} {
  return OAUTH_PROVIDER_OPTIONS[provider];
}
