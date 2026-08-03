/**
 * Unit tests for follow-up prompt preparation.
 * Ensures rehype-harden can never inject literal "[blocked]" into the UI.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CLAUXEN_PROMPT_HREF_PREFIX,
  parseClauxenPromptHref,
  prepareFollowUpContent,
} from "@/lib/follow-up-tags";

describe("prepareFollowUpContent", () => {
  it("extracts prompts and strips tags from markdown without leaving duplicate text", () => {
    const input = `Here is the answer.

<prompt>Compare Kimi K3 with Claude Opus 4.8</prompt>
<prompt>What are Moonshot AI's previous models?</prompt>
`;
    const prepared = prepareFollowUpContent(input, { enabled: true });
    assert.equal(prepared.prompts.length, 2);
    assert.equal(prepared.prompts[0], "Compare Kimi K3 with Claude Opus 4.8");
    assert.ok(!prepared.markdown.includes("<prompt"));
    assert.ok(!prepared.markdown.includes("[blocked]"));
    assert.ok(!prepared.markdown.includes("Compare Kimi K3 with Claude Opus 4.8"));
    assert.ok(!prepared.markdown.includes("Moonshot AI"));
    assert.ok(prepared.markdown.includes("Here is the answer."));
  });

  it("strips harden leftovers and legacy markdown links", () => {
    const input = `Answer text

[Compare models](${CLAUXEN_PROMPT_HREF_PREFIX}${encodeURIComponent("Compare models")}) [blocked]
[Old link](clauxen-prompt://${encodeURIComponent("Old link")})
`;
    const prepared = prepareFollowUpContent(input, { enabled: true });
    assert.ok(!prepared.markdown.includes("[blocked]"));
    assert.ok(!prepared.markdown.includes("clauxen-prompt://"));
    assert.ok(!prepared.markdown.includes("Compare models"));
    assert.ok(prepared.prompts.includes("Compare models"));
    assert.ok(prepared.prompts.includes("Old link"));
  });

  it("strips tags when follow-ups disabled", () => {
    const input = `Hi <prompt>Tell me more</prompt>`;
    const prepared = prepareFollowUpContent(input, { enabled: false });
    assert.deepEqual(prepared.prompts, []);
    assert.equal(prepared.markdown.includes("<prompt"), false);
    assert.ok(!prepared.markdown.includes("Tell me more"));
    assert.ok(prepared.markdown.includes("Hi"));
  });

  it("drops agent narration echoes and duplicate prompts", () => {
    const input = `Answer text

<prompt>Let me read the full file</prompt>
<prompt>I'll search for more sources</prompt>
<prompt>Compare the two approaches</prompt>
<prompt>Compare the two approaches</prompt>
<prompt>let us dig into the logs</prompt>
`;
    const prepared = prepareFollowUpContent(input, { enabled: true });
    assert.deepEqual(prepared.prompts, ["Compare the two approaches"]);
  });
});

describe("parseClauxenPromptHref", () => {
  it("parses hash and legacy protocols", () => {
    const prompt = "Explain open-weight vs closed-source";
    assert.equal(
      parseClauxenPromptHref(
        `${CLAUXEN_PROMPT_HREF_PREFIX}${encodeURIComponent(prompt)}`,
      ),
      prompt,
    );
    assert.equal(
      parseClauxenPromptHref(`clauxen-prompt://${encodeURIComponent(prompt)}`),
      prompt,
    );
    assert.equal(parseClauxenPromptHref("https://example.com"), null);
  });
});
