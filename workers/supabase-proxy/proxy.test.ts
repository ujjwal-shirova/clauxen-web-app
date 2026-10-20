import { test } from "node:test";
import assert from "node:assert/strict";
import { handleProxy, type Env } from "./src/index";

const env: Env = { AUTH_RATE_LIMIT: { limit: async () => ({ success: true }) } };

test("enabled providers use the broker while preserving application PKCE and redirect", async () => {
  const request = new Request("https://auth.clauxen.com/auth/v1/authorize?provider=github&code_challenge=unchanged&redirect_to=com.clauxen.mobile%3A%2F%2Fauth-callback");
  await handleProxy(request, { ...env, BROKER_PROVIDERS: "github,gitlab" }, (async target => {
    const url = new URL(String(target));
    assert.equal(url.searchParams.get("provider"), "custom:clauxen-github");
    assert.equal(url.searchParams.get("code_challenge"), "unchanged");
    assert.equal(url.searchParams.get("redirect_to"), "com.clauxen.mobile://auth-callback");
    return new Response(null, { status: 302, headers: { Location: "https://auth.clauxen.com/oauth/github/authorize" } });
  }) as typeof fetch);
});

test("forwards caller credentials and PKCE without accepting an upstream override", async () => {
  const request = new Request("https://auth.clauxen.com/auth/v1/token?grant_type=pkce&host=evil.example", {
    method: "POST", headers: { apikey: "public-test-key", Authorization: "Bearer test-jwt", "Content-Type": "application/json", Cookie: "app-session=private", "X-Forwarded-Host": "evil.example", "sb-forwarded-for": "127.0.0.1" },
    body: JSON.stringify({ auth_code: "test-code", code_verifier: "test-verifier" }),
  });
  const response = await handleProxy(request, env, (async (target, init) => {
    assert.equal(String(target), "https://ntplcfsbcyhiqklkbldk.supabase.co/auth/v1/token?grant_type=pkce&host=evil.example");
    const headers = new Headers(init?.headers);
    assert.equal(headers.get("apikey"), "public-test-key");
    assert.equal(headers.get("Authorization"), "Bearer test-jwt");
    for (const name of ["cookie", "x-forwarded-host", "sb-forwarded-for"]) assert.equal(headers.get(name), null);
    assert.deepEqual(await new Response(init?.body).json(), { auth_code: "test-code", code_verifier: "test-verifier" });
    assert.equal(init?.redirect, "manual");
    return Response.json({ error: "invalid_grant" }, { status: 400 });
  }) as typeof fetch);
  assert.equal(response.status, 400);
  assert.match(response.headers.get("Cache-Control")!, /no-store/);
});

test("provider redirect and signed state remain byte-for-byte unchanged", async () => {
  const location = "https://gitlab.com/oauth/authorize?redirect_uri=https%3A%2F%2Fntplcfsbcyhiqklkbldk.supabase.co%2Fauth%2Fv1%2Fcallback&state=signed-state";
  const response = await handleProxy(new Request("https://auth.clauxen.com/auth/v1/authorize?provider=gitlab"), env,
    (async () => new Response(null, { status: 302, headers: { Location: location } })) as typeof fetch);
  assert.equal(response.headers.get("Location"), location);
});

test("callback forwards provider code/state without following the final redirect", async () => {
  const response = await handleProxy(new Request("https://auth.clauxen.com/auth/v1/callback?code=provider-code&state=signed-state"), env,
    (async (target) => {
      assert.equal(String(target), "https://ntplcfsbcyhiqklkbldk.supabase.co/auth/v1/callback?code=provider-code&state=signed-state");
      return new Response(null, { status: 302, headers: { Location: "com.clauxen.mobile://auth-callback?code=pkce-code" } });
    }) as typeof fetch);
  assert.equal(response.headers.get("Location"), "com.clauxen.mobile://auth-callback?code=pkce-code");
});

test("unknown and administrative routes never reach upstream", async () => {
  for (const path of ["/auth/v1/admin/users", "/unknown", "/auth/v1/../../admin"]) {
    const response = await handleProxy(new Request(`https://auth.clauxen.com${path}`), env, (async () => { throw new Error("must not fetch"); }) as typeof fetch);
    assert.equal(response.status, 404);
  }
});

test("CORS preflight and streaming REST responses preserve upstream protocol", async () => {
  const response = await handleProxy(new Request("https://auth.clauxen.com/rest/v1/profiles?select=id", { method: "OPTIONS", headers: { Origin: "https://www.clauxen.com", "Access-Control-Request-Headers": "apikey,authorization" } }), env,
    (async (_target, init) => {
      assert.equal(new Headers(init?.headers).get("Origin"), "https://www.clauxen.com");
      return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "apikey,authorization" } });
    }) as typeof fetch);
  assert.equal(response.status, 204);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), "*");
  const stream = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode("[]")); controller.close(); } });
  const data = await handleProxy(new Request("https://auth.clauxen.com/rest/v1/profiles"), env, (async () => new Response(stream)) as typeof fetch);
  assert.equal(await data.text(), "[]");
});

test("rate limit and upstream failures return non-sensitive errors", async () => {
  const request = new Request("https://auth.clauxen.com/auth/v1/token", { method: "POST" });
  const limited = await handleProxy(request, { AUTH_RATE_LIMIT: { limit: async () => ({ success: false }) } });
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("Retry-After"), "60");
  const failed = await handleProxy(request, env, (async () => { throw new Error("secret-token"); }) as typeof fetch);
  assert.equal(failed.status, 502);
  assert.doesNotMatch(await failed.text(), /secret-token/);
});
