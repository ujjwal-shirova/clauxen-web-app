import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  commonPrefixLength,
  computeStreamTokenDurationMs,
} from "@/lib/streaming-token-reveal";
import { buildTemporalContextAppend } from "@/server/inference/system-prompt";

describe("commonPrefixLength", () => {
  it("keeps the shared stem across citation rewrites", () => {
    const before = "Grok launched quickly ([venturebeat.com][2]).";
    const after =
      "Grok launched quickly ([venturebeat.com](https://venturebeat.com/x)).";
    const shared = commonPrefixLength(before, after);
    assert.ok(shared >= "Grok launched quickly (".length);
    assert.equal(before.slice(0, shared), after.slice(0, shared));
  });

  it("returns full length for pure appends", () => {
    assert.equal(commonPrefixLength("Hello", "Hello world"), 5);
  });
});

describe("computeStreamTokenDurationMs", () => {
  it("snaps first chunks in quickly", () => {
    assert.ok(computeStreamTokenDurationMs(0, 8) <= 120);
    assert.ok(computeStreamTokenDurationMs(500, 4) <= 90);
  });
});

describe("buildTemporalContextAppend", () => {
  it("includes weekday, calendar date, timezone, and UTC ISO", () => {
    const now = new Date("2026-07-30T08:00:00.000Z");
    const block = buildTemporalContextAppend({
      timezone: "Asia/Kolkata",
      now,
    });
    assert.match(block, /<current_datetime>/);
    assert.match(block, /Asia\/Kolkata/);
    assert.match(block, /2026-07-30/);
    assert.match(block, /Thursday/);
    assert.match(block, /July/);
    assert.match(block, /2026-07-30T08:00:00\.000Z/);
    assert.match(block, /ground truth/i);
  });

  it("falls back to UTC for invalid timezones", () => {
    const block = buildTemporalContextAppend({
      timezone: "Not/AZone",
      now: new Date("2026-01-01T00:00:00.000Z"),
    });
    assert.match(block, /Timezone: UTC/);
  });
});
