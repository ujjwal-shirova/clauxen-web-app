import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createSseParser } from "@/lib/chat-stream";
import { consumeClauxenStreamResponse } from "@/lib/ui-message-stream";

describe("chat stream terminal states", () => {
  it("parses narration, answer-finalize, and failed-tool events", () => {
    const events: unknown[] = [];
    const parser = createSseParser((event) => events.push(event));

    parser(
      [
        'data: {"type":"narration_delta","segmentId":"note-1","delta":"I’ll verify the docs."}',
        'data: {"type":"answer_finalize","segmentId":"note-1","text":"I’ll verify the docs."}',
        'data: {"type":"tool_end","toolCallId":"tool-1","name":"web_fetch","result":"{\\"error\\":\\"timeout\\"}","isError":true}',
        "",
      ].join("\n\n"),
    );

    assert.deepEqual(events, [
      {
        type: "narration_delta",
        segmentId: "note-1",
        delta: "I’ll verify the docs.",
      },
      {
        type: "answer_finalize",
        segmentId: "note-1",
        text: "I’ll verify the docs.",
      },
      {
        type: "tool_end",
        toolCallId: "tool-1",
        name: "web_fetch",
        result: '{"error":"timeout"}',
        isError: true,
      },
    ]);
  });

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

  it("soft-completes an incomplete legacy stream instead of throwing", async () => {
    const events: Array<{ type: string }> = [];
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

    await consumeClauxenStreamResponse(response, (event) => {
      events.push({ type: event.type });
    });

    assert.deepEqual(
      events.map((event) => event.type),
      ["answer_delta", "done"],
    );
  });
});
