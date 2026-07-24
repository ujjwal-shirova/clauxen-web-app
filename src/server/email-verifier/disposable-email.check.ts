/**
 * Runnable check: disposable list loads and blocks known temp domains.
 * Run: npx tsx src/server/email-verifier/disposable-email.check.ts
 */
import {
  assertEmailNotDisposable,
  isDisposableEmail,
  DISPOSABLE_EMAIL_CODE,
} from "./disposable-email";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

assert(
  isDisposableEmail("someone@0-00.usa.cc"),
  "expected first-list domain to be blocked",
);
assert(
  !isDisposableEmail("someone@gmail.com"),
  "gmail must remain allowed",
);
assert(
  !isDisposableEmail("someone@clauxen.com"),
  "clauxen.com must remain allowed",
);

try {
  assertEmailNotDisposable("temp@0-00.usa.cc");
  throw new Error("assertEmailNotDisposable should have thrown");
} catch (err) {
  assert(
    err instanceof Error &&
      "code" in err &&
      (err as { code: string }).code === DISPOSABLE_EMAIL_CODE,
    "expected disposable_email AppError",
  );
}

console.log("disposable-email check ok");
