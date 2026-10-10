import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseDeepResearchPlan,
  approvedResearchTasks,
  displayResearchMessage,
  researchActionPrefix,
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
