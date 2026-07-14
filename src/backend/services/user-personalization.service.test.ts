import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatPersonalizationAppend } from "./user-personalization.service";

describe("formatPersonalizationAppend", () => {
  it("includes preferred name, work, and custom instructions under Shirova scope", () => {
    const out = formatPersonalizationAppend({
      fullName: "Ujjwal Tyagi",
      nickname: "Ujjwal",
      occupation: "Founder",
      customInstructions: "Prefer analogies when explaining concepts.",
      personality: null,
      baseStyleTone: null,
    });

    assert.match(out, /<user_profile>/);
    assert.match(out, /Preferred name: Ujjwal/);
    assert.match(out, /Work \/ role: Founder/);
    assert.match(out, /<custom_instructions>/);
    assert.match(out, /Shirova safety/);
    assert.match(out, /Prefer analogies when explaining concepts/);
  });

  it("returns empty string when nothing is set", () => {
    assert.equal(
      formatPersonalizationAppend({
        fullName: null,
        nickname: null,
        occupation: null,
        customInstructions: null,
        personality: null,
        baseStyleTone: null,
      }),
      "",
    );
  });
});
