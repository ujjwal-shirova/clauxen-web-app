import assert from "node:assert/strict";
import { test } from "node:test";
import {
  researchCountdown,
  researchSearchLimit,
  researchSourceUrls,
} from "../src/shared/lib/research-state";
import { runAutonomousAgent } from "../src/server/agent-core/runtime/query-loop";
import { ClauxenSseStream } from "../src/server/inference/clauxen-sse-stream";

test("countdown uses the persisted deadline, including reloads and overdue plans", () => {
  const now = Date.parse("2026-10-10T12:00:00Z");
  assert.equal(researchCountdown("2026-10-10T12:01:00Z", now), 60);
  assert.equal(researchCountdown("2026-10-10T12:01:00Z", now + 43500), 17);
  assert.equal(researchCountdown("2026-10-10T12:01:00Z", now + 61000), 0);
  assert.equal(researchCountdown(null, now), 0);
});
test("research allows variable search sizes up to 30; ordinary chat remains at 10", () => {
  assert.equal(researchSearchLimit(undefined, true), 30);
  assert.equal(researchSearchLimit(7, true), 7);
  assert.equal(researchSearchLimit(100, true), 30);
  assert.equal(researchSearchLimit(-4, true), 1);
  assert.equal(researchSearchLimit(30, false), 10);
});
test("a durable research run enables provider thinking despite a non-thinking chat preference", async () => {
  const sse = new ClauxenSseStream();
  let thinking: boolean | undefined;
  await runAutonomousAgent(sse, {
    messages: [{ role: "user", content: "Research the approved plan" }],
    model: "fixture",
    chatModelId: "virgil",
    thinkingEnabled: false,
    researchPlanId: "fixture-research",
    deps: {
      callModel: async function* (request) {
        thinking = request.thinkingEnabled;
        yield { type: "text-delta", delta: "Research report" };
        yield {
          type: "finish",
          reason: "stop",
          output: [],
          replay: [{ role: "assistant", content: "Research report" }],
        };
      },
    },
  });
  await new Response(sse.stream).text();
  assert.equal(thinking, true);
});

test("the source counter deduplicates page fragments and excludes invalid URLs", () => {
  assert.deepEqual(
    researchSourceUrls([
      "https://example.test/doc#first",
      "https://example.test/doc#second",
      "",
      "bad url",
      "file:///private",
    ]),
    ["https://example.test/doc"],
  );
});

test("oversized saved research checkpoints retain every source and bounded evidence", async () => {
  const { budgetResearchEvidence } =
    await import("../src/server/inference/research-evidence");
  const conversation: any[] = [
    { role: "user", content: "Approved research scope" },
  ];
  for (let search = 0; search < 4; search++) {
    const id = `search-${search}`;
    conversation.push({
      role: "assistant",
      content: null,
      tool_calls: [
        {
          id,
          type: "function",
          function: { name: "web_search", arguments: "{}" },
        },
      ],
    });
    conversation.push({
      role: "tool",
      tool_call_id: id,
      content: JSON.stringify({
        query: `angle ${search}`,
        results: Array.from({ length: 30 }, (_, i) => ({
          title: `Source ${i}`,
          url: `https://example.test/${search}/${i}`,
          snippet: "Evidence ".repeat(4000),
          highlights: ["Evidence ".repeat(4000)],
        })),
      }),
    });
  }
  budgetResearchEvidence(conversation);
  const outputs = conversation.filter((item) => item.role === "tool");
  assert(JSON.stringify(conversation).length < 180000);
  assert.equal(
    outputs.flatMap((item) => JSON.parse(item.content).results).length,
    120,
  );
  for (let search = 0; search < 4; search++)
    assert.deepEqual(
      JSON.parse(outputs[search].content).results.map((hit: any) => hit.url),
      Array.from(
        { length: 30 },
        (_, i) => `https://example.test/${search}/${i}`,
      ),
    );
  assert.equal(conversation[0].content, "Approved research scope");
});

