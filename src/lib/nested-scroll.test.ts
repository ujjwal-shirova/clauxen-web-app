import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  hostCanConsume,
  resolveWheelIntent,
  scrollHostAxes,
  wheelDeltaInPixels,
  type OverflowStyle,
} from "@/lib/nested-scroll";

type FakeHost = {
  scrollTop: number;
  scrollLeft: number;
  scrollHeight: number;
  clientHeight: number;
  scrollWidth: number;
  clientWidth: number;
};

function host(partial: Partial<FakeHost>): HTMLElement {
  return {
    scrollTop: 0,
    scrollLeft: 0,
    scrollHeight: 100,
    clientHeight: 100,
    scrollWidth: 100,
    clientWidth: 100,
    ...partial,
  } as unknown as HTMLElement;
}

const style = (overflowX: string, overflowY: string): OverflowStyle =>
  ({ overflowX, overflowY }) as OverflowStyle;

describe("scrollHostAxes", () => {
  it("marks a code block as x-only", () => {
    const el = host({ scrollWidth: 800, clientWidth: 400 });
    assert.deepEqual(scrollHostAxes(el, style("auto", "hidden")), {
      x: true,
      y: false,
    });
  });

  it("marks the transcript viewport as y-only", () => {
    const el = host({ scrollHeight: 4000, clientHeight: 600 });
    assert.deepEqual(scrollHostAxes(el, style("hidden", "auto")), {
      x: false,
      y: true,
    });
  });

  it("ignores overflow values that cannot scroll", () => {
    const el = host({ scrollHeight: 4000, clientHeight: 600 });
    assert.deepEqual(scrollHostAxes(el, style("visible", "hidden")), {
      x: false,
      y: false,
    });
  });
});

describe("hostCanConsume", () => {
  it("has room while not pinned at the end", () => {
    const el = host({ scrollTop: 200, scrollHeight: 4000, clientHeight: 600 });
    assert.equal(hostCanConsume(el, "y", 120), true);
    assert.equal(hostCanConsume(el, "y", -120), true);
  });

  it("is exhausted at the bottom edge", () => {
    const el = host({ scrollTop: 3400, scrollHeight: 4000, clientHeight: 600 });
    assert.equal(hostCanConsume(el, "y", 120), false);
    assert.equal(hostCanConsume(el, "y", -120), true);
  });

  it("is exhausted at the top edge", () => {
    const el = host({ scrollTop: 0, scrollHeight: 4000, clientHeight: 600 });
    assert.equal(hostCanConsume(el, "y", -120), false);
  });

  it("never consumes on an axis with no overflow", () => {
    const el = host({});
    assert.equal(hostCanConsume(el, "y", 120), false);
    assert.equal(hostCanConsume(el, "x", 120), false);
  });
});

describe("resolveWheelIntent", () => {
  it("treats a dominant deltaY as vertical", () => {
    assert.deepEqual(resolveWheelIntent({ deltaX: 2, deltaY: 90 }), {
      axis: "y",
      delta: 90,
    });
  });

  it("treats a dominant deltaX as horizontal", () => {
    assert.deepEqual(resolveWheelIntent({ deltaX: -70, deltaY: 4 }), {
      axis: "x",
      delta: -70,
    });
  });

  it("maps shift+wheel to horizontal even when the delta rides on Y", () => {
    assert.deepEqual(
      resolveWheelIntent({ deltaX: 0, deltaY: 60, shiftKey: true }),
      { axis: "x", delta: 60 },
    );
  });

  it("ignores empty gestures", () => {
    assert.equal(resolveWheelIntent({ deltaX: 0, deltaY: 0 }), null);
  });
});

describe("wheelDeltaInPixels", () => {
  it("keeps pixel deltas unchanged", () => {
    assert.equal(wheelDeltaInPixels(12, 0, 600), 12);
  });

  it("converts line deltas for manual nested-scroll routing", () => {
    assert.equal(wheelDeltaInPixels(-3, 1, 600), -48);
  });

  it("converts page deltas using the target viewport size", () => {
    assert.equal(wheelDeltaInPixels(1, 2, 720), 720);
  });
});
