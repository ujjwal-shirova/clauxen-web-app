import assert from "node:assert/strict";
import { DEMO_DAILY_TURN, DEMO_CHAT_TURNS } from "./chat-script";
import {
  DEMO_DRAG_FILE_IDS,
  DEMO_FINDER_FILES,
} from "./demo-files";

/** ponytail: smallest check that the demo script contract still holds. */
assert.equal(DEMO_CHAT_TURNS.length, 1, "daily scene is a single turn");
assert.equal(DEMO_CHAT_TURNS[0]?.id, DEMO_DAILY_TURN.id);
assert.match(DEMO_DAILY_TURN.prompt, /^Hi,/);
assert.ok(DEMO_FINDER_FILES.length >= 3);
for (const id of DEMO_DRAG_FILE_IDS) {
  assert.ok(
    DEMO_FINDER_FILES.some((f) => f.id === id),
    `drag id ${id} must exist in finder files`,
  );
}

console.log("login-demo script check ok");
