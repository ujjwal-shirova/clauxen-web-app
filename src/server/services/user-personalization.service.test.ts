import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatPersonalizationAppend } from "./user-personalization.service";

describe("formatPersonalizationAppend", () => {
  it("includes preferred name, modular style instructions, and custom instructions under Shirova scope", () => {
    const out = formatPersonalizationAppend({
      fullName: "Ujjwal Tyagi",
      nickname: "Ujjwal",
      occupation: "Founder",
      customInstructions: "Prefer analogies when explaining concepts.",
      personality: "Friendly",
      baseStyleTone: "Professional",
      characteristicWarm: "More",
      characteristicEnthusiastic: null,
      characteristicHeadersLists: "Less",
      characteristicEmoji: null,
      fastAnswers: true,
      referenceSavedMemories: true,
      referenceChatHistory: true,
      webSearch: true,
      extendedThinking: false,
    });

    assert.match(out, /<user_profile>/);
    assert.match(out, /Preferred name: Ujjwal/);
    assert.match(out, /Work \/ role: Founder/);
    assert.match(out, /<response_style>/);
    assert.match(out, /<base_style_and_tone>/);
    assert.match(out, /Professional/);
    assert.match(out, /<characteristic_warm>/);
    assert.match(out, /Friendlier and more personable|Increase interpersonal warmth/i);
    assert.match(out, /<characteristic_headers_lists>/);
    assert.doesNotMatch(out, /Personality: Friendly/);
    assert.match(out, /<memory_and_tools>/);
    assert.match(out, /<custom_instructions>/);
    assert.match(out, /Shirova safety/);
    assert.match(out, /Prefer analogies when explaining concepts/);
  });

  it("still emits Default modular style + memory block when profile fields are empty", () => {
    const out = formatPersonalizationAppend({
      fullName: null,
      nickname: null,
      occupation: null,
      customInstructions: null,
      personality: null,
      baseStyleTone: null,
      characteristicWarm: null,
      characteristicEnthusiastic: null,
      characteristicHeadersLists: null,
      characteristicEmoji: null,
      fastAnswers: false,
      referenceSavedMemories: false,
      referenceChatHistory: false,
      webSearch: false,
      extendedThinking: false,
    });
    assert.match(out, /<response_style>/);
    assert.match(out, /<base_style_and_tone>/);
    assert.match(out, /balanced preset style/i);
    assert.match(out, /<memory_and_tools>/);
    assert.match(out, /Web search is disabled/);
    assert.doesNotMatch(out, /<user_profile>/);
  });
});
