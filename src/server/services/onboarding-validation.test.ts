import assert from "node:assert/strict";
import { test } from "node:test";
import {
  sanitizeAnswers,
  validateOnboardingCompletion,
} from "./onboarding-validation";

const required = {
  termsAccepted: true,
  privacyAccepted: true,
  displayName: "Alex",
  modelImprovementOptIn: false,
};

test("completion accepts either explicit training choice, including refusal", () => {
  assert.doesNotThrow(() => validateOnboardingCompletion(required));
  assert.doesNotThrow(() =>
    validateOnboardingCompletion({ ...required, modelImprovementOptIn: true }),
  );
});

test("completion rejects bypasses with missing, null, or string consent", () => {
  for (const modelImprovementOptIn of [undefined, null, "false", 0]) {
    assert.throws(
      () =>
        validateOnboardingCompletion({ ...required, modelImprovementOptIn }),
      /choose whether/,
    );
  }
  for (const field of ["termsAccepted", "privacyAccepted"]) {
    assert.throws(
      () => validateOnboardingCompletion({ ...required, [field]: false }),
      /accept the terms/,
    );
  }
  assert.throws(
    () => validateOnboardingCompletion({ ...required, displayName: "  " }),
    /preferred name/,
  );
});

test("sanitization preserves explicit opt-out and bounds user instructions", () => {
  const answers = sanitizeAnswers({
    ...required,
    responsePreference: "detailed",
    customInstructions: "x".repeat(2000),
    role: "  Design  ",
  });
  assert.equal(answers.modelImprovementOptIn, false);
  assert.equal(answers.responsePreference, "detailed");
  assert.equal((answers.customInstructions as string).length, 1500);
  assert.equal(answers.role, "Design");
  assert.deepEqual(sanitizeAnswers({ customInstructions: "", role: "" }), {
    customInstructions: "",
    role: "",
  });
});
