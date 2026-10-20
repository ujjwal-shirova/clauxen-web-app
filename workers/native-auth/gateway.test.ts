import assert from "node:assert/strict";
import { test } from "node:test";
import { handleNativeAuth } from "./src/gateway";

const base = "https://www.clauxen.com/api/v1/auth/native/";
const env = {
  SUPABASE_URL: "https://shared-project.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture",
  AUTH_RATE_LIMIT: { limit: async () => ({ success: true }) },
} as unknown as NativeAuthEnv;
const google = { provider: "google", id_token: "fixture-signed-google-token", nonce: "n".repeat(43) };
function request(endpoint: string, body?: unknown, headers: Record<string, string> = {}, method = body ? "POST" : "GET") {
  return new Request(base + endpoint, { method, headers: { "Content-Type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body) });
}
const noNetwork: typeof fetch = async () => { throw new Error("Unexpected upstream request"); };

test("Google exchange uses fixed project and public server key, preserving nonce and GoTrue session format", async () => {
  const session = { access_token: "supabase-fixture", refresh_token: "refresh-fixture", user: { id: "shared-web-user" } };
  let calls = 0;
  const upstream: typeof fetch = async (input, init) => {
    calls++;
    assert.equal(String(input), "https://shared-project.supabase.co/auth/v1/token?grant_type=id_token");
    const headers = new Headers(init?.headers);
    assert.equal(headers.get("apikey"), env.SUPABASE_PUBLISHABLE_KEY);
    assert.equal(headers.get("Cookie"), null);
    assert.equal(headers.get("Authorization"), null);
    assert.deepEqual(JSON.parse(String(init?.body)), google);
    assert.equal(init?.redirect, "manual");
    return Response.json(session, { headers: { "Set-Cookie": "do-not-forward=true", "Cache-Control": "public" } });
  };
  const response = await handleNativeAuth(request("token?grant_type=id_token", google,
    { apikey: "attacker-key", Cookie: "web-session=untrusted" }), env, upstream);
  assert.equal(calls, 1);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), session);
  assert.match(response.headers.get("Cache-Control")!, /no-store/);
  assert.equal(response.headers.get("Set-Cookie"), null);
});

test("refresh passes the refresh token through the same gateway without creating another identity", async () => {
  const response = await handleNativeAuth(request("token?grant_type=refresh_token", { refresh_token: "existing-refresh" }), env,
    async (input, init) => {
      assert.match(String(input), /grant_type=refresh_token$/);
      assert.equal(JSON.parse(String(init?.body)).refresh_token, "existing-refresh");
      return Response.json({ access_token: "rotated", refresh_token: "rotated-refresh" });
    });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).access_token, "rotated");
});

test("invalid provider, missing nonce and short nonce are rejected before contacting Supabase", async () => {
  for (const body of [{ ...google, provider: "github" }, { ...google, nonce: undefined }, { ...google, nonce: "short" }]) {
    assert.equal((await handleNativeAuth(request("token?grant_type=id_token", body), env, noNetwork)).status, 400);
  }
});

test("administrative, unsupported and encoded paths cannot reach the upstream", async () => {
  for (const endpoint of ["admin/users", "signup", "token/extra", "token%2Fadmin", "settings", "token?grant_type=client_credentials"]) {
    const response = await handleNativeAuth(request(endpoint, google), env, noNetwork);
    assert.ok([400, 404].includes(response.status));
  }
});

test("wrong method, content type, malformed JSON and oversized bodies are rejected", async () => {
  assert.equal((await handleNativeAuth(request("token"), env, noNetwork)).status, 405);
  const unsupported = request("token?grant_type=id_token", google, { "Content-Type": "text/plain" });
  assert.equal((await handleNativeAuth(unsupported, env, noNetwork)).status, 415);
  for (const [raw, status] of [["{", 400], ["[]", 400], ["x".repeat(65537), 413]] as const) {
    const input = new Request(base + "token?grant_type=id_token", { method: "POST", body: raw,
      headers: { "Content-Type": "application/json" } });
    assert.equal((await handleNativeAuth(input, env, noNetwork)).status, status);
  }
});

