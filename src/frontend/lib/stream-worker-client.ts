"use client";

import type { StreamEvent } from "@/frontend/lib/chat-stream";
import type {
  WorkerInbound,
  WorkerOutbound,
  WorkerStreamEvent,
} from "@/frontend/workers/stream.worker";

type StreamWorkerClientOptions = {
  onEvents: (events: StreamEvent[]) => void;
  onParsedBlocks?: (blocks: string[], plainText: string) => void;
};

let sharedWorker: Worker | null = null;
let workerSupported = true;

function getStreamWorker(): Worker | null {
  if (typeof window === "undefined") return null;
  if (!workerSupported) return null;

  if (!sharedWorker) {
    try {
      sharedWorker = new Worker(
        new URL("../workers/stream.worker.ts", import.meta.url),
      );
    } catch {
      workerSupported = false;
      return null;
    }
  }
  return sharedWorker;
}

/** Fallback: chunk SSE on main thread via idle slices when Workers unavailable. */
function createIdleSseParser(onEvent: (event: StreamEvent) => void) {
  let buffer = "";
  const queue: StreamEvent[] = [];
  const MAX_QUEUE = 4096;
  let draining = false;

  const drain = () => {
    if (draining || queue.length === 0) return;
    draining = true;
    const start = performance.now();
    while (queue.length > 0 && performance.now() - start < 12) {
      onEvent(queue.shift()!);
    }
    draining = false;
    if (queue.length > 0) {
      if (typeof requestIdleCallback !== "undefined") {
        requestIdleCallback(drain, { timeout: 16 });
      } else {
        setTimeout(drain, 16);
      }
    }
  };

  return (chunk: string) => {
    buffer += chunk;
    const MAX = 256 * 1024;
    if (buffer.length > MAX) {
      buffer = "";
      return;
    }
    while (true) {
      const boundary = buffer.indexOf("\n\n");
      if (boundary === -1) break;
      const rawEvent = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const dataLine = rawEvent
        .split("\n")
        .find((line) => line.startsWith("data: "));
      if (!dataLine) continue;
      try {
        const parsed = JSON.parse(dataLine.slice(6)) as StreamEvent;
        if (parsed?.type) {
          if (queue.length >= MAX_QUEUE) queue.shift();
          queue.push(parsed);
        }
      } catch {
        continue;
      }
    }
    drain();
  };
}

export function createStreamWorkerClient(
  options: StreamWorkerClientOptions,
): {
  postChunk: (text: string) => void;
  reset: () => void;
  flush: () => void;
  dispose: () => void;
} {
  const worker = getStreamWorker();

  if (!worker) {
    const parseChunk = createIdleSseParser((event) => {
      options.onEvents([event]);
    });
    return {
      postChunk: parseChunk,
      reset: () => {},
      flush: () => {},
      dispose: () => {},
    };
  }

  const handler = (event: MessageEvent<WorkerOutbound>) => {
    const data = event.data;
    if (data.type === "events") {
      options.onEvents(data.events as StreamEvent[]);
    } else if (data.type === "parsed" && options.onParsedBlocks) {
      options.onParsedBlocks(data.blocks, data.plainText);
    }
  };

  worker.addEventListener("message", handler);

  const post = (msg: WorkerInbound) => worker.postMessage(msg);

  return {
    postChunk: (text) => post({ type: "chunk", text }),
    reset: () => post({ type: "reset" }),
    flush: () => post({ type: "flush" }),
    dispose: () => worker.removeEventListener("message", handler),
  };
}
