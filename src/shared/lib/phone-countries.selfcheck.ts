/**
 * ponytail: one runnable check for phone identifier helpers.
 * Run: npx tsx src/lib/phone-countries.selfcheck.ts
 */
import {
  looksLikeEmail,
  looksLikePhone,
  toE164,
  PHONE_COUNTRIES,
  flagEmoji,
} from "./phone-countries";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

assert(looksLikePhone("9876543210"), "digits should look like phone");
assert(looksLikePhone("+91 98765 43210"), "intl phone should match");
assert(!looksLikePhone("user@clauxen.com"), "email must not look like phone");
assert(looksLikeEmail("user@clauxen.com"), "email should match");
assert(toE164("91", "09876543210") === "+919876543210", "strip leading 0");
assert(toE164("1", "4155552671") === "+14155552671", "US e164");
assert(PHONE_COUNTRIES.length >= 200, "expect full country list");
assert(flagEmoji("IN").length > 0, "flag emoji");
assert(
  new Set(PHONE_COUNTRIES.map((c) => c.iso)).size > 180,
  "unique ISO coverage",
);

console.log("phone-countries.selfcheck: ok");