test("temporary research provider failures retry the same round without replaying tools", async () => {
  const sse = new ClauxenSseStream();
  let calls = 0;
  const result = await runAutonomousAgent(sse, {
    researchPlanId: "fixture",
    model: "fixture",
    chatModelId: "virgil",
    messages: [{ role: "user", content: "Research" }],
    deps: {
      callModel: async function* (request) {
        calls++;
        assert.equal(request.idleTimeoutMs, 120000);
        if (calls < 3) {
          yield {
            type: "error",
            error: "503 provider temporarily unavailable",
          };
          return;
        }
        yield { type: "text-delta", delta: "Complete report" };
        yield { type: "finish", reason: "stop", output: [], replay: [] };
      },
    },
  });
  assert.equal(result, "done");
  assert.equal(calls, 3);
  const wire = await new Response(sse.stream).text();
  assert(!wire.includes('"type":"error"'));
  assert(wire.includes("Complete report"));
});

test("research retries stop at a bounded limit and do not retry invalid credentials", async () => {
  for (const [error, expectedCalls] of [
    ["503 unavailable", 3],
    ["401 invalid API key", 1],
  ] as const) {
    const sse = new ClauxenSseStream();
    let calls = 0;
    assert.equal(
      await runAutonomousAgent(sse, {
        researchPlanId: "fixture",
        model: "fixture",
        messages: [{ role: "user", content: "Research" }],
        deps: {
          callModel: async function* () {
            calls++;
            yield { type: "error", error };
          },
        },
      }),
      "error",
    );
    assert.equal(calls, expectedCalls);
    await new Response(sse.stream).text();
  }
});

test("research messages stay in the activity panel while ordinary prompts remain visible", async () => {
  const { groupMessagesIntoTurns } =
    await import("../src/shared/lib/chat-turns");
  const groups = groupMessagesIntoTurns([
    { id: "u1", role: "user", content: "[Deep research]\nCompare energy" },
    { id: "plan", role: "assistant", content: "Plan" },
    {
      id: "old-u",
      role: "user",
      content: "[Deep research start: plan]\nApproved research plan",
    },
    { id: "old-a", role: "assistant", content: "Old internal narration" },
    { id: "u2", role: "user", content: "Follow-up" },
    {
      id: "internal",
      clientId: "research-assistant-fixture",
      role: "assistant",
      content: "Research activity",
    },
    { id: "a2", role: "assistant", content: "Answer" },
  ]);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].userMessage?.id, "u1");
  assert.deepEqual(
    groups.flatMap((group) =>
      group.assistantMessages.map((message) => message.id),
    ),
    ["plan", "a2"],
  );
});

test("interrupted research reads recover their saved result, while writes remain protected", async () => {
  const sse = new ClauxenSseStream();
  const call = {
    id: "read-1",
    name: "web_scrape",
    arguments: JSON.stringify({
      url: "https://example.test",
      formats: { markdown: true },
    }),
  };
  const result = await runAutonomousAgent(sse, {
    researchPlanId: "fixture",
    model: "fixture",
    messages: [{ role: "user", content: "Research" }],
    initialConversation: [
      {
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: call.id,
            type: "function",
            function: { name: call.name, arguments: call.arguments },
          },
        ],
      },
    ],
    initialPendingToolRound: {
      step: 0,
      calls: [call],
      executingCallId: call.id,
      startedAtMs: Date.now(),
      results: {
        [call.id]: {
          output: {
            url: "https://example.test",
            markdown: {
              requested: true,
              success: true,
              data: "Saved primary evidence",
            },
            metadata: {
              finalUrl: "https://example.test",
              title: "Example",
            },
          },
          pause: false,
        },
      },
    },
    beforeTool: async () => {
      assert.fail("A saved result must not execute again");
    },
    deps: {
      callModel: async function* (request) {
        assert(
          request.input.some(
            (item) =>
              item.role === "tool" &&
              String(item.content).includes("Saved primary evidence"),
          ),
        );
        yield { type: "text-delta", delta: "Complete report" };
        yield { type: "finish", reason: "stop", output: [], replay: [] };
      },
    },
  });
  assert.equal(result, "done");
  await new Response(sse.stream).text();
});

test("research failures offer checkpoint recovery without exposing provider diagnostics", async () => {
  const { researchFailureMessage } =
    await import("../src/shared/lib/research-state");
  assert.match(
    researchFailureMessage("400 maximum context length exceeded"),
    /shorter excerpts/,
  );
  assert.match(
    researchFailureMessage(
      "The model provider stopped responding. Please try again.",
    ),
    /saved progress/,
  );
  assert.equal(
    researchFailureMessage("401 invalid API key: private-value"),
    "Something unexpected happened. Please try again.",
  );
});
