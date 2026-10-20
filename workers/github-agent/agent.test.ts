import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, createHmac } from "node:crypto";
import {
  seal,
  unseal,
  verifyWebhook,
  readBody,
  HttpError,
} from "./src/security";
import { changeSchema, manifest } from "./src/contracts";
import { sameOrigin, requireUser } from "./src/auth";
import { repositories, createChange } from "./src/github";
import type { Client } from "pg";
const key = randomBytes(32).toString("base64");
const env = {
  SEAL_KEY: key,
  APP_ORIGIN: "https://www.clauxen.com",
  SUPABASE_URL: "https://ntplcfsbcyhiqklkbldk.supabase.co",
} as GithubAgentEnv;
const valid = {
  owner: "shirova-ai",
  repo: "test",
  request_id: crypto.randomUUID(),
  base_branch: "master",
  expected_head_sha: "a".repeat(40),
  title: "Improve docs",
  files: [{ path: "README.md", content: "example" }],
};

test("GitHub credentials round-trip only for the correct encryption context", async () => {
  const value = await seal(key, { token: "private" }, "user:one");
  assert.deepEqual(await unseal(key, value, "user:one"), { token: "private" });
  await assert.rejects(unseal(key, value, "user:two"));
  await assert.rejects(
    unseal(randomBytes(32).toString("base64"), value, "user:one"),
  );
});
test("tampered ciphertext is rejected", async () => {
  const bytes = Buffer.from(
    await seal(key, { secret: "value" }, "app"),
    "base64",
  );
  bytes[20] ^= 1;
  await assert.rejects(unseal(key, bytes.toString("base64"), "app"));
});
test("webhook HMAC validates raw bytes and rejects modified payloads", async () => {
  const body = '{"action":"deleted"}',
    secret = "test-webhook";
  const signature =
    "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
  assert.equal(await verifyWebhook(secret, body, signature), true);
  assert.equal(await verifyWebhook(secret, body + " ", signature), false);
  assert.equal(await verifyWebhook(secret, body, "sha256=bad"), false);
});
test("request body limit covers streamed bodies without content-length", async () => {
  const request = new Request("https://www.clauxen.com/test", {
    method: "POST",
    body: "123456",
  });
  await assert.rejects(
    readBody(request, 3),
    (e) => e instanceof HttpError && e.status === 413,
  );
});
test("manifest uses canonical callbacks with minimum repository permissions", () => {
  const app = manifest(env.APP_ORIGIN);
  assert.deepEqual(app.default_permissions, {
    contents: "write",
    pull_requests: "write",
    metadata: "read",
  });
  assert.equal(
    app.redirect_url,
    env.APP_ORIGIN + "/api/v1/github/manifest/callback",
  );
  assert.deepEqual(app.default_events, []);
});
test("cross-site browser writes are rejected", () => {
  assert.throws(() =>
    sameOrigin(
      new Request(env.APP_ORIGIN, {
        headers: { Origin: "https://evil.example" },
      }),
      env,
    ),
  );
  assert.doesNotThrow(() =>
    sameOrigin(
      new Request(env.APP_ORIGIN, { headers: { Origin: env.APP_ORIGIN } }),
      env,
    ),
  );
});
test("anonymous and malformed sessions cannot authorize GitHub", async () => {
  await assert.rejects(
    requireUser(new Request(env.APP_ORIGIN), env),
    (e) => e instanceof HttpError && e.status === 401,
  );
  await assert.rejects(
    requireUser(
      new Request(env.APP_ORIGIN, {
        headers: { Authorization: "Bearer broken" },
      }),
      env,
    ),
  );
});
for (const path of [
  "../secrets",
  "/etc/passwd",
  ".git/config",
  "a/../b",
  "a\\b",
  ".github/workflows/deploy.yml",
]) {
  test(`write validation rejects unsafe path ${path}`, () =>
    assert.equal(
      changeSchema.safeParse({ ...valid, files: [{ path, content: "bad" }] })
        .success,
      false,
    ));
}
test("duplicate file paths are rejected", () =>
  assert.equal(
    changeSchema.safeParse({
      ...valid,
      files: [valid.files[0], valid.files[0]],
    }).success,
    false,
  ));
