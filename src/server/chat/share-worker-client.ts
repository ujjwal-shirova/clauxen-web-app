import { serviceFetch } from "@/server/cloudflare/service-fetch";
import { env } from "@/server/config/env";
import type { SharedChatSnapshot } from "@/lib/share-public";

function workerBase(): string | null {
  const base = env.shareWorkerUrl;
  const token = env.shareWorkerInternalToken;
  if (!base || !token) return null;
  return base;
}

async function postInternal(path: string, body: unknown): Promise<boolean> {
  const base = workerBase();
  const token = env.shareWorkerInternalToken;
  if (!base || !token) return false;
  try {
    const response = await serviceFetch("SHARE_GATE", `${base}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "ClauxenSharePublish/1.0",
        "x-clauxen-internal": token,
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    await response.body?.cancel();
    return response.ok;
  } catch {
    return false;
  }
}

/** Best-effort copy into Cloudflare KV. The database snapshot still opens the link. */
export function publishShareToWorker(input: {
  tokenHash: string;
  snapshot: SharedChatSnapshot;
}): Promise<boolean> {
  return postInternal("/internal/publish", input);
}

export function revokeShareOnWorker(tokenHash: string): Promise<boolean> {
  return postInternal("/internal/revoke", { tokenHash });
}
