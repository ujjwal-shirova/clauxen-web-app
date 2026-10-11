import assert from "node:assert/strict";
import { test } from "node:test";
import { SignJWT } from "jose";
import type { MessageBatch } from "@cloudflare/workers-types";
import {
  consumeGenerationQueue,
  type GenerationMessage,
} from "../src/server/cloudflare/generation-queue";
import { handleSignedObject } from "../src/server/cloudflare/storage-access";
import {
  withRequestResources,
  requestResource,
} from "../src/server/cloudflare/request-resources";

const key = "test-only-storage-key-not-used-in-production";

test("database resources reuse one pool within an invocation and isolate concurrent requests", async () => {
  let created = 0;
  const disposed: number[] = [];
  const resource = () =>
    requestResource(
      "db",
      () => ({ id: ++created }),
      async (value) => {
        disposed.push(value.id);
      },
    );
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  const first = withRequestResources(async () => {
    const pool = resource();
    await waiting;
    assert.equal(resource(), pool);
    return pool;
  });
  const second = await withRequestResources(async () => {
    const pool = resource();
    assert.equal(resource(), pool);
    return pool;
  });
  release();
  const firstPool = await first;
  assert.notEqual(firstPool, second);
  assert.equal(created, 2);
  assert.deepEqual(disposed.sort(), [1, 2]);
  assert.equal(resource(), undefined);
});

test("database resources are disposed after failures and cleanup can run off the response path", async () => {
  let disposed = false;
  await assert.rejects(
    withRequestResources(async () => {
      requestResource(
        "db",
        () => ({}),
        async () => {
          disposed = true;
        },
      );
      throw new Error("fixture failure");
    }),
    /fixture failure/,
  );
  assert.equal(disposed, true);
  let finish!: () => void;
  const waiting = new Promise<void>((resolve) => {
    finish = resolve;
  });
  let cleanup!: Promise<void>;
  const result = await withRequestResources(
    async () => {
      requestResource(
        "db",
        () => ({}),
        () => waiting,
      );
      return "response-ready";
    },
    (pending) => {
      cleanup = pending;
    },
  );
  assert.equal(result, "response-ready");
  finish();
  await cleanup;
});
const objects = new Map<string, { body: string; type: string }>();
const env = {
  R2_SIGNING_KEY: key,
  R2_DOCUMENTS: {
    async put(
      name: string,
      body: ReadableStream,
      options: { httpMetadata: { contentType: string } },
    ) {
      objects.set(name, {
        body: await new Response(body).text(),
        type: options.httpMetadata.contentType,
      });
    },
    async get(name: string) {
      const object = objects.get(name);
      return object
        ? {
            body: new Response(object.body).body,
            size: new TextEncoder().encode(object.body).length,
            httpEtag: '"test-etag"',
            httpMetadata: { contentType: object.type },
          }
        : null;
    },
  },
} as unknown as CloudflareEnv;

