import assert from "node:assert/strict";
import { describe, it, before, after } from "node:test";
import { createStreamEventBatcher } from "@/lib/stream-event-batcher";
import type { StreamEvent } from "@/lib/chat-stream";

describe("createStreamEventBatcher", () => {
  const g = globalThis as typeof globalThis & {
    requestAnimationFrame?: typeof requestAnimationFrame;
    cancelAnimationFrame?: typeof cancelAnimationFrame;
  };
  let previousRaf: typeof requestAnimationFrame | undefined;
  let previousCancel: typeof cancelAnimationFrame | undefined;

  before(() => {
    previousRaf = g.requestAnimationFrame;
    previousCancel = g.cancelAnimationFrame;
    g.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      return setTimeout(() => cb(Date.now()), 0) as unknown as number;
    }) as typeof requestAnimationFrame;
    g.cancelAnimationFrame = ((id: number) => {
      clearTimeout(id);
    }) as typeof cancelAnimationFrame;
  });

  after(() => {
    if (previousRaf) g.requestAnimationFrame = previousRaf;
    else delete g.requestAnimationFrame;
    if (previousCancel) g.cancelAnimationFrame = previousCancel;
    else delete g.cancelAnimationFrame;
  });

  it("cancel drops pending events without flushing", async () => {
    const flushed: StreamEvent[][] = [];
    const batcher = createStreamEventBatcher({
      onFlush: (events) => {
        flushed.push(events);
      },
    });

    batcher.push({ type: "answer_delta", delta: "hello" });
    batcher.cancel();

    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(flushed.length, 0);
  });

  it("dispose flushes pending events", () => {
    const flushed: StreamEvent[][] = [];
    const batcher = createStreamEventBatcher({
      onFlush: (events) => {
        flushed.push(events);
      },
    });

    batcher.push({ type: "answer_delta", delta: "a" });
    batcher.push({ type: "answer_delta", delta: "b" });
    batcher.dispose();

    assert.equal(flushed.length, 1);
    assert.deepEqual(flushed[0], [{ type: "answer_delta", delta: "ab" }]);
  });
});
