import test from "node:test";
import assert from "node:assert/strict";
import { computeNextRunAt, isCalendarDate, zonedLocalToUtc } from "../src/server/services/scheduled-tasks-schedule";
const after = new Date("2026-10-10T04:00:00Z");
const base = {timeLocal:"09:35",timezone:"Asia/Kolkata"};
test("once uses timezone and rejects passed slots", () => {
  assert.equal(computeNextRunAt({...base,frequency:"once",runDate:"2026-10-10"},after)?.toISOString(),"2026-10-10T04:05:00.000Z");
  assert.equal(computeNextRunAt({...base,frequency:"once",runDate:"2026-10-09"},after),null);
});
test("daily rolls forward, expiration is inclusive in local timezone", () => {
  assert.equal(computeNextRunAt({...base,timeLocal:"09:00",frequency:"daily"},after)?.toISOString(),"2026-10-11T03:30:00.000Z");
  assert.equal(computeNextRunAt({...base,frequency:"daily",expiresAt:"2026-10-10"},after)?.toISOString(),"2026-10-10T04:05:00.000Z");
  assert.equal(computeNextRunAt({...base,timeLocal:"09:00",frequency:"daily",expiresAt:"2026-10-10"},after),null);
});
test("weekly advances to specified weekday", () => {
  assert.equal(computeNextRunAt({...base,frequency:"weekly",dayOfWeek:1},after)?.toISOString(),"2026-10-12T04:05:00.000Z");
});
test("monthly clamps end of month and handles leap years", () => {
  assert.equal(computeNextRunAt({...base,frequency:"monthly",dayOfMonth:31},new Date("2028-02-01T00:00:00Z"))?.toISOString(),"2028-02-29T04:05:00.000Z");
});
test("invalid calendar dates and fractional weekdays are rejected", () => {
  assert.equal(isCalendarDate("2026-02-30"),false);
  assert.equal(isCalendarDate("2028-02-29"),true);
  assert.throws(() => computeNextRunAt({...base,frequency:"once",runDate:"2026-02-30"},after));
  assert.throws(() => computeNextRunAt({...base,frequency:"weekly",dayOfWeek:2.5},after));
});
test("DST gaps advance and repeated times choose the first occurrence", () => {
  assert.equal(zonedLocalToUtc(2026,3,8,2,30,"America/New_York").toISOString(),"2026-03-08T07:30:00.000Z");
  assert.equal(zonedLocalToUtc(2026,11,1,1,30,"America/New_York").toISOString(),"2026-11-01T05:30:00.000Z");
});
test("a daily task stays at the same local time across DST", () => {
  const spec = {frequency:"daily" as const,timeLocal:"09:00",timezone:"America/New_York"};
  assert.equal(computeNextRunAt(spec,new Date("2026-03-07T15:00:00Z"))?.toISOString(),"2026-03-08T13:00:00.000Z");
});
