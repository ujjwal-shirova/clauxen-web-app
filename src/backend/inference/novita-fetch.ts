import { Agent, fetch as undiciFetch } from "undici";

/**
 * Dedicated dispatcher for Novita OpenAI-compatible API.
 * Force HTTP/1.1 — Node/undici HTTP/2 to api.novita.ai can stall until the
 * 300s h2 stream timeout (UND_ERR_INFO) with no tokens delivered.
 */
const novitaDispatcher = new Agent({
  allowH2: false,
  connect: { timeout: 30_000 },
  headersTimeout: 120_000,
  bodyTimeout: 0,
  keepAliveTimeout: 4_000,
  keepAliveMaxTimeout: 30_000,
  pipelining: 0,
});

/** Stable fetch for Novita — HTTP/1.1, streaming-safe. */
export const novitaFetch: typeof fetch = (input, init) =>
  undiciFetch(
    input as Parameters<typeof undiciFetch>[0],
    {
      ...init,
      cache: "no-store",
      dispatcher: novitaDispatcher,
    } as Parameters<typeof undiciFetch>[1],
  ) as unknown as ReturnType<typeof fetch>;
