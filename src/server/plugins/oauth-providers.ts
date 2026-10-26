/**
 * OAuth providers whose apps Clauxen registers ahead of time.
 *
 * These providers do not support dynamic client registration, so the client
 * id and secret come from the deployment environment. A provider is only
 * offered in the marketplace once its credentials are configured.
 *
 * Every provider's redirect URI must be registered as
 *   <NEXT_PUBLIC_APP_URL>/api/v1/plugins/callback
 */

export type OAuthProviderId = "google" | "github" | "slack" | "microsoft";

export type OAuthProviderConfig = {
  id: OAuthProviderId;
  label: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  /** Issuer hosts that identify this provider during MCP discovery. */
  issuerHosts: string[];
  tokenAuthMethod: "client_secret_post" | "client_secret_basic";
  authorizationParams: Record<string, string>;
  /** Scopes always requested so the linked account can be labelled. */
  identityScopes: string[];
  scopeSeparator: " " | ",";
  /** Google and Microsoft reject RFC 8707 resource indicators. */
  sendsResourceIndicator: boolean;
};

const PROVIDERS: Record<OAuthProviderId, OAuthProviderConfig> = {
  google: {
    id: "google",
    label: "Google",
    authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenEndpoint: "https://oauth2.googleapis.com/token",
    issuerHosts: ["accounts.google.com", "oauth2.googleapis.com"],
    tokenAuthMethod: "client_secret_post",
    authorizationParams: {
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
    },
    identityScopes: ["openid", "email"],
    scopeSeparator: " ",
    sendsResourceIndicator: false,
  },
  github: {
    id: "github",
    label: "GitHub",
    authorizationEndpoint: "https://github.com/login/oauth/authorize",
    tokenEndpoint: "https://github.com/login/oauth/access_token",
    issuerHosts: ["github.com"],
    tokenAuthMethod: "client_secret_post",
    authorizationParams: { allow_signup: "false" },
    identityScopes: ["read:user"],
    scopeSeparator: " ",
    sendsResourceIndicator: false,
  },
  slack: {
    id: "slack",
    label: "Slack",
    authorizationEndpoint: "https://slack.com/oauth/v2_user/authorize",
    tokenEndpoint: "https://slack.com/api/oauth.v2.user.access",
    issuerHosts: ["slack.com"],
    tokenAuthMethod: "client_secret_post",
    authorizationParams: {},
    identityScopes: [],
    scopeSeparator: " ",
    sendsResourceIndicator: false,
  },
  microsoft: {
    id: "microsoft",
    label: "Microsoft",
    authorizationEndpoint:
      "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenEndpoint: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    issuerHosts: ["login.microsoftonline.com"],
    tokenAuthMethod: "client_secret_post",
    authorizationParams: { prompt: "select_account" },
    identityScopes: ["offline_access", "User.Read"],
    scopeSeparator: " ",
    sendsResourceIndicator: false,
  },
};

export type OAuthClientCredentials = {
  clientId: string;
  clientSecret: string;
};

function envValue(name: string): string {
  return process.env[name]?.trim() ?? "";
}

export function providerConfig(id: OAuthProviderId): OAuthProviderConfig {
  return PROVIDERS[id];
}

/** Client credentials for a provider, or null when not configured. */
export function providerCredentials(
  id: OAuthProviderId,
): OAuthClientCredentials | null {
  const prefix = `PLUGIN_OAUTH_${id.toUpperCase()}`;
  const clientId = envValue(`${prefix}_CLIENT_ID`);
  const clientSecret = envValue(`${prefix}_CLIENT_SECRET`);
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

/** Map an authorization server URL found during MCP discovery to a provider. */
export function providerForIssuer(issuerOrEndpoint: string): OAuthProviderId | null {
  let host: string;
  try {
    host = new URL(issuerOrEndpoint).hostname.toLowerCase();
  } catch {
    return null;
  }
  for (const provider of Object.values(PROVIDERS)) {
    if (
      provider.issuerHosts.some(
        (candidate) => host === candidate || host.endsWith(`.${candidate}`),
      )
    ) {
      return provider.id;
    }
  }
  return null;
}

/** Human label for the account a provider token belongs to. */
export async function fetchAccountLabel(
  id: OAuthProviderId,
  accessToken: string,
): Promise<string | null> {
  const request = (url: string, headers: Record<string, string> = {}) =>
    fetch(url, {
      headers: {
        authorization: `Bearer ${accessToken}`,
        accept: "application/json",
        ...headers,
      },
      signal: AbortSignal.timeout(8_000),
    })
      .then((response) => (response.ok ? response.json() : null))
      .catch(() => null) as Promise<Record<string, unknown> | null>;

  switch (id) {
    case "google": {
      const info = await request("https://openidconnect.googleapis.com/v1/userinfo");
      return typeof info?.email === "string" ? info.email : null;
    }
    case "github": {
      const info = await request("https://api.github.com/user", {
        accept: "application/vnd.github+json",
        "user-agent": "Clauxen",
      });
      return typeof info?.login === "string" ? `@${info.login}` : null;
    }
    case "microsoft": {
      const info = await request("https://graph.microsoft.com/v1.0/me");
      const mail = info?.mail ?? info?.userPrincipalName;
      return typeof mail === "string" ? mail : null;
    }
    case "slack":
      return null;
  }
}

/** Best-effort provider-side revocation when a user disconnects. */
export async function revokeAtProvider(
  id: OAuthProviderId,
  token: string,
): Promise<void> {
  const credentials = providerCredentials(id);
  const timeout = AbortSignal.timeout(8_000);
  switch (id) {
    case "google":
      await fetch("https://oauth2.googleapis.com/revoke", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token }).toString(),
        signal: timeout,
      });
      return;
    case "github":
      if (!credentials) return;
      await fetch(
        `https://api.github.com/applications/${encodeURIComponent(credentials.clientId)}/grant`,
        {
          method: "DELETE",
          headers: {
            authorization: `Basic ${btoa(`${credentials.clientId}:${credentials.clientSecret}`)}`,
            accept: "application/vnd.github+json",
            "content-type": "application/json",
            "user-agent": "Clauxen",
          },
          body: JSON.stringify({ access_token: token }),
          signal: timeout,
        },
      );
      return;
    case "slack":
      await fetch("https://slack.com/api/auth.revoke", {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
        signal: timeout,
      });
      return;
    case "microsoft":
      // Microsoft identity platform has no token revocation endpoint; the
      // sealed tokens are deleted and the user can remove the app grant at
      // https://myapps.microsoft.com.
      return;
  }
}
