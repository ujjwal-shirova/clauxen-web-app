import { test } from "node:test";
import assert from "node:assert/strict";
import { runAutonomousAgent } from "../src/server/agent-core/runtime/query-loop";
import { ClauxenSseStream } from "../src/server/inference/clauxen-sse-stream";
import {
  parseDeepResearchPlan,
  approvedResearchTasks,
  displayResearchMessage,
  researchActionPrefix,
  researchPlanPresentation,
} from "../src/shared/lib/deep-research";
const plan = {
  title: "Compare energy sources",
  tasks: ["Verify primary sources", "Compare costs", "Write a cited report"],
  summary: "A source-backed comparison.",
};
const block = (value: unknown) =>
  "```research-plan\n" + JSON.stringify(value) + "\n```";
test("accepts a complete model-generated research plan", () => {
  assert.deepEqual(parseDeepResearchPlan(block(plan)), plan);
});
test("saved JSON plans render as cards while preserving surrounding assistant prose", () => {
  const content = `Here is the plan.\n\n\`\`\`json\n${JSON.stringify(plan)}\n\`\`\`\n\nThe report will compare costs.`;
  assert.deepEqual(researchPlanPresentation(content), {
    plan,
    before: "Here is the plan.",
    after: "The report will compare costs.",
  });
  assert.equal(
    researchPlanPresentation('```json\n{"example":true}\n```'),
    null,
  );
});
test("rejects partial, malformed, empty, and oversized model output", () => {
  for (const content of [
    '```research-plan\n{"title":',
    block({ ...plan, tasks: ["One"] }),
    block({ ...plan, tasks: ["One", false, "Three"] }),
    block({ ...plan, title: "" }),
    block({ ...plan, summary: "x".repeat(2001) }),
    "```research-plan\ninvalid\n```",
  ]) {
    assert.equal(parseDeepResearchPlan(content), null);
  }
});
test("workflow metadata stays out of displayed user messages", () => {
  assert.equal(
    displayResearchMessage("[Deep research]\nCompare energy"),
    "Compare energy",
  );
  assert.equal(
    displayResearchMessage(
      researchActionPrefix("start", "plan-1") + "Start research",
    ),
    "Start research",
  );
  assert.equal(
    displayResearchMessage(
      researchActionPrefix("cancel", "plan-1") + "Cancel research",
    ),
    "Cancel research",
  );
  assert.equal(
    displayResearchMessage("ordinary [Deep research] text"),
    "ordinary [Deep research] text",
  );
});
test("approved edits survive reloading the durable start message", () => {
  const content =
    researchActionPrefix("start", "plan-1") +
    "Start research\n\nApproved research plan:\n1. Edited first task\n2. Verify facts\n3. Cite sources\n\nSummary";
  assert.deepEqual(approvedResearchTasks(content), [
    "Edited first task",
    "Verify facts",
    "Cite sources",
  ]);
  assert.equal(approvedResearchTasks("Ordinary message"), null);
});

test("research presentation streams as a tool and allows assistant prose afterward", async () => {
  const sse = new ClauxenSseStream();
  let rounds = 0;
  const overview = "The report will compare costs and evidence.";
  await runAutonomousAgent(sse, {
    messages: [
      { role: "user", content: "[Deep research]\nCompare energy sources" },
    ],
    model: "fixture",
    chatModelId: "virgil",
    thinkingEnabled: false,
    deps: {
      uuid: () => `segment-${rounds}`,
      callModel: async function* () {
        rounds++;
        if (rounds === 1) {
          const args = JSON.stringify({ title: plan.title, tasks: plan.tasks });
          yield {
            type: "tool-call-start",
            toolCallId: "research-card",
            toolName: "present_research_plan",
          };
          yield {
            type: "tool-call-delta",
            toolCallId: "research-card",
            argumentsDelta: args,
          };
          yield {
            type: "tool-call-end",
            toolCallId: "research-card",
            toolName: "present_research_plan",
            arguments: args,
          };
          yield {
            type: "finish",
            reason: "tool_calls",
            output: [],
            replay: [
              {
                role: "assistant",
                content: null,
                tool_calls: [
                  {
                    id: "research-card",
                    type: "function",
                    function: {
                      name: "present_research_plan",
                      arguments: args,
                    },
                  },
                ],
              },
            ],
          };
        } else {
          yield { type: "text-delta", delta: overview };
          yield {
            type: "finish",
            reason: "stop",
            output: [],
            replay: [{ role: "assistant", content: overview }],
          };
        }
      },
    },
  });
  const wire = await new Response(sse.stream).text();
  const events = wire
    .split("\n\n")
    .filter((frame) => frame.startsWith("data: "))
    .map((frame) => JSON.parse(frame.slice(6)));
  assert.equal(rounds, 2);
  assert(
    events.some(
      (event) =>
        event.type === "tool_start" && event.name === "present_research_plan",
    ),
  );
  assert(
    events.some(
      (event) => event.type === "answer_finalize" && event.text === overview,
    ),
  );
  assert.equal(
    events
      .filter((event) => event.type === "narration_delta")
      .map((event) => event.delta)
      .join(""),
    overview,
  );
});