async function objectRequest(
  method: string,
  claims: Record<string, unknown>,
  options: RequestInit = {},
  expires = "1h",
) {
  const token = await new SignJWT({
    bucket: "clauxen-documents",
    key: "fixture.txt",
    method,
    ...claims,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("clauxen-storage")
    .setAudience("clauxen-object")
    .setExpirationTime(expires)
    .sign(new TextEncoder().encode(key));
  return new Request(`https://app.test/api/v1/storage/object?token=${token}`, {
    method,
    ...options,
  });
}

test("private R2 upload and download preserve data and do not cache it publicly", async () => {
  const upload = await objectRequest(
    "PUT",
    { contentType: "text/plain" },
    { body: "hello", headers: { "content-length": "5" } },
  );
  assert.equal((await handleSignedObject(upload, env)).status, 204);
  const response = await handleSignedObject(
    await objectRequest("GET", {}),
    env,
  );
  assert.equal(await response.text(), "hello");
  assert.equal(response.headers.get("cache-control"), "private, no-store");
});

test("R2 rejects missing, expired, tampered, wrong-method and arbitrary-bucket tokens", async () => {
  assert.equal(
    (
      await handleSignedObject(
        new Request("https://app.test/api/v1/storage/object"),
        env,
      )
    ).status,
    401,
  );
  assert.equal(
    (await handleSignedObject(await objectRequest("GET", {}, {}, "-1s"), env))
      .status,
    401,
  );
  const valid = await objectRequest("GET", {});
  assert.equal(
    (await handleSignedObject(new Request(valid.url + "tampered"), env)).status,
    401,
  );
  assert.equal(
    (await handleSignedObject(new Request(valid.url, { method: "PUT" }), env))
      .status,
    403,
  );
  assert.equal(
    (
      await handleSignedObject(
        await objectRequest("GET", { bucket: "someone-else" }),
        env,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await handleSignedObject(
        await objectRequest("GET", { key: "../secret" }),
        env,
      )
    ).status,
    403,
  );
});

test("R2 prevents active uploaded documents from executing on the app origin", async () => {
  const upload = await objectRequest(
    "PUT",
    { contentType: "text/html" },
    { body: "<script>evil</script>", headers: { "content-length": "21" } },
  );
  assert.equal((await handleSignedObject(upload, env)).status, 204);
  const response = await handleSignedObject(
    await objectRequest("GET", {}),
    env,
  );
  assert.equal(response.headers.get("content-disposition"), "attachment");
  assert.equal(response.headers.get("content-security-policy"), "sandbox");
});

test("R2 preflight allows the app origin and rejects other origins", async () => {
  const configured = {
    ...env,
    NEXT_PUBLIC_APP_URL: "https://www.clauxen.com",
    GENERATIONS_EXECUTION_ORIGIN: "https://worker.test",
  };
  const allowed = await handleSignedObject(
    new Request("https://worker.test/api/v1/storage/object", {
      method: "OPTIONS",
      headers: { origin: "https://www.clauxen.com" },
    }),
    configured,
  );
  assert.equal(allowed.status, 204);
  assert.equal(
    allowed.headers.get("access-control-allow-origin"),
    "https://www.clauxen.com",
  );
  const denied = await handleSignedObject(
    new Request("https://worker.test/api/v1/storage/object", {
      method: "OPTIONS",
      headers: { origin: "https://evil.test" },
    }),
    configured,
  );
  assert.equal(denied.status, 403);
  assert.equal(denied.headers.get("access-control-allow-origin"), null);
});

test("queue acknowledges only after the complete slice and retries upstream failure", async () => {
  let acked = 0;
  let retried = 0;
  let complete!: (response: Response) => void;
  const pending = new Promise<Response>((resolve) => {
    complete = resolve;
  });
  const batch = {
    messages: [
      {
        body: { jobId: "fixture-job" },
        ack() {
          acked++;
        },
        retry() {
          retried++;
        },
      },
    ],
  } as unknown as MessageBatch<GenerationMessage>;
  const workerEnv = {
    CHAT_COORD_INTERNAL_TOKEN: "test-token",
    GENERATIONS_EXECUTION_ORIGIN: "https://worker.test",
  };
  const running = consumeGenerationQueue(batch, workerEnv, async (request) => {
    assert.equal(request.headers.get("x-clauxen-queue-execution"), "1");
    assert.equal(request.headers.get("x-clauxen-internal"), "test-token");
    assert.equal(new URL(request.url).hostname, "worker.test");
    return pending;
  });
  await Promise.resolve();
  assert.equal(acked, 0);
  complete(new Response(null, { status: 200 }));
  await running;
  assert.equal(acked, 1);
  await consumeGenerationQueue(
    batch,
    workerEnv,
    async () => new Response(null, { status: 503 }),
  );
  assert.equal(retried, 1);
  await consumeGenerationQueue(
    batch,
    workerEnv,
    async () => new Response(null, { status: 409 }),
  );
  assert.equal(acked, 2);
});

test("generation queues use the same token precedence as the internal endpoint", async () => {
  let acked = 0;
  const batch = {
    messages: [
      {
        body: { jobId: "fixture" },
        ack() {
          acked++;
        },
        retry() {
          throw new Error("Unexpected retry");
        },
      },
    ],
  } as unknown as MessageBatch<GenerationMessage>;
  await consumeGenerationQueue(
    batch,
    {
      GENERATIONS_INTERNAL_TOKEN: "generation-token",
      CHAT_COORD_INTERNAL_TOKEN: "coord-token",
      GENERATIONS_EXECUTION_ORIGIN: "https://worker.test",
    },
    async (request) => {
      assert.equal(
        request.headers.get("x-clauxen-internal"),
        "generation-token",
      );
      return new Response(null, { status: 200 });
    },
  );
  assert.equal(acked, 1);
});

test("research timer deliveries route to the authenticated start handler and retry premature deadlines", async () => {
  let acked = 0;
  let retryDelay = 0;
  const message = {
    body: { researchPlanId: "plan-fixture" },
    ack: () => acked++,
    retry: (options: { delaySeconds: number }) => {
      retryDelay = options.delaySeconds;
    },
  };
  const batch = {
    messages: [message],
  } as unknown as MessageBatch<GenerationMessage>;
  const env = {
    GENERATIONS_INTERNAL_TOKEN: "fixture",
    CHAT_COORD_INTERNAL_TOKEN: "",
    GENERATIONS_EXECUTION_ORIGIN: "https://worker.example",
  };
  await consumeGenerationQueue(batch, env, async (request) => {
    assert.equal(
      new URL(request.url).pathname,
      "/api/v1/internal/research/start",
    );
    assert.equal(request.headers.get("x-clauxen-internal"), "fixture");
    assert.deepEqual(await request.json(), { researchPlanId: "plan-fixture" });
    return new Response(null, { status: 425 });
  });
  assert.equal(retryDelay, 30);
  assert.equal(acked, 0);
  await consumeGenerationQueue(
    batch,
    env,
    async () => new Response(null, { status: 200 }),
  );
  assert.equal(acked, 1);
});
