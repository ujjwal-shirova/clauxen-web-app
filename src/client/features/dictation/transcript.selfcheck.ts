import { insertTranscriptAtCaret, splitDraftAroundCaret } from "./transcript";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`dictation transcript selfcheck: ${msg}`);
}

assert(
  insertTranscriptAtCaret("", "hello", "").text === "hello",
  "empty draft becomes transcript",
);
assert(
  insertTranscriptAtCaret("Ask me", "later", "").text === "Ask me later",
  "appends with a space",
);
assert(
  insertTranscriptAtCaret("Ask me ", "later", "").text === "Ask me later",
  "does not double-space",
);

const mid = insertTranscriptAtCaret("Hello ", "world", " there");
assert(mid.text === "Hello world there", "inserts at caret without erase");
assert(mid.caret.start === "Hello world".length, "caret follows transcript");

const replace = splitDraftAroundCaret("paint the cat red", {
  start: 10,
  end: 13,
});
assert(replace.prefix === "paint the ", "prefix before selection");
assert(replace.suffix === " red", "suffix after selection");
const spliced = insertTranscriptAtCaret(replace.prefix, "dog", replace.suffix);
assert(spliced.text === "paint the dog red", "selection is replaced");

console.log("dictation transcript.selfcheck: ok");
