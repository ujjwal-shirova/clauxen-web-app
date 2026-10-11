/** A bounded, optional HTTP subscriber to a server-owned generation. */
export function createDurableSubscription(backgroundEvent: {
  type: "backgrounded";
  jobId: string;
  chatId: string;
}) {
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>(
    {
      start(value) {
        controller = value;
      },
      cancel() {
        // Cancelling the HTTP subscription does not cancel inference.
        controller = null;
      },
    },
    { highWaterMark: 256 * 1024, size: (chunk) => chunk.byteLength },
  );
  const close = () => {
    try {
      controller?.close();
    } catch {
      // Already disconnected.
    }
    controller = null;
  };
  const write = (chunk: Uint8Array) => {
    if (!controller) return;
    try {
      controller.enqueue(chunk);
    } catch {
      controller = null;
    }
  };
  const handoff = () => {
    write(encoder.encode(`data: ${JSON.stringify(backgroundEvent)}\n\n`));
    close();
  };
  return {
    stream,
    close,
    handoff,
    write(chunk: Uint8Array) {
      if (controller && (controller.desiredSize ?? 0) < chunk.byteLength) {
        // Fall back to snapshots instead of buffering an unbounded transcript.
        handoff();
        return;
      }
      write(chunk);
    },
  };
}
