import { authorization, providerClaims, type Credentials } from "./providers";
import { CALLBACK, SUPABASE_CALLBACK, ORIGIN, OAuthError, ensure, random, hash, equal, validSecret, unique, boundedText, json, redirect, clientId, type Provider, type FlowStore, type Claims } from "./protocol";

export interface BrokerDependencies {
  secret: string;
  credentials(provider: Provider): Credentials;
  flow(id: string): FlowStore;
  canonicalEmail(provider: Provider, subject: string, verifiedEmail: string): Promise<string>;
  fetcher: typeof fetch;
}
const cookieName = (id: string) => `__Host-clx-oauth-${id}`;
const cookie = (id: string, value: string, age: number) => `${cookieName(id)}=${value}; Secure; HttpOnly; SameSite=Lax; Path=/; Max-Age=${age}`;
function parseBearer(value: string, prefix: string): { id: string; secret: string } {
  const parts = value.split(".");
  ensure(parts.length === 3 && parts[0] === prefix && validSecret(parts[1]) && validSecret(parts[2]), 400, "invalid_grant");
  return { id: parts[1], secret: parts[2] };
}
function outerRedirect(state: string, params: Record<string, string>) {
  const url = new URL(SUPABASE_CALLBACK);
  url.search = new URLSearchParams({ ...params, state }).toString();
  return redirect(url);
}

export async function handleBroker(request: Request, deps: BrokerDependencies): Promise<Response> {
  try {
    ensure(new URL(request.url).origin === ORIGIN, 404, "not_found");
    const url = new URL(request.url);
    unique(url.searchParams);
    const route = /^\/oauth\/(github|gitlab)\/(authorize|token|userinfo)$/.exec(url.pathname);
    if (url.pathname === "/auth/v1/callback" && request.method === "GET") {
      const state = url.searchParams.get("state") ?? "";
      ensure(state.startsWith("clx.") && validSecret(state.slice(4)), 400, "invalid_state");
      const id = state.slice(4);
      const cookies = request.headers.get("Cookie") ?? "";
      const value = cookies.split(";").map(s => s.trim()).find(s => s.startsWith(`${cookieName(id)}=`))?.slice(cookieName(id).length + 1) ?? "";
      ensure(validSecret(value), 400, "invalid_state");
      const flow = deps.flow(id);
      const pending = await flow.take(await hash(value));
      ensure(pending, 400, "expired_or_replayed_state");
      let response: Response;
      if (url.searchParams.has("error")) {
        response = outerRedirect(pending.state, { error: "access_denied", error_description: "Sign-in was cancelled or denied." });
      } else {
        let stage = "provider_exchange";
        try {
          const code = url.searchParams.get("code");
          ensure(code && code.length < 2048);
          const claims = await providerClaims(pending.provider, deps.credentials(pending.provider), code, pending.verifier, deps.fetcher);
          // Only a successfully verified provider subject can reach this lookup.
          stage = "identity_lookup";
          claims.email = await deps.canonicalEmail(pending.provider, claims.sub, claims.email);
          stage = "broker_code";
          const secret = random();
          await flow.complete(await hash(secret), claims);
          response = outerRedirect(pending.state, { code: `clxcode.${id}.${secret}` });
        } catch {
          console.warn("clauxen_oauth_callback_failed", { stage, provider: pending.provider });
          response = outerRedirect(pending.state, { error: "access_denied", error_description: "Clauxen could not verify this account. Please try again." });
        }
      }
      response.headers.append("Set-Cookie", cookie(id, "", 0));
      return response;
    }
    ensure(route, 404, "not_found");
    const provider = route[1] as Provider, action = route[2];
    if (action === "authorize") {
      ensure(request.method === "GET", 405, "method_not_allowed");
      const p = url.searchParams;
      ensure(p.get("client_id") === clientId(provider) && p.get("redirect_uri") === SUPABASE_CALLBACK && p.get("response_type") === "code");
      const state = p.get("state") ?? "", challenge = p.get("code_challenge") ?? "";
      ensure(state.length >= 20 && state.length <= 8192 && validSecret(challenge) && p.get("code_challenge_method") === "S256");
      const id = random(), browserSecret = random(), verifier = random();
      await deps.flow(id).init({ provider, state, challenge, verifier, cookieHash: await hash(browserSecret), expires: Date.now() + 600_000 });
      const response = redirect(authorization(provider, deps.credentials(provider), `clx.${id}`, await hash(verifier)));
      response.headers.append("Set-Cookie", cookie(id, browserSecret, 600));
      return response;
    }
    if (action === "token") {
      ensure(request.method === "POST", 405, "method_not_allowed");
      ensure(request.headers.get("Content-Type")?.startsWith("application/x-www-form-urlencoded"));
      const body = new URLSearchParams(await boundedText(request, 16_384));
      unique(body);
      let suppliedId = body.get("client_id") ?? "", suppliedSecret = body.get("client_secret") ?? "";
      const auth = request.headers.get("Authorization");
      if (auth) {
        ensure(!suppliedId && !suppliedSecret && auth.startsWith("Basic "), 401, "invalid_client");
        let decoded = "";
        try { decoded = atob(auth.slice(6)); } catch { throw new OAuthError(401, "invalid_client"); }
        const colon = decoded.indexOf(":");
        ensure(colon > 0, 401, "invalid_client");
        suppliedId = decodeURIComponent(decoded.slice(0, colon)); suppliedSecret = decodeURIComponent(decoded.slice(colon + 1));
      }
      ensure(deps.secret.length >= 32 && suppliedId === clientId(provider) && await equal(suppliedSecret, deps.secret), 401, "invalid_client");
      ensure(body.get("grant_type") === "authorization_code" && body.get("redirect_uri") === SUPABASE_CALLBACK);
      const code = parseBearer(body.get("code") ?? "", "clxcode");
      const verifier = body.get("code_verifier") ?? "";
      ensure(/^[A-Za-z0-9._~-]{43,128}$/.test(verifier), 400, "invalid_grant");
      const tokenSecret = random();
      const success = await deps.flow(code.id).exchange(await hash(code.secret), await hash(verifier), provider, await hash(tokenSecret));
      ensure(success, 400, "invalid_grant");
      return json({ access_token: `clxtoken.${code.id}.${tokenSecret}`, token_type: "Bearer", expires_in: 60 });
    }
    ensure(action === "userinfo" && request.method === "GET", 405, "method_not_allowed");
    const auth = request.headers.get("Authorization") ?? "";
    ensure(auth.startsWith("Bearer "), 401, "invalid_token");
    const token = parseBearer(auth.slice(7), "clxtoken");
    const claims: Claims | null = await deps.flow(token.id).userinfo(await hash(token.secret), provider);
    ensure(claims, 401, "invalid_token");
    return json(claims);
  } catch (error) {
    return json({ error: error instanceof OAuthError ? error.code : "server_error" }, error instanceof OAuthError ? error.status : 502);
  }
}