test("writes require a base SHA and idempotency UUID", () => {
  assert.equal(
    changeSchema.safeParse({ ...valid, expected_head_sha: "main" }).success,
    false,
  );
  assert.equal(
    changeSchema.safeParse({ ...valid, request_id: "repeat-me" }).success,
    false,
  );
});
test("repository enumeration uses the current user GitHub token, never a global installation list", async () => {
  const userId = crypto.randomUUID(),
    token = "user-oauth-token";
  const encrypted = await seal(key, { access_token: token }, `user:${userId}`);
  const fakeDb = {
    query: async (sql: string) => ({
      rows: sql.startsWith("select tokens")
        ? [{ tokens_sealed: encrypted, login: "member", github_user_id: "100" }]
        : [],
    }),
  } as unknown as Client;
  const original = globalThis.fetch;
  const paths: string[] = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    paths.push(new URL(url).pathname);
    assert.equal(
      (init?.headers as Record<string, string>).Authorization,
      `Bearer ${token}`,
    );
    return Response.json(
      url.includes("/repositories")
        ? { repositories: [], total_count: 0 }
        : {
            installations: [
              { id: 42, account: { login: "org" }, suspended_at: null },
            ],
          },
    );
  };
  try {
    await repositories(fakeDb, env, userId, 1);
    assert.deepEqual(paths, [
      "/user/installations",
      "/user/installations/42/repositories",
    ]);
  } finally {
    globalThis.fetch = original;
  }
});
test("read-only repository members cannot create commits or installation tokens", async () => {
  const userId = crypto.randomUUID(),
    encrypted = await seal(key, { access_token: "user" }, `user:${userId}`);
  const fakeDb = {
    query: async (sql: string) => ({
      rows: sql.startsWith("select tokens")
        ? [{ tokens_sealed: encrypted, login: "reader", github_user_id: "100" }]
        : [],
    }),
  } as unknown as Client;
  const original = globalThis.fetch;
  const requests: string[] = [];
  globalThis.fetch = async (input) => {
    requests.push(String(input));
    return Response.json({ id: 1, permissions: { push: false } });
  };
  try {
    await assert.rejects(
      createChange(fakeDb, env, userId, valid),
      (e) => e instanceof HttpError && e.status === 403,
    );
    assert.equal(requests.length, 1);
  } finally {
    globalThis.fetch = original;
  }
});

test("a write creates only a new bot-attributed branch and a draft pull request", async () => {
  const { generateKeyPairSync } = await import("node:crypto");
  const pair = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const pem = pair.privateKey
    .export({ type: "pkcs1", format: "pem" })
    .toString();
  const userId = crypto.randomUUID();
  const tokens = await seal(
    key,
    { access_token: "user-token" },
    `user:${userId}`,
  );
  const credentials = await seal(
    key,
    { pem, client_secret: "secret", webhook_secret: "hook" },
    "app",
  );
  const statements: string[] = [];
  const fakeDb = {
    query: async (sql: string) => {
      statements.push(sql);
      if (sql.startsWith("select tokens"))
        return {
          rows: [
            { tokens_sealed: tokens, login: "member", github_user_id: "123" },
          ],
        };
      if (sql.startsWith("select app_id"))
        return {
          rows: [
            {
              app_id: "1",
              client_id: "Iv1.test",
              slug: "clauxen-agent",
              credentials_sealed: credentials,
            },
          ],
        };
      if (sql.startsWith("insert into private.github_agent_changes"))
        return { rows: [{ id: "run" }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    },
  } as unknown as Client;
  const original = globalThis.fetch;
  const writes: { path: string; body: Record<string, unknown> }[] = [];
  globalThis.fetch = async (input, init) => {
    const path = new URL(String(input)).pathname;
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    if (init?.method === "POST") writes.push({ path, body });
    if (path.endsWith("/test"))
      return Response.json({
        id: 99,
        full_name: "shirova-ai/test",
        permissions: { push: true },
      });
    if (path.endsWith("/installation"))
      return Response.json({ id: 42, suspended_at: null });
    if (path.endsWith("/access_tokens")) {
      assert.deepEqual(body.repository_ids, [99]);
      return Response.json({ token: "installation-token" });
    }
    if (path.endsWith("/git/ref/heads/master"))
      return Response.json({ object: { sha: valid.expected_head_sha } });
    if (path.endsWith("/git/commits/" + valid.expected_head_sha))
      return Response.json({ tree: { sha: "tree-base" } });
    if (path.startsWith("/users/"))
      return Response.json({ id: 456, login: "clauxen-agent[bot]" });
    if (path.endsWith("/pulls"))
      return Response.json({
        html_url: "https://github.com/shirova-ai/test/pull/1",
        number: 1,
      });
    return Response.json({ sha: "b".repeat(40) });
  };
  try {
    const result = await createChange(fakeDb, env, userId, valid);
    assert.equal(result.pull_request_number, 1);
    const commit = writes.find((w) => w.path.endsWith("/git/commits"))!.body;
    assert.deepEqual(commit.author, {
      name: "Clauxen Agent",
      email: "456+clauxen-agent[bot]@users.noreply.github.com",
    });
    assert.match(
      String(commit.message),
      /Co-authored-by: member <123\+member@users.noreply.github.com>/,
    );
    assert.deepEqual(writes.find((w) => w.path.endsWith("/git/refs"))!.body, {
      ref: `refs/heads/clauxen/${valid.request_id}`,
      sha: "b".repeat(40),
    });
    assert.equal(
      writes.find((w) => w.path.endsWith("/pulls"))!.body.draft,
      true,
    );
    assert.ok(statements.some((s) => s.includes("status='complete'")));
    assert.ok(writes.every((w) => !w.path.includes("/git/refs/heads/master")));
  } finally {
    globalThis.fetch = original;
  }
});
