import assert from "node:assert/strict";
import test from "node:test";
import {
  applyAssemblyTurn,
  EMPTY_STREAMING_TRANSCRIPT,
  joinDraftAndTranscript,
  transcriptText,
} from "@/features/dictation/transcript";

test("replaces partial turns and preserves finalized turn order", () => {
  let state = applyAssemblyTurn(EMPTY_STREAMING_TRANSCRIPT, {
    type: "Turn",
    turn_order: 0,
    end_of_turn: false,
    transcript: "hello wor",
  });
  state = applyAssemblyTurn(state, {
    type: "Turn",
    turn_order: 0,
    end_of_turn: false,
    transcript: "hello world",
  });
  assert.equal(transcriptText(state), "hello world");

  state = applyAssemblyTurn(state, {
    type: "Turn",
    turn_order: 0,
    end_of_turn: true,
    transcript: "Hello world.",
  });
  state = applyAssemblyTurn(state, {
    type: "Turn",
    turn_order: 1,
    end_of_turn: false,
    transcript: "Next thought",
  });
  assert.equal(transcriptText(state), "Hello world. Next thought");
});

test("joins live transcript onto an existing composer draft", () => {
  assert.equal(
    joinDraftAndTranscript("Existing", "new words"),
    "Existing new words",
  );
  assert.equal(
    joinDraftAndTranscript("Existing ", "new words"),
    "Existing new words",
  );
  assert.equal(joinDraftAndTranscript("", "new words"), "new words");
});
