import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeNextRunAt,
  parseTimeLocal,
  zonedLocalToUtc,
} from "./scheduled-tasks-schedule";

describe("scheduled-tasks-schedule", () => {
  it("parses HH:MM", () => {
    assert.deepEqual(parseTimeLocal("06:50"), { hour: 6, minute: 50 });
    assert.throws(() => parseTimeLocal("25:00"));
  });

  it("converts Asia/Kolkata local time to UTC", () => {
    // 2026-08-01 06:50 IST = 01:20 UTC
    const utc = zonedLocalToUtc(2026, 8, 1, 6, 50, "Asia/Kolkata");
    assert.equal(utc.toISOString(), "2026-08-01T01:20:00.000Z");
  });

  it("computes next daily run after a given instant", () => {
    const after = new Date("2026-07-25T10:00:00.000Z");
    const next = computeNextRunAt(
      {
        frequency: "daily",
        timeLocal: "06:50",
        timezone: "UTC",
        expiresAt: "2026-12-31",
      },
      after,
    );
    assert.ok(next);
    assert.equal(next!.toISOString(), "2026-07-26T06:50:00.000Z");
  });

  it("returns null when once is already past", () => {
    const next = computeNextRunAt(
      {
        frequency: "once",
        timeLocal: "09:00",
        timezone: "UTC",
        runDate: "2020-01-01",
      },
      new Date("2026-07-25T00:00:00.000Z"),
    );
    assert.equal(next, null);
  });

  it("respects expiration", () => {
    const next = computeNextRunAt(
      {
        frequency: "daily",
        timeLocal: "09:00",
        timezone: "UTC",
        expiresAt: "2026-07-20",
      },
      new Date("2026-07-25T00:00:00.000Z"),
    );
    assert.equal(next, null);
  });
});
