import { CALLBACK, boundedText, ensure, type Claims, type Provider } from "./protocol";

export interface Credentials { id: string; secret: string }
export function authorization(provider: Provider, credentials: Credentials, state: string, challenge: string) {
  const url = new URL(provider === "github" ? "https://github.com/login/oauth/authorize" : "https://gitlab.com/oauth/authorize");
  url.search = new URLSearchParams({ client_id: credentials.id, redirect_uri: CALLBACK, response_type: "code", scope: provider === "github" ? "user:email" : "read_user", state, code_challenge: challenge, code_challenge_method: "S256" }).toString();
  return url;
}

async function getJson(url: string, init: RequestInit, fetcher: typeof fetch, limit = 64_000): Promise<any> {
  const response = await fetcher(url, { ...init, redirect: "error", signal: AbortSignal.timeout(15_000) });
  ensure(response.ok, 502, "provider_unavailable");
  try { return JSON.parse(await boundedText(response, limit)); }
  catch { throw new Error("Invalid provider response"); }
}

export async function providerClaims(provider: Provider, credentials: Credentials, code: string, verifier: string, fetcher: typeof fetch): Promise<Claims> {
  const tokenUrl = provider === "github" ? "https://github.com/login/oauth/access_token" : "https://gitlab.com/oauth/token";
  const token = await getJson(tokenUrl, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" }, body: new URLSearchParams({ grant_type: "authorization_code", client_id: credentials.id, client_secret: credentials.secret, code, code_verifier: verifier, redirect_uri: CALLBACK }).toString() }, fetcher);
  ensure(typeof token.access_token === "string" && token.access_token.length > 0 && !token.error, 400, "provider_exchange_failed");
  const headers = { Authorization: `Bearer ${token.access_token}`, Accept: "application/json", "User-Agent": "Clauxen-OAuth" };
  const user = await getJson(provider === "github" ? "https://api.github.com/user" : "https://gitlab.com/api/v4/user", { headers }, fetcher);
  ensure(Number.isSafeInteger(user.id) && user.id > 0, 502, "invalid_provider_identity");
  let email: string | undefined;
  if (provider === "github") {
    const emails = await getJson("https://api.github.com/user/emails?per_page=100", { headers }, fetcher);
    ensure(Array.isArray(emails), 502, "invalid_provider_identity");
    email = emails.find((item: any) => item.primary === true && item.verified === true)?.email;
    email ??= emails.find((item: any) => item.verified === true)?.email;
  } else if (typeof user.confirmed_at === "string" && user.confirmed_at.length > 0) {
    email = user.email;
  }
  ensure(typeof email === "string" && email.includes("@") && email.length <= 320, 403, "verified_email_required");
  return { sub: String(user.id), provider_id: String(user.id), email, email_verified: true,
    name: typeof user.name === "string" ? user.name : "", preferred_username: String(user.login ?? user.username ?? ""),
    picture: typeof user.avatar_url === "string" ? user.avatar_url : "" };
}
