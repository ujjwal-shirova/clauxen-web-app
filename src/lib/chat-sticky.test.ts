/**
 * Sticky near-bottom policy for chat thread docking.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  shouldPinLatestStickyTurn,
  STICKY_NEAR_BOTTOM_PX,
  STICKY_NEAR_BOTTOM_STREAMING_PX,
} from "./chat-sticky";

describe("shouldPinLatestStickyTurn", () => {
  it("pins the latest turn when near the bottom", () => {
    const clientHeight = 800;
    const scrollHeight = 2800;
    const maxTop = scrollHeight - clientHeight;
    assert.equal(
      shouldPinLatestStickyTurn(
        maxTop - (STICKY_NEAR_BOTTOM_PX - 10),
        scrollHeight,
        clientHeight,
        false,
      ),
      true,
    );
  });

  it("uses a wider band while generating (ease lag)", () => {
    const clientHeight = 800;
    const scrollHeight = 2800;
    const maxTop = scrollHeight - clientHeight;
    const lag =
      (STICKY_NEAR_BOTTOM_PX + STICKY_NEAR_BOTTOM_STREAMING_PX) / 2;
    const scrollTop = maxTop - lag;

    assert.equal(
      shouldPinLatestStickyTurn(scrollTop, scrollHeight, clientHeight, false),
      false,
    );
    assert.equal(
      shouldPinLatestStickyTurn(scrollTop, scrollHeight, clientHeight, true),
      true,
    );
  });

  it("does not force-pin when the user has scrolled far up", () => {
    assert.equal(shouldPinLatestStickyTurn(40, 2800, 800, true), false);
  });

  it("does not force-pin when content fits the viewport", () => {
    assert.equal(shouldPinLatestStickyTurn(0, 400, 800, false), false);
  });
});
