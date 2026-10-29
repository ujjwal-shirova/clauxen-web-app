import assert from "node:assert/strict";
import { test } from "node:test";
import { autonomousAgentTools } from "../src/server/inference/autonomous-tools/definitions";
import {
  executeAutonomousTool,
  parseConnectorArgumentsJson,
} from "../src/server/inference/autonomous-tools/executor";
import { runAutonomousAgent } from "../src/server/agent-core/runtime/query-loop";
import { ClauxenSseStream } from "../src/server/inference/clauxen-sse-stream";
import { completedToolLabel } from "../src/shared/lib/agent-trace-labels";
import type { AgentToolStep } from "../src/shared/lib/agent-trace";

const CONNECTOR_TOOLS = [
  "connector_list",
  "connector_search_tools",
  "connector_call_tool",
];

test("connector tools expose only task arguments, never identity or credentials", () => {
  const expected = [
    [],
    ["query", "plugin_id"],
    ["plugin_id", "tool_name", "arguments_json"],
  ];
  for (const [index, name] of CONNECTOR_TOOLS.entries()) {
    const tool = autonomousAgentTools.find((item) => item.name === name);
    assert(tool);
    assert.equal(tool.type, "function");
    assert.equal(tool.parameters.additionalProperties, false);
    assert.deepEqual(
      Object.keys(tool.parameters.properties as object),
      expected[index],
    );
  }
  const call = autonomousAgentTools.find(
    (item) => item.name === "connector_call_tool",
  )!;
  assert.equal(call.strict, true);
  assert.deepEqual(call.parameters.required, expected[2]);
  assert.equal(
    (call.parameters.properties as Record<string, { type: string }>)
      .arguments_json.type,
    "string",
  );
  assert.match(call.description, /Never auto-approve/);
  assert.match(call.description, /Search|search/);
});

test("connector argument parser accepts JSON objects and rejects primitives, arrays and malformed JSON", () => {
  assert.deepEqual(parseConnectorArgumentsJson("{}"), {});
  assert.deepEqual(
    parseConnectorArgumentsJson('{"nested":{"values":[1,true,null]}}'),
    { nested: { values: [1, true, null] } },
  );
  for (const invalid of [
    null,
    undefined,
    {},
    [],
    4,
    "",
    "{bad}",
    "null",
    "[]",
    "42",
    '"text"',
    "true",
  ]) {
    assert.throws(() => parseConnectorArgumentsJson(invalid), /arguments_json/);
  }
});

test("connector JSON size limit is 32 KiB in UTF-8 bytes, not character count", () => {
  const boundary = JSON.stringify({ text: "a".repeat(32757) });
  assert.equal(Buffer.byteLength(boundary), 32768);
  assert.equal(parseConnectorArgumentsJson(boundary).text, "a".repeat(32757));
  assert.throws(() => parseConnectorArgumentsJson(`${boundary} `), /32 KiB/);
  const unicode = JSON.stringify({ text: "界".repeat(12000) });
  assert(unicode.length < 32768);
  assert.throws(() => parseConnectorArgumentsJson(unicode), /32 KiB/);
});

test("all connector operations require context authentication before any service access", async () => {
  for (const name of CONNECTOR_TOOLS) {
    const result = await executeAutonomousTool(
      name,
      { user_id: "not-authentication" },
      { conversationId: "fixture" },
    );
    assert.match(String((result.output as { error: string }).error), /Sign in/);
    assert.notEqual(result.pauseForUser, true);
  }
});

test("authenticated calls reject invalid wrapper arguments before loading the service", async () => {
  for (const [name, args, expected] of [
    ["connector_search_tools", { query: " " }, /query/],
    ["connector_search_tools", { query: "find", plugin_id: 3 }, /plugin_id/],
    [
      "connector_call_tool",
      { plugin_id: "gmail", tool_name: "", arguments_json: "{}" },
      /tool_name/,
    ],
    [
      "connector_call_tool",
      { plugin_id: "gmail", tool_name: "read", arguments_json: "[]" },
      /JSON object/,
    ],
    [
      "connector_call_tool",
      { plugin_id: "gmail", tool_name: "read", arguments_json: "bad" },
      /valid JSON/,
    ],
  ] as const) {
    const result = await executeAutonomousTool(name, args, {
      userId: "fixture",
      conversationId: "fixture",
    });
    assert.match(String((result.output as { error: string }).error), expected);
  }
});

test("model catalogs include exactly the connector tools for signed-in users and hide them from guests", async () => {
  for (const userId of [undefined, "fixture-user"]) {
    const sse = new ClauxenSseStream();
    let exposed: string[] = [];
    await runAutonomousAgent(sse, {
      userId,
      messages: [{ role: "user", content: "What apps can I use?" }],
      model: "fixture",
      deps: {
        callModel: async function* (request) {
          exposed = (request.tools ?? []).map((tool) => tool.function.name);
          yield { type: "text-delta", delta: "Fixture response" };
          yield { type: "finish", reason: "stop", output: [], replay: [] };
        },
      },
    });
    await new Response(sse.stream).text();
    assert.deepEqual(
      exposed.filter((name) => CONNECTOR_TOOLS.includes(name)).sort(),
      userId ? [...CONNECTOR_TOOLS].sort() : [],
    );
    assert(
      exposed.includes("web_search"),
      "existing unauthenticated tools remain available",
    );
  }
});

test("a persisted connector approval reuses the runtime pause without replaying the action", async () => {
  const sse = new ClauxenSseStream();
  let executed = false;
  let paused = false;
  const result = await runAutonomousAgent(sse, {
    userId: "fixture-user",
    messages: [{ role: "user", content: "Send the message" }],
    model: "fixture",
    initialPendingToolRound: {
      step: 0,
      startedAtMs: 1,
      calls: [
        {
          id: "approval-call",
          name: "connector_call_tool",
          arguments:
            '{"plugin_id":"gmail","tool_name":"send","arguments_json":"{}"}',
        },
      ],
      results: {
        "approval-call": {
          output: { type: "connector_approval", approval: { id: "approval" } },
          pause: true,
        },
      },
    },
    beforeTool: async () => {
      executed = true;
    },
    onPauseForUser: () => {
      paused = true;
    },
    deps: {
      callModel: async function* () {
        throw new Error("Approval must pause before another model round");
      },
    },
  });
  await new Response(sse.stream).text();
  assert.equal(result, "paused");
  assert.equal(executed, false);
  assert.equal(paused, true);
});

test("connector approval trace labels never claim the action completed", () => {
  const step = {
    name: "connector_call_tool",
    status: "done",
    result: JSON.stringify({ type: "connector_approval" }),
  } as AgentToolStep;
  assert.equal(completedToolLabel(step), "Action approval requested");
});
