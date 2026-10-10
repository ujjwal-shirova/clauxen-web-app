import assert from "node:assert/strict";
import test from "node:test";
import { consumeClauxenStreamResponse } from "../src/shared/lib/ui-message-stream";
import {
  runAutonomousAgent,
  type AgentStreamOptions,
  type AgentPendingToolRound,
} from "../src/server/agent-core/runtime/query-loop";
import { ClauxenSseStream } from "../src/server/inference/clauxen-sse-stream";

const response = (events: unknown[]) =>
  new Response(
    events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(""),
    {
      headers: { "content-type": "text/event-stream" },
    },
  );

test("a disconnected subscription cannot finish a durable task", async () => {
  const events: unknown[] = [];
  const outcome = await consumeClauxenStreamResponse(
    response([{ type: "start" }, { type: "answer_delta", delta: "partial" }]),
    (e) => events.push(e),
  );
  assert.equal(outcome, "interrupted");
  assert.equal(
    events.some((e: any) => e.type === "done"),
    false,
  );
});

test("accepted background tasks hand off without a synthetic done", async () => {
  const events: any[] = [];
  assert.equal(
    await consumeClauxenStreamResponse(
      response([{ type: "backgrounded", jobId: "job", chatId: "chat" }]),
      (e) => events.push(e),
    ),
    "backgrounded",
  );
  assert.deepEqual(
    events.map((e) => e.type),
    ["backgrounded"],
  );
});

test("an acknowledged completed stream remains completed", async () => {
  assert.equal(
    await consumeClauxenStreamResponse(response([{ type: "done" }]), () => {}),
    "completed",
  );
});

function options(
  overrides: Partial<AgentStreamOptions> = {},
): AgentStreamOptions {
  return {
    messages: [{ role: "user", content: "Do work" }],
    model: "fake",
    skipWriteStart: true,
    deps: {
      uuid: () => "id",
      callModel: async function* () {
        throw new Error("Unexpected model call");
      },
    },
    ...overrides,
  };
}
const planned: AgentPendingToolRound = {
  step: 0,
  startedAtMs: 1,
  calls: [
    {
      id: "tool-1",
      name: "create_file",
      arguments: '{"path":"a.txt","content":"saved"}',
    },
  ],
  results: { "tool-1": { output: { saved: true }, pause: false } },
};

test("recovery replays a saved tool result without repeating the side effect or model round", async () => {
  let modelCalls = 0;
  let toolCalls = 0;
  let savedConversation: unknown[] = [];
  const sse = new ClauxenSseStream();
  const outcome = await runAutonomousAgent(
    sse,
    options({
      initialConversation: [
        {
          role: "assistant",
          content: null,
          tool_calls: [
            {
              id: "tool-1",
              type: "function",
              function: { name: "create_file", arguments: "{}" },
            },
          ],
        },
      ],
      initialPendingToolRound: planned,
      beforeTool: async () => {
        toolCalls++;
      },
      onRoundEnd: async (round) => {
        savedConversation = round.conversation;
      },
      deps: {
        uuid: () => "id",
        callModel: async function* () {
          modelCalls++;
          yield { type: "text-delta", delta: "Finished" };
          yield { type: "finish", reason: "stop", output: [], replay: [] };
        },
      },
    }),
  );
  assert.equal(outcome, "done");
  assert.equal(modelCalls, 1);
  assert.equal(toolCalls, 0);
  assert(
    savedConversation.some(
      (item: any) =>
        item.tool_call_id === "tool-1" && item.content.includes("saved"),
    ),
  );
  assert((await new Response(sse.stream).text()).includes('"type":"tool_end"'));
});

test("unknown external action outcome stops recovery instead of executing it twice", async () => {
  let toolCalls = 0;
  const sse = new ClauxenSseStream();
  assert.equal(
    await runAutonomousAgent(
      sse,
      options({
        initialPendingToolRound: {
          ...planned,
          executingCallId: "tool-1",
          results: {},
        },
        beforeTool: async () => {
          toolCalls++;
        },
      }),
    ),
    "error",
  );
  assert.equal(toolCalls, 0);
});

test("a persisted final round is finalized without another model request", async () => {
  assert.equal(
    await runAutonomousAgent(
      new ClauxenSseStream(),
      options({ initialTerminalOutcome: "done" }),
    ),
    "done",
  );
});

test("checkpoint failure prevents tool execution", async () => {
  let toolCalls = 0;
  assert.equal(
    await runAutonomousAgent(
      new ClauxenSseStream(),
      options({
        initialPendingToolRound: { ...planned, results: {} },
        onToolRoundState: async () => {
          throw new Error("database unavailable");
        },
        beforeTool: async () => {
          toolCalls++;
        },
      }),
    ),
    "error",
  );
  assert.equal(toolCalls, 0);
});

import { pokeWatchdog } from "../workers/generations-watchdog/src/index";

test("watchdog retries transient dispatch failures", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () =>
    new Response("{}", { status: ++calls === 1 ? 503 : 200 });
  try {
    assert.deepEqual(
      await pokeWatchdog({
        GENERATIONS_INTERNAL_TOKEN: "test",
        APP_ORIGIN: "https://example.test",
      }),
      { ok: true, status: 200 },
    );
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("watchdog does not retry invalid credentials", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return new Response("{}", { status: 401 });
  };
  try {
    assert.deepEqual(
      await pokeWatchdog({ GENERATIONS_INTERNAL_TOKEN: "test" }),
      { ok: false, status: 401 },
    );
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("continuation relay rejects unauthorized calls before any upstream request", async () => {
  const { default: worker } =
    await import("../workers/generations-watchdog/src/index");
  const result = await worker.fetch(
    new Request("https://relay.test/v1/continue", {
      method: "POST",
      body: "{}",
    }),
    {
      GENERATIONS_INTERNAL_TOKEN: "fixture-secret",
      APP_ORIGIN: "https://trusted.test",
    },
  );
  assert.equal(result.status, 401);
});

test("continuation relay validates jobs and ignores caller-provided destinations", async () => {
  const { default: worker } =
    await import("../workers/generations-watchdog/src/index");
  const originalFetch = globalThis.fetch;
  let upstreamCalls = 0;
  globalThis.fetch = (async (input, init) => {
    upstreamCalls++;
    assert.equal(
      String(input),
      "https://trusted.test/api/v1/internal/generations/continue",
    );
    assert.equal(
      new Headers(init?.headers).get("x-clauxen-internal"),
      "fixture-secret",
    );
    assert.deepEqual(JSON.parse(String(init?.body)), {
      jobId: "12345678-1234-1234-1234-123456789abc",
    });
    return Response.json({ ok: true }, { status: 202 });
  }) as typeof fetch;
  const invoke = (body: unknown) =>
    worker.fetch(
      new Request("https://relay.test/v1/continue", {
        method: "POST",
        headers: {
          "x-clauxen-internal": "fixture-secret",
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      }),
      {
        GENERATIONS_INTERNAL_TOKEN: "fixture-secret",
        APP_ORIGIN: "https://trusted.test",
      },
    );
  try {
    assert.equal((await invoke({ jobId: "invalid" })).status, 400);
    assert.equal(upstreamCalls, 0);
    assert.equal(
      (
        await invoke({
          jobId: "12345678-1234-1234-1234-123456789abc",
          origin: "http://169.254.169.254",
        })
      ).status,
      202,
    );
    assert.equal(upstreamCalls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
