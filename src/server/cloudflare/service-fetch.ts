import { cloudflareContext } from "./context";
import type { RequestInit as WorkerRequestInit } from "@cloudflare/workers-types";

type ServiceBinding =
  | "CHAT_COORD"
  | "CHAT_HISTORY"
  | "BILLING"
  | "AUTH_EMAIL"
  | "SHARE_GATE";

/** Route internal JSON calls through private bindings; retain local Node fallback. */
export async function serviceFetch(
  name: ServiceBinding,
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  const service = cloudflareContext()?.env[name];
  if (!service || (init.body && typeof init.body !== "string"))
    return fetch(url, init);
  const response = await service.fetch(url, {
    method: init.method,
    headers: Object.fromEntries(new Headers(init.headers).entries()),
    body: typeof init.body === "string" ? init.body : undefined,
    // Both type libraries describe the same native AbortSignal; their
    // EventListener overloads differ. Preserve real cancellation semantics.
    signal: init.signal as WorkerRequestInit["signal"],
  });
  // Workers' generated stream/header types differ from DOM types. Stream
  // without buffering the payload or hiding that difference with type casts.
  const reader = response.body?.getReader();
  const body = reader
    ? new ReadableStream<Uint8Array>({
        async pull(controller) {
          const next = await reader.read();
          if (next.done) controller.close();
          else controller.enqueue(next.value);
        },
        cancel(reason) {
          return reader.cancel(reason);
        },
      })
    : null;
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: Object.fromEntries(response.headers.entries()),
  });
}
