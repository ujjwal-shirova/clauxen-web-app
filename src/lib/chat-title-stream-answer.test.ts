import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createChatTitleAnswerAccumulator,
  resolveFinalStreamedAnswer,
  seedChatTitleAnswerAccumulator,
} from "@/lib/chat-title";

describe("resolveFinalStreamedAnswer", () => {
  it("prefers answer_finalize / completedAnswer over an empty title accumulator", () => {
    const acc = createChatTitleAnswerAccumulator();
    assert.equal(
      resolveFinalStreamedAnswer({
        completedAnswer: "Hey — I'm Clauxen.",
        accumulatorRaw: acc.raw,
        messageContent: "Hey — I'm Clauxen.",
      }),
      "Hey — I'm Clauxen.",
    );
  });

  it("does not let an unused empty accumulator wipe message.content", () => {
    const acc = createChatTitleAnswerAccumulator();
    assert.equal(
      resolveFinalStreamedAnswer({
        completedAnswer: "",
        accumulatorRaw: acc.raw,
        messageContent: "Hello from the reducer.",
      }),
      "Hello from the reducer.",
    );
  });

  it("uses a seeded accumulator after answer_finalize", () => {
    const acc = createChatTitleAnswerAccumulator();
    seedChatTitleAnswerAccumulator(
      acc,
      "<chat_title>Greeting</chat_title>\nHello there.",
    );
    assert.equal(
      resolveFinalStreamedAnswer({
        completedAnswer: "",
        accumulatorRaw: acc.raw,
        messageContent: "",
      }),
      "Hello there.",
    );
  });
});
