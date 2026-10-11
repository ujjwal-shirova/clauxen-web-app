import assert from "node:assert/strict";
import { after, test as nodeTest } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { SignJWT, generateKeyPair, exportJWK } from "jose";
import { NextRequest } from "next/server.js";

// These tests execute application code with service doubles; no browser or
// production account is used. Keep generated modules inside the project so
// external packages resolve normally.
const directory = await mkdtemp(
  new URL("../node_modules/.cache-auth-", import.meta.url),
);
const cases = [];
function test(name, run) {
  cases.push([name, run]);
}
let bundleNumber = 0;
async function load(entry, mocks = {}) {
  const outfile = `${directory}/${++bundleNumber}.mjs`;
  await build({
    entryPoints: [entry],
    outfile,
    bundle: true,
    platform: "node",
    format: "esm",
    packages: "external",
    logLevel: "silent",
    plugins: [
      {
        name: "service-doubles",
        setup(builder) {
          builder.onResolve({ filter: /^next\/server$/ }, () => ({
            path: "next/server.js",
            external: true,
          }));
          builder.onResolve({ filter: /.*/ }, (args) =>
            args.path in mocks
              ? { path: args.path, namespace: "double" }
              : undefined,
          );
          builder.onLoad({ filter: /.*/, namespace: "double" }, (args) => ({
            contents: mocks[args.path],
            loader: "js",
          }));
        },
      },
    ],
  });
  return import(pathToFileURL(outfile).href);
}
const config = `export const getSupabaseUrl = () => 'https://fixture.supabase.co';
export const getSupabasePublicConfig = () => ({url: getSupabaseUrl(), publishableKey: 'fixture'});
export const requireSupabasePublicConfig = getSupabasePublicConfig;`;
process.env.SUPABASE_JWT_SECRET = "offline-test-key-never-used-in-production";
const secret = new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET);
const jwt = await load("src/server/auth/jwt.ts", {
  "@/utils/supabase/env": config,
});
async function signed(overrides = {}) {
  return new SignJWT({
    sub: "user-fixture",
    role: "authenticated",
    iss: "https://fixture.supabase.co/auth/v1",
    aud: "authenticated",
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...overrides,
  })
    .setProtectedHeader({ alg: "HS256" })
    .sign(secret);
}

test("valid session JWT is reused while expired, foreign and incomplete JWTs are rejected", async () => {
  const token = await signed();
  assert.equal((await jwt.verifyAccessToken(token)).sub, "user-fixture");
  assert.equal((await jwt.verifyAccessToken(token)).sub, "user-fixture");
  for (const claims of [
    { exp: 1 },
    { aud: "service_role" },
    { iss: "https://foreign.invalid/auth/v1" },
    { exp: undefined },
    { role: "service_role" },
  ]) {
    assert.equal(await jwt.verifyAccessToken(await signed(claims)), null);
  }
  assert.equal(await jwt.verifyAccessToken("broken"), null);
});

test("chunked SSR session cookies recover the access token", async () => {
  const token = await signed();
  const encoded = `base64-${Buffer.from(JSON.stringify({ access_token: token })).toString("base64url")}`;
  const cookies = [
    { name: "sb-fixture-auth-token.0", value: encoded.slice(0, 80) },
    { name: "sb-fixture-auth-token.1", value: encoded.slice(80) },
  ];
  assert.equal(
    await jwt.readAccessTokenFromCookies({ getAll: () => cookies }),
    token,
  );
  assert.equal(
    await jwt.readAccessTokenFromCookies({
      getAll: () => [{ name: "sb-fixture-auth-token", value: "invalid" }],
    }),
    null,
  );
});

