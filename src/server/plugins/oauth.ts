import { connectorEnv, connectorError, hashState, randomState } from "./crypto";
import { getConnector } from "./registry";
import type { ConnectorId } from "@/lib/plugin-connectors";

export type Definition = NonNullable<ReturnType<typeof getConnector>>;
export type OAuthCredential = {
  accessToken: string; refreshToken?: string; tokenType: "Bearer";
  expiresAt: number | null; scopes: string[];
};
export const FLOW_COOKIE = "__Host-clauxen-plugin-flow";
export const flowCookie = (value: string, maxAge = 600) => `${FLOW_COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
export const callbackPath = (id: ConnectorId) => `/api/v1/plugins/callback/${id}`;

export function appOrigin(resolve = connectorEnv): string {
  const configured = resolve("NEXT_PUBLIC_APP_URL");
  try {
    const url = new URL(configured ?? "");
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.pathname !== "/") throw new Error();
    return url.origin;
  } catch {
    throw connectorError("Configure the canonical HTTPS NEXT_PUBLIC_APP_URL before connecting providers.", 503);
  }
}

export function assertMutationOrigin(request: Request, canonical = appOrigin()): void {
  const origin = request.headers.get("origin");
  const site = request.headers.get("sec-fetch-site");
  if (origin !== new URL(request.url).origin || origin !== canonical || (site && !["same-origin", "none"].includes(site))) {
    throw connectorError("This action must be submitted from this app.", 403);
  }
}
export function readFlowCookie(request: Request): string {
  const matches = (request.headers.get("cookie") ?? "").split(";").map((part) => part.trim()).filter((part) => part.startsWith(`${FLOW_COOKIE}=`));
  const value = matches.length === 1 ? matches[0].slice(FLOW_COOKIE.length + 1) : "";
  return /^[A-Za-z0-9_-]{43}$/.test(value) ? value : "";
}
export const newOAuthState = () => ({ state: randomState(), browser: randomState(), verifier: randomState() });

export function oauthClient(definition: Definition, resolve = connectorEnv): { clientId: string; clientSecret: string } {
  const provider = definition.oauth?.provider.toUpperCase().replace(/-/g, "_");
  if (!provider) throw connectorError("This connector does not use a REST OAuth app.");
  const clientId = resolve(`PLUGIN_OAUTH_${provider}_CLIENT_ID`);
  const clientSecret = resolve(`PLUGIN_OAUTH_${provider}_CLIENT_SECRET`);
  if (!clientId || !clientSecret) throw connectorError(`Register the ${definition.name} provider app and configure its connector client ID and secret.`, 503);
  return { clientId, clientSecret };
}
export function authorizationUrl(definition: Definition, origin: string, state: string, verifier: string, resolve = connectorEnv): URL {
  const oauth = definition.oauth;
  if (!oauth) throw connectorError("OAuth is not available for this connector.");
  const target = new URL(oauth.authorizeUrl);
  if (target.protocol !== "https:" || target.username || target.password) throw connectorError("Invalid provider registration.", 503);
  const client = oauthClient(definition, resolve);
  target.search = new URLSearchParams({
    ...oauth.extraAuthorize,
    response_type: "code", client_id: client.clientId,
    redirect_uri: origin + callbackPath(definition.id), state,
    ...(oauth.provider.toLowerCase() === "slack" ? { user_scope: oauth.scopes.join(",") } : { scope: oauth.scopes.join(" ") }),
  }).toString();
  if (oauth.pkce) {
    target.searchParams.set("code_challenge", Buffer.from(hashState(verifier), "hex").toString("base64url"));
    target.searchParams.set("code_challenge_method", "S256");
  }
  if (oauth.provider.toLowerCase() === "google") {
    target.searchParams.set("access_type", "offline");
    target.searchParams.set("prompt", "consent");
  }
  if (oauth.provider.toLowerCase() === "microsoft") {
    target.searchParams.set("scope", [...new Set([...oauth.scopes, "offline_access"])].join(" "));
  }
  return target;
}

export async function readBoundedBody(response: Response, limit = 262144): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) throw connectorError("Provider response exceeded the safety limit.", 502);
      chunks.push(value);
    }
    return Buffer.concat(chunks).toString("utf8");
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

export async function fetchProviderJson(url: string, init: RequestInit, fetcher: typeof fetch = fetch): Promise<Record<string, unknown>> {
  try {
    const response = await fetcher(url, { ...init, redirect: "error", signal: AbortSignal.timeout(8000) });
    // Never parse or include error bodies in exception messages/logging.
    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      throw connectorError(response.status === 401 || response.status === 400 ? "Provider authorization failed. Reconnect this account." : "Provider is unavailable. Try again later.", 502);
    }
    const parsed: unknown = JSON.parse(await readBoundedBody(response));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    return parsed as Record<string, unknown>;
  } catch (error) {
    if (error instanceof Error && error.name === "AppError") throw error;
    throw connectorError("Provider request failed or timed out. Reconnect or try again later.", 502);
  }
}
const tokenString = (value: unknown) => typeof value === "string" && value.length > 0 && value.length <= 16384 && !/[\r\n\u0000]/.test(value) ? value : undefined;

export function normalizeTokens(response: Record<string, unknown>, requestedScopes: string[], previous?: OAuthCredential, now = Date.now(), slack = false): OAuthCredential {
  let payload = response;
  if (slack) {
    if (response.ok === false || !response.authed_user || typeof response.authed_user !== "object" || Array.isArray(response.authed_user)) throw connectorError("Slack user authorization was not granted.", 502);
    payload = response.authed_user as Record<string, unknown>;
    // Slack v2 labels its Bearer user grant as 'user'. Never use the root bot grant.
    if (payload.token_type === "user") payload = { ...payload, token_type: "Bearer" };
  }
  if (typeof payload.token_type !== "string" || payload.token_type.toLowerCase() !== "bearer" || !tokenString(payload.access_token)) throw connectorError("Provider did not return a supported Bearer user token.", 502);
  const expires = payload.expires_in;
  if (expires !== undefined && (typeof expires !== "number" || !Number.isFinite(expires) || expires <= 0 || expires > 315360000)) throw connectorError("Provider returned an invalid token expiry.", 502);
  const expiresAt = expires === undefined ? null : now + (expires as number) * 1000;
  if (expiresAt !== null && !Number.isSafeInteger(Math.ceil(expiresAt))) throw connectorError("Provider returned an invalid token expiry.", 502);
  if (payload.refresh_token !== undefined && !tokenString(payload.refresh_token)) throw connectorError("Provider returned an invalid refresh credential.", 502);
  const scope = payload.scope;
  if (scope !== undefined && typeof scope !== "string") throw connectorError("Provider returned invalid scopes.", 502);
  const scopes = typeof scope === "string" ? scope.split(/[\s,]+/).filter(Boolean).slice(0, 100) : previous?.scopes ?? requestedScopes;
  if (scopes.some((entry) => entry.length > 256)) throw connectorError("Provider returned invalid scopes.", 502);
  return { accessToken: payload.access_token as string, refreshToken: tokenString(payload.refresh_token) ?? previous?.refreshToken, tokenType: "Bearer", expiresAt, scopes };
}

export async function exchangeToken(definition: Definition, options: { origin: string; code?: string; verifier?: string; previous?: OAuthCredential; fetch?: typeof fetch; resolve?: typeof connectorEnv }): Promise<{ credential: OAuthCredential; response: Record<string, unknown> }> {
  const oauth = definition.oauth;
  if (!oauth) throw connectorError("OAuth is not configured.", 503);
  const client = oauthClient(definition, options.resolve);
  const params = new URLSearchParams(options.code ? {
    grant_type: "authorization_code", code: options.code, redirect_uri: options.origin + callbackPath(definition.id),
    ...(oauth.pkce ? { code_verifier: options.verifier ?? "" } : {}),
  } : { grant_type: "refresh_token", refresh_token: options.previous?.refreshToken ?? "" });
  const headers = new Headers({ "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" });
  if (oauth.tokenAuth === "basic") headers.set("Authorization", `Basic ${Buffer.from(`${encodeURIComponent(client.clientId)}:${encodeURIComponent(client.clientSecret)}`).toString("base64")}`);
  else { params.set("client_id", client.clientId); params.set("client_secret", client.clientSecret); }
  const response = await fetchProviderJson(oauth.tokenUrl, { method: "POST", headers, body: params }, options.fetch);
  return { credential: normalizeTokens(response, oauth.scopes, options.previous, Date.now(), oauth.provider.toLowerCase() === "slack"), response };
}

export async function accountLabel(definition: Definition, credential: OAuthCredential, response: Record<string, unknown>, fetcher = fetch): Promise<string> {
  const safeLabel = (value: unknown) => typeof value === "string" && value.length <= 200 && !/[\r\n\u0000]/.test(value) && ![credential.accessToken, credential.refreshToken].some((secret) => secret && value.includes(secret)) ? value : undefined;
  if (definition.id === "slack") {
    const team = response.team as Record<string, unknown> | undefined;
    const user = response.authed_user as Record<string, unknown> | undefined;
    return safeLabel(team?.name) ?? safeLabel(user?.id) ?? "Slack user account";
  }
  // Only fixed, audited identity endpoints where the granted scope permits them.
  let identityUrl: string | undefined;
  let field = "email";
  if (definition.id === "gmail" && credential.scopes.some((scope) => scope.includes("gmail"))) { identityUrl = "https://gmail.googleapis.com/gmail/v1/users/me/profile"; field = "emailAddress"; }
  if (definition.oauth?.provider.toLowerCase() === "google" && credential.scopes.some((scope) => ["email", "https://www.googleapis.com/auth/userinfo.email"].includes(scope))) identityUrl = "https://www.googleapis.com/oauth2/v2/userinfo";
  if (definition.oauth?.provider.toLowerCase() === "microsoft" && credential.scopes.some((scope) => /(?:^|\/)User.Read$/i.test(scope))) { identityUrl = "https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName"; field = "userPrincipalName"; }
  if (identityUrl) {
    try {
      const identity = await fetchProviderJson(identityUrl, { headers: { Authorization: `Bearer ${credential.accessToken}` } }, fetcher);
      return safeLabel(identity[field]) ?? `${definition.name} account`;
    } catch { /* Identity is optional; never broaden scopes or follow a profile URL. */ }
  }
  return `${definition.name} account`;
}

export async function revokeRestCredential(definition: Definition, credential: OAuthCredential, fetcher = fetch): Promise<void> {
  const provider = definition.oauth?.provider.toLowerCase();
  try {
    let url: string | undefined;
    let init: RequestInit | undefined;
    if (provider === "google") {
      url = "https://oauth2.googleapis.com/revoke";
      init = { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token: credential.refreshToken ?? credential.accessToken }) };
    } else if (provider === "dropbox") {
      url = "https://api.dropboxapi.com/2/auth/token/revoke";
      init = { method: "POST", headers: { Authorization: `Bearer ${credential.accessToken}` } };
    }
    if (url && init) {
      const response = await fetcher(url, { ...init, redirect: "error", signal: AbortSignal.timeout(8000) });
      await response.body?.cancel().catch(() => undefined);
    }
  } catch { /* Local credentials are already deleted. Known upstream revocation is best effort. */ }
}
