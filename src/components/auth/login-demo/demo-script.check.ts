import assert from "node:assert/strict";
import {
  DEMO_AGENT_KEYFRAMES,
  DEMO_AGENT_TURN,
  DEMO_CHAT_TURNS,
  DEMO_FILES_TURN,
  applyAgentDemoKeyframe,
  buildStreamingAgentAssistant,
} from "./chat-script";
import {
  DEMO_DRAG_FILE_IDS,
  DEMO_FINDER_FILES,
} from "./demo-files";

assert.equal(DEMO_CHAT_TURNS.length, 1, "agent scene is a single turn");
assert.equal(DEMO_CHAT_TURNS[0]?.id, DEMO_AGENT_TURN.id);
assert.ok(DEMO_AGENT_TURN.prompt.length > 40);
assert.ok(DEMO_FILES_TURN.prompt.length > 10);
assert.ok(DEMO_AGENT_KEYFRAMES.length >= 8);

const kinds = DEMO_AGENT_KEYFRAMES.map((b) => b.frame.kind);
assert.ok(kinds.includes("thinking_start"));
assert.ok(kinds.includes("tool_start"));
assert.ok(kinds.includes("answer_stream"));
assert.ok(kinds.includes("complete"));

let msg = buildStreamingAgentAssistant(DEMO_AGENT_TURN, 0, 1_000);
for (const beat of DEMO_AGENT_KEYFRAMES) {
  if (beat.frame.kind === "thinking_stream") {
    msg = applyAgentDemoKeyframe(msg, beat.frame, 1_000);
    continue;
  }
  if (beat.frame.kind === "tool_args") {
    msg = applyAgentDemoKeyframe(msg, beat.frame, 1_000);
    continue;
  }
  if (beat.frame.kind === "answer_stream") {
    msg = applyAgentDemoKeyframe(msg, beat.frame, 1_000);
    continue;
  }
  msg = applyAgentDemoKeyframe(msg, beat.frame, 1_000);
}
assert.equal(msg.agentMode, true);
assert.equal(msg.agentFrameComplete, true);
assert.ok((msg.agentFrames?.[0]?.segments.length ?? 0) >= 4);
assert.ok((msg.agentArtifacts?.length ?? 0) >= 1);
assert.match(msg.content, /brief/i);

assert.ok(DEMO_FINDER_FILES.length >= 3);
for (const id of DEMO_DRAG_FILE_IDS) {
  assert.ok(
    DEMO_FINDER_FILES.some((f) => f.id === id),
    `drag id ${id} must exist in finder files`,
  );
}

console.log("login-demo script check ok");