test("JWKS service failure is retryable rather than an invalid-session result", async () => {
  const originalFetch = globalThis.fetch;
  const pair = await generateKeyPair("ES256");
  const token = await new SignJWT({ role: "authenticated" })
    .setSubject("user-fixture")
    .setIssuer("https://fixture.supabase.co/auth/v1")
    .setAudience("authenticated")
    .setExpirationTime("1h")
    .setProtectedHeader({ alg: "ES256", kid: "fixture-key" })
    .sign(pair.privateKey);
  try {
    globalThis.fetch = async () => new Response("unavailable", { status: 503 });
    await assert.rejects(
      jwt.verifyAccessToken(token),
      (error) => error.status === 503 && error.code === "auth_unavailable",
    );
    const key = {
      ...(await exportJWK(pair.publicKey)),
      kid: "fixture-key",
      alg: "ES256",
    };
    let requests = 0;
    globalThis.fetch = async () => {
      requests++;
      return Response.json({ keys: [key] });
    };
    assert.equal((await jwt.verifyAccessToken(token)).sub, "user-fixture");
    jwt.clearTokenClaimsCache();
    assert.equal((await jwt.verifyAccessToken(token)).sub, "user-fixture");
    assert.equal(
      requests,
      1,
      "public keys survive across verifications without sharing a pending fetch",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

const state = {
  claims: null,
  error: null,
  user: { id: "user-fixture", email: "fixture@example.com" },
};
globalThis.__authTest = state;

const middleware = await load("src/shared/utils/supabase/middleware.ts", {
  "./env": config,
  "@/server/auth/jwt": `export async function getClaimsFromCookies() {if(globalThis.__authTest.error) throw globalThis.__authTest.error; return globalThis.__authTest.claims;}`,
  "@supabase/ssr": `export const DEFAULT_COOKIE_OPTIONS = {path:'/', sameSite:'lax', httpOnly:false, maxAge:34560000};
export function createServerClient(url, key, options) { return {auth: {async getUser() {
options.cookies.setAll([{name:'sb-fixture-auth-token', value:'renewed', options:{path:'/', maxAge:34560000, httpOnly:true, sameSite:'lax'}}], {'Cache-Control':'private, no-store'});
return {data:{user:globalThis.__authTest.user}, error:globalThis.__authTest.remoteError};
}}}; }`,
});
function request(path) {
  return new NextRequest(`https://app.example.com${path}`, {
    headers: {
      cookie:
        "sb-fixture-auth-token=old; sb-fixture-auth-token-code-verifier=private",
    },
  });
}

test("proxy renewal keeps auth cookies readable and persistent", async () => {
  const response = await middleware.updateSession(request("/new"));
  const cookie = response.cookies.get("sb-fixture-auth-token");
  assert.equal(cookie.value, "renewed");
  assert.equal(cookie.httpOnly, false);
  assert.equal(cookie.path, "/");
  assert.ok(cookie.maxAge > 0);
  assert.match(response.headers.get("cache-control"), /no-store/);
});

test("valid existing cookies are repaired without exposing the PKCE verifier", async () => {
  state.claims = { sub: "user-fixture", email: "fixture@example.com" };
  const response = await middleware.updateSession(request("/new"));
  assert.equal(response.cookies.get("sb-fixture-auth-token").httpOnly, false);
  assert.equal(response.cookies.get("sb-fixture-auth-token").value, "old");
  assert.equal(
    response.cookies.has("sb-fixture-auth-token-code-verifier"),
    false,
  );
  state.claims = null;
});

test("redirects retain rotated cookie lifetime and private cache headers", async () => {
  state.user = null;
  const response = await middleware.updateSession(request("/chat/fixture"));
  assert.equal(response.status, 307);
  assert.ok(response.cookies.get("sb-fixture-auth-token").maxAge > 0);
  assert.equal(response.cookies.get("sb-fixture-auth-token").httpOnly, false);
  assert.match(response.headers.get("cache-control"), /no-store/);
  state.user = { id: "user-fixture" };
});

test("temporary verification failure does not clear cookies or redirect to login", async () => {
  state.error = new Error("temporary key service failure");
  const response = await middleware.updateSession(request("/chat/fixture"));
  assert.equal(response.status, 503);
  assert.equal(response.cookies.getAll().length, 0);
  assert.equal(response.headers.has("location"), false);
  state.error = null;
});

const transportState = { token: "initial", renewals: 0 };
globalThis.__authTransportTest = transportState;

const client = await load("src/shared/lib/api/client.ts", {
  "@/utils/supabase/client": `export function createClient() {return {auth:{async refreshSession() {
    globalThis.__authTransportTest.renewals++;
    await new Promise(resolve => setTimeout(resolve, 5));
    globalThis.__authTransportTest.token = 'renewed';
    return {data:{session:{access_token:'renewed'}}, error:null};
  }}};}`,
  "@/lib/supabase-session-singleflight": `export async function getSupabaseAccessTokenSingleflight() {return globalThis.__authTransportTest.token;}
export function clearSupabaseAccessTokenSingleflight() {}`,
});

test("concurrent JSON and streaming requests renew once and replay with the fresh token", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.window = { location: { origin: "https://app.example.com" } };
  const attempts = [];
  try {
    globalThis.fetch = async (path, init) => {
      const authorization = new Headers(init.headers).get("authorization");
      attempts.push({ path, authorization });
      return authorization === "Bearer renewed"
        ? Response.json({ data: { ok: true } })
        : Response.json({ error: { code: "unauthorized" } }, { status: 401 });
    };
    const [json, stream] = await Promise.all([
      client.apiFetch("/api/v1/chats"),
      client.sessionFetch("/api/v1/chats/fixture/generate", {
        method: "POST",
        body: '{"prompt":"hello"}',
      }),
    ]);
    assert.equal(json.ok, true);
    assert.equal(stream.status, 200);
    assert.equal(transportState.renewals, 1);
    assert.equal(
      attempts.filter((a) => a.authorization === "Bearer renewed").length,
      2,
    );
  } finally {
    globalThis.fetch = originalFetch;
    delete globalThis.window;
  }
});

test("forbidden responses and external URLs never trigger renewal or leak the session token", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.window = { location: { origin: "https://app.example.com" } };
  const renewals = transportState.renewals;
  try {
    globalThis.fetch = async (path, init) => {
      if (path.startsWith("https://external"))
        assert.equal(new Headers(init.headers).has("authorization"), false);
      return new Response("forbidden", { status: 403 });
    };
    assert.equal((await client.sessionFetch("/api/v1/chats")).status, 403);
    await client.sessionFetch("https://external.example.com/upload");
    assert.equal(transportState.renewals, renewals);
  } finally {
    globalThis.fetch = originalFetch;
    delete globalThis.window;
  }
});

const accountState = { exists: true, error: null, queries: [] };
globalThis.__authAccountTest = accountState;
const serverSession = await load("src/server/auth/session.ts", {
  "@/server/config/env": `export const env = {authDevBypass: false, sessionCookieName: 'clauxen_session'};`,
  "@/server/db/pool": `export async function queryOne(sql) {
    globalThis.__authAccountTest.queries.push(sql);
    if(globalThis.__authAccountTest.error) throw globalThis.__authAccountTest.error;
    return sql.includes('auth.users') && globalThis.__authAccountTest.exists ? {id:'user-fixture'} : null;
  }`,
  "@/server/repositories/api-keys.repository": `export async function resolveUserIdFromApiKey() {return null;}`,
  "@/server/auth/supabase-session": `export async function getSupabaseClaimsFromRequest() {return {sub:'user-fixture', email:'fixture@example.com'};}`,
  "@/server/oauth/service": `export async function resolveAccessTokenUser() {return null;}`,
});
test("a valid auth account remains signed in when its profile has not been provisioned", async () => {
  const session = await serverSession.getSessionFromRequest(
    request("/api/v1/chats"),
  );
  assert.equal(session.id, "user-fixture");
  assert.ok(accountState.queries.every((sql) => sql.includes("auth.users")));
});
test("deleted accounts are rejected without trusting identity hints or profile rows", async () => {
  serverSession.invalidateUserActiveCache();
  accountState.exists = false;
  await assert.rejects(
    serverSession.getSessionFromRequest(request("/api/v1/chats")),
    (error) => error.code === "account_deleted" && error.status === 401,
  );
  accountState.exists = true;
});
test("a database outage propagates as a service error rather than account deletion", async () => {
  serverSession.invalidateUserActiveCache();
  const outage = Object.assign(new Error("temporarily unavailable"), {
    status: 503,
    code: "database_unavailable",
  });
  accountState.error = outage;
  await assert.rejects(
    serverSession.getSessionFromRequest(request("/api/v1/chats")),
    (error) => error === outage,
  );
  accountState.error = null;
});

for (const [name, run] of cases) nodeTest(name, run);
after(async () => {
  delete globalThis.__authTest;
  delete globalThis.__authAccountTest;
  delete globalThis.__authTransportTest;
  await rm(directory, { recursive: true, force: true });
});
