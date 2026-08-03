import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseAgentTextMarkup,
  parseThinkingMarkup,
  stripAgentTranscriptMarkup,
} from "@/lib/agent-transcript-markup";

describe("agent transcript markup", () => {
  it("holds partial heading tags instead of leaking them into thinking", () => {
    assert.deepEqual(parseThinkingMarkup("<agent_head"), {
      body: "",
      hasHeadingTag: false,
    });

    assert.deepEqual(
      parseThinkingMarkup(
        "<agent_heading>Comparing primary sources</agent_heading>Read both specs.",
      ),
      {
        heading: "Comparing primary sources",
        body: "Read both specs.",
        hasHeadingTag: true,
      },
    );
  });

  it("keeps narration separate from candidate final-answer text", () => {
    const parsed = parseAgentTextMarkup(
      "<agent_heading>Checking releases</agent_heading>" +
        "<agent_narration>I'll verify the release notes.</agent_narration>" +
        "This remains normal answer text.",
    );

    assert.equal(parsed.heading, "Checking releases");
    assert.equal(parsed.narration, "I'll verify the release notes.");
    assert.equal(parsed.visibleText, "This remains normal answer text.");
    assert.equal(parsed.hasNarrationTag, true);
  });

  it("streams an open narration body but holds a partial closing tag", () => {
    const parsed = parseAgentTextMarkup(
      "<agent_narration>Reading the API docs.</agent_narr",
    );

    assert.equal(parsed.narration, "Reading the API docs.");
    assert.equal(parsed.visibleText, "");
  });

  it("strips transcript metadata for defensive plain-text fallbacks", () => {
    assert.equal(
      stripAgentTranscriptMarkup(
        "<agent_heading>Researching</agent_heading>" +
          "<agent_narration>Checking sources.</agent_narration>",
      ),
      "Checking sources.",
    );
  });
});
