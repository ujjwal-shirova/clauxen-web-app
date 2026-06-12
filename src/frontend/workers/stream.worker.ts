/// <reference lib="webworker" />

import { marked } from "marked";

export type WorkerStreamEvent =
  | { type: "start" }
  | { type: "thinking_start" }
  | { type: "thinking_delta"; delta: string }
  | { type: "answer_delta"; delta: string }
  | { type: "done" }
  | { type: "error"; message: string };

export type WorkerInbound =
  | { type: "chunk"; text: string }
  | { type: "reset" }
  | { type: "flush" };

export type WorkerOutbound =
  | { type: "events"; events: WorkerStreamEvent[] }
  | { type: "parsed"; messageId: string; blocks: string[]; plainText: string };

const MAX_SSE_BUFFER_BYTES = 256 * 1024;
const MAX_SSE_DATA_BYTES = 64 * 1024;
const FLUSH_INTERVAL_MS = 16;

let buffer = "";
let pendingEvents: WorkerStreamEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let accumulatedAnswer = "";

function parseStreamEvent(raw: unknown): WorkerStreamEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const event = raw as { type?: unknown; delta?: unknown; message?: unknown };
  switch (event.type) {
    case "start":
    case "thinking_start":
    case "done":
      return { type: event.type };
    case "thinking_delta":
    case "answer_delta":
      return typeof event.delta === "string"
        ? { type: event.type, delta: event.delta }
        : null;
    case "error":
      return typeof event.message === "string"
        ? { type: "error", message: event.message }
        : null;
    default:
      return null;
  }
}

function scheduleFlush() {
  if (flushTimer !== null) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    if (pendingEvents.length === 0) return;
    const batch = pendingEvents;
    pendingEvents = [];
    self.postMessage({ type: "events", events: batch } satisfies WorkerOutbound);
  }, FLUSH_INTERVAL_MS);
}

function enqueueEvent(event: WorkerStreamEvent) {
  pendingEvents.push(event);
  if (event.type === "answer_delta") {
    accumulatedAnswer += event.delta;
  }
  scheduleFlush();
}

function parseSseChunk(chunk: string) {
  buffer += chunk;
  if (buffer.length > MAX_SSE_BUFFER_BYTES) {
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

    const payload = dataLine.slice(6);
    if (payload.length > MAX_SSE_DATA_BYTES) continue;

    try {
      const parsed = parseStreamEvent(JSON.parse(payload));
      if (parsed) enqueueEvent(parsed);
    } catch {
      continue;
    }
  }
}

function splitMarkdownBlocks(text: string): string[] {
  if (!text.trim()) return [];
  try {
    const tokens = marked.lexer(text);
    return tokens.map((token) => {
      if ("raw" in token && typeof token.raw === "string") return token.raw;
      if ("text" in token && typeof token.text === "string") return token.text;
      return "";
    }).filter(Boolean);
  } catch {
    return [text];
  }
}

self.onmessage = (event: MessageEvent<WorkerInbound>) => {
  const msg = event.data;
  switch (msg.type) {
    case "reset":
      buffer = "";
      pendingEvents = [];
      accumulatedAnswer = "";
      if (flushTimer !== null) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }
      break;
    case "chunk":
      parseSseChunk(msg.text);
      break;
    case "flush":
      if (flushTimer !== null) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }
      if (pendingEvents.length > 0) {
        const batch = pendingEvents;
        pendingEvents = [];
        self.postMessage({ type: "events", events: batch } satisfies WorkerOutbound);
      }
      if (accumulatedAnswer) {
        const blocks = splitMarkdownBlocks(accumulatedAnswer);
        self.postMessage({
          type: "parsed",
          messageId: "",
          blocks,
          plainText: accumulatedAnswer,
        } satisfies WorkerOutbound);
      }
      break;
  }
};

export {};
