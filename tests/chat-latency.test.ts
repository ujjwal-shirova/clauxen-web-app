import assert from "node:assert/strict";
import test from "node:test";
import { createDurableSubscription } from "../src/server/chat/durable-subscription";
import { providerThinkingControls } from "../src/server/inference/provider-thinking";
import { consumeClauxenStreamResponse } from "../src/shared/lib/ui-message-stream";
import {
  requestResource,
  withRequestResources,
} from "../src/server/cloudflare/request-resources";
import { runAutonomousAgent } from "../src/server/agent-core/runtime/query-loop";
import { ClauxenSseStream } from "../src/server/inference/clauxen-sse-stream";

const background = {
  type: "backgrounded" as const,
  jobId: "job",
  chatId: "chat",
};
const encode = (event: unknown) =>
  new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`);
const response = (stream: ReadableStream<Uint8Array>) =>
  new Response(stream, {
    headers: { "content-type": "text/event-stream" },
  });

test("first output reaches the subscriber before generation finishes", async () => {
  const subscription = createDurableSubscription(background);
  const reader = subscription.stream.getReader();
  const waiting = reader.read();
  subscription.write(encode({ type: "answer_delta", delta: "immediate" }));
  const first = await waiting;
  assert.equal(first.done, false);
  assert.match(new TextDecoder().decode(first.value), /immediate/);
  subscription.close();
  assert.equal((await reader.read()).done, true);
});

test("HTTP disconnect leaves the durable producer able to finish", async () => {
  const subscription = createDurableSubscription(background);
  const reader = subscription.stream.getReader();
  subscription.write(encode({ type: "start" }));
  await reader.read();
  await reader.cancel();
  let checkpoints = 0;
  for (let i = 0; i < 3; i++) {
    subscription.write(encode({ type: "answer_delta", delta: String(i) }));
    checkpoints++;
  }
  subscription.close();
  assert.equal(checkpoints, 3);
});

test("slow subscriptions hand off with bounded buffering and no false completion", async () => {
  const subscription = createDurableSubscription(background);
  subscription.write(encode({ type: "start" }));
  for (let i = 0; i < 100; i++) {
    subscription.write(
      encode({ type: "answer_delta", delta: "x".repeat(10_000) }),
    );
  }
  let bytes = 0;
  const text = await response(subscription.stream).text();
  bytes = new TextEncoder().encode(text).byteLength;
  assert.ok(bytes < 257 * 1024);
  assert.match(text, /"type":"backgrounded"/);
  assert.doesNotMatch(text, /"type":"done"/);
});

test("completed and yielded subscriptions retain the existing client protocol", async () => {
  const completed = createDurableSubscription(background);
  completed.write(encode({ type: "done" }));
  completed.close();
  assert.equal(
    await consumeClauxenStreamResponse(response(completed.stream), () => {}),
    "completed",
  );
  const yielded = createDurableSubscription(background);
  yielded.handoff();
  assert.equal(
    await consumeClauxenStreamResponse(response(yielded.stream), () => {}),
    "backgrounded",
  );
});

test("a streaming database scope survives the admission scope closing", async () => {
  let release!: () => void;
  const wait = new Promise<void>((resolve) => {
    release = resolve;
  });
  const disposed: string[] = [];
  const resource = (name: string) =>
    requestResource(
      "db",
      () => name,
      async (value) => {
        disposed.push(value);
      },
    );
  let execution!: Promise<void>;
  await withRequestResources(async () => {
    assert.equal(resource("admission"), "admission");
    execution = withRequestResources(
      async () => {
        assert.equal(resource("stream"), "stream");
        await wait;
        assert.equal(resource("unexpected replacement"), "stream");
        assert.deepEqual(disposed, ["admission"]);
      },
      undefined,
      true,
    );
  });
  assert.deepEqual(disposed, ["admission"]);
  release();
  await execution;
  assert.deepEqual(disposed, ["admission", "stream"]);
});

test("Novita receives an explicit Thinking off and on; other providers receive no Novita extension", () => {
  assert.deepEqual(
    providerThinkingControls({
      baseURL: "https://api.novita.ai/openai",
      thinkingEnabled: false,
    }),
    { enable_thinking: false },
  );
  assert.deepEqual(
    providerThinkingControls({
      baseURL: "https://api.novita.ai/openai",
      thinkingEnabled: true,
    }),
    { enable_thinking: true },
  );
  assert.deepEqual(
    providerThinkingControls({
      baseURL: "https://api.novita.ai.attacker.test",
      thinkingEnabled: false,
    }),
    {},
  );
  assert.deepEqual(providerThinkingControls({ reasoningEffort: "high" }), {
    reasoning_effort: "high",
  });
});

for (const thinkingEnabled of [false, true]) {
  test(`agent forwards Thinking ${thinkingEnabled ? "on" : "off"} to the provider in one model round`, async () => {
    let requests = 0;
    const sse = new ClauxenSseStream();
    await runAutonomousAgent(sse, {
      messages: [{ role: "user", content: "Hello" }],
      model: "fake",
      chatModelId: "virgil",
      thinkingEnabled,
      skipWriteStart: true,
      deps: {
        uuid: () => "fixture",
        callModel: async function* (options) {
          requests++;
          assert.equal(options.thinkingEnabled, thinkingEnabled);
          yield { type: "text-delta", delta: "Hello" };
          yield {
            type: "finish",
            reason: "stop",
            output: [],
            replay: [{ role: "assistant", content: "Hello" }],
          };
        },
      },
    });
    assert.equal(requests, 1);
  });
}

test("silent provider calls time out, but active output renews the deadline", async () => {
  const { createProviderActivityGuard } =
    await import("../src/server/inference/provider-activity");
  const silent = createProviderActivityGuard(undefined, 10);
  await new Promise((resolve) => setTimeout(resolve, 25));
  assert.equal(silent.timedOut, true);
  silent.dispose();
  const active = createProviderActivityGuard(undefined, 100);
  for (let i = 0; i < 3; i++) {
    await new Promise((resolve) => setTimeout(resolve, 40));
    active.touch();
    assert.equal(active.signal.aborted, false);
  }
  active.dispose();
  const stop = new AbortController();
  const cancelled = createProviderActivityGuard(stop.signal);
  stop.abort();
  assert.equal(cancelled.signal.aborted, true);
  assert.equal(cancelled.timedOut, false);
  cancelled.dispose();
});

test("missing deployed credentials fail before durable admission", async () => {
  const { assertCloudflareChatConfiguration } =
    await import("../src/server/cloudflare/chat-configuration");
  const configured = {
    Provider_API_Key: "test-key",
    GENERATIONS_INTERNAL_TOKEN: "test-generation-token",
    GENERATION_QUEUE: {},
    GENERATIONS_EXECUTION_ORIGIN: "https://worker.test",
  };
  assert.doesNotThrow(() => assertCloudflareChatConfiguration(configured));
  assert.throws(
    () =>
      assertCloudflareChatConfiguration({
        ...configured,
        GENERATIONS_INTERNAL_TOKEN: undefined,
      }),
    { code: "chat_runtime_unconfigured" },
  );
  assert.doesNotThrow(() =>
    assertCloudflareChatConfiguration({ Provider_API_Key: "test-key" }, false),
  );
});
