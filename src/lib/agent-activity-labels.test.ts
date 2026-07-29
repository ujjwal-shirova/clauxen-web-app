import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  deriveActivityLabel,
  stripNarrationFiller,
  toGerund,
  toPastTense,
} from "@/lib/agent-activity-labels";

describe("deriveActivityLabel", () => {
  it("gerunds the lead verb while a step runs", () => {
    assert.equal(
      deriveActivityLabel("I'll check the latest pricing.", "active"),
      "Checking the latest pricing…",
    );
  });

  it("past-tenses the header once the step completes", () => {
    assert.equal(
      deriveActivityLabel("I'll check the latest pricing.", "done"),
      "Checked the latest pricing",
    );
  });

  it("strips filler openers", () => {
    assert.equal(
      deriveActivityLabel(`Now let me search for "Moonshot AI" docs.`, "done"),
      `Searched for "Moonshot AI" docs`,
    );
  });

  it("handles irregular verbs", () => {
    assert.equal(
      deriveActivityLabel("I will run the test suite now.", "done"),
      "Ran the test suite now",
    );
  });

  it("rejects declarative prose that is not a step", () => {
    assert.equal(
      deriveActivityLabel("Results look promising across the board.", "active"),
      undefined,
    );
  });

  it("keeps long phrases within the word budget", () => {
    const label = deriveActivityLabel(
      "I'll compare the quarterly revenue figures across every single region and business unit carefully.",
      "active",
    );
    assert.ok(label);
    assert.ok(label!.endsWith("…"));
    assert.ok(label!.split(/\s+/).length <= 9);
  });
});

describe("verb inflection helpers", () => {
  it("strips lead filler", () => {
    assert.equal(
      stripNarrationFiller("Okay, let me check that."),
      "check that",
    );
  });

  it("builds gerunds", () => {
    assert.equal(toGerund("check"), "checking");
    assert.equal(toGerund("run"), "running");
    assert.equal(toGerund("write"), "writing");
  });

  it("builds past tense", () => {
    assert.equal(toPastTense("check"), "checked");
    assert.equal(toPastTense("run"), "ran");
    assert.equal(toPastTense("verify"), "verified");
  });
});