test("OAuth retains PKCE and the fixed native callback, without consuming the provider redirect", async () => {
  const query = new URLSearchParams({ provider: "gitlab", redirect_to: "com.clauxen.mobile://auth-callback",
    code_challenge_method: "s256", code_challenge: "c".repeat(43), scopes: "read_user" });
  const response = await handleNativeAuth(request(`authorize?${query}`), env, noNetwork);
  assert.equal(response.status, 302);
  const location = new URL(response.headers.get("Location")!);
  assert.equal(location.origin, "https://auth.clauxen.com");
  assert.equal(location.pathname, "/auth/v1/authorize");
  assert.equal(location.searchParams.toString(), query.toString());
});

test("foreign callbacks, missing PKCE and duplicate queries are rejected", async () => {
  for (const endpoint of ["authorize?provider=gitlab", "authorize?provider=github&redirect_to=https://evil.example",
    "token?grant_type=id_token&grant_type=password"]) {
    const response = await handleNativeAuth(request(endpoint, endpoint.startsWith("token") ? google : undefined), env, noNetwork);
    assert.equal(response.status, 400);
  }
});

test("session bearer reaches user lookup and logout; unauthenticated lookup is rejected", async () => {
  assert.equal((await handleNativeAuth(request("user"), env, noNetwork)).status, 401);
  for (const endpoint of ["user", "logout?scope=local"]) {
    const response = await handleNativeAuth(request(endpoint, undefined, { Authorization: "Bearer user-session-jwt" },
      endpoint === "user" ? "GET" : "POST"), env, async (_, init) => {
      assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer user-session-jwt");
      return new Response(null, { status: 204 });
    });
    assert.equal(response.status, 204);
  }
});

test("Supabase rejects invalid Google tokens; its status and error are preserved", async () => {
  const response = await handleNativeAuth(request("token?grant_type=id_token", google), env,
    async () => Response.json({ error_code: "bad_jwt", msg: "Invalid Google token" }, { status: 400 }));
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error_code, "bad_jwt");
});

test("rate-limited calls and foreign origins never contact Supabase", async () => {
  const limited = { ...env, AUTH_RATE_LIMIT: { limit: async () => ({ success: false }) } } as unknown as NativeAuthEnv;
  const response = await handleNativeAuth(request("token?grant_type=id_token", google), limited, noNetwork);
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("Retry-After"), "60");
  assert.equal((await handleNativeAuth(request("token?grant_type=id_token", google, { Origin: "https://evil.example" }), env, noNetwork)).status, 403);
});

test("network failures and HTML challenges return safe errors without sensitive exception text", async () => {
  for (const upstream of [async () => { throw new Error("private-refresh-token"); },
    async () => new Response("<html>blocked</html>", { status: 403 })]) {
    const response = await handleNativeAuth(request("token?grant_type=id_token", google), env, upstream);
    assert.equal(response.status, 502);
    assert.doesNotMatch(await response.text(), /private-refresh-token|<html>/);
  }
});

test("missing server configuration fails closed", async () => {
  const response = await handleNativeAuth(request("token?grant_type=id_token", google),
    { ...env, SUPABASE_PUBLISHABLE_KEY: "" }, noNetwork);
  assert.equal(response.status, 503);
});

test("Google browser fallback keeps PKCE and account selection on the shared identity backend", async () => {
  const query = new URLSearchParams({ provider: "google", redirect_to: "com.clauxen.mobile://auth-callback",
    code_challenge_method: "s256", code_challenge: "c".repeat(43), prompt: "select_account" });
  const response = await handleNativeAuth(request(`authorize?${query}`), env, async (input) => {
    const url = new URL(String(input));
    assert.equal(url.host, "shared-project.supabase.co");
    assert.equal(url.searchParams.get("provider"), "google");
    assert.equal(url.searchParams.get("prompt"), "select_account");
    return new Response(null, { status: 302, headers: { Location: "https://accounts.google.com/o/oauth2/v2/auth?fixture=1" } });
  });
  assert.equal(response.status, 302);
  assert.equal(new URL(response.headers.get("Location")!).hostname, "accounts.google.com");
  assert.equal((await handleNativeAuth(request("authorize?provider=facebook"), env, noNetwork)).status, 400);
});
