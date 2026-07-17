import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createSseParser } from "@/frontend/lib/chat-stream";
import { consumeClauxenStreamResponse } from "@/frontend/lib/ui-message-stream";

describe("chat stream terminal states", () => {
  it("propagates a consumer error instead of swallowing an SSE error event", () => {
    const parser = createSseParser((event) => {
      if (event.type === "error") throw new Error(event.message);
    });

    assert.throws(
      () =>
        parser(
          'data: {"type":"error","message":"Provider is unavailable"}\n\n',
        ),
      /Provider is unavailable/,
    );
  });

  it("rejects an incomplete legacy stream rather than marking it done", async () => {
    const response = new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode(
              'data: {"type":"answer_delta","delta":"partial"}\n\n',
            ),
          );
          controller.close();
        },
      }),
      { headers: { "content-type": "text/event-stream" } },
    );

    await assert.rejects(
      () => consumeClauxenStreamResponse(response, () => {}),
      /ended before completion/,
    );
  });
});
