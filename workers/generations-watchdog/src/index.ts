/**
 * Clauxen generations-watchdog Worker
 *
 * Cloudflare cron (every minute) → poke Vercel's durable-generations
 * watchdog, which chains a replacement slice for every stalled background
 * job. This is the liveness driver for long assistant turns — it runs on
 * Cloudflare precisely because per-minute Vercel crons need a paid plan.
 *
 * Secrets (wrangler secret put):
 *   GENERATIONS_INTERNAL_TOKEN
 *   APP_ORIGIN (e.g. https://www.clauxen.com)
 */

export interface Env {
  GENERATIONS_INTERNAL_TOKEN?: string;
  /** e.g. https://www.clauxen.com — no trailing slash */
  APP_ORIGIN?: string;
}

const DEFAULT_ORIGIN = "https://www.clauxen.com";

function origin(env: Env): string {
  return (env.APP_ORIGIN?.trim() || DEFAULT_ORIGIN).replace(/\/+$/, "");
}

export async function pokeWatchdog(
  env: Env,
): Promise<{ ok: boolean; status: number }> {
  const token = env.GENERATIONS_INTERNAL_TOKEN?.trim();
  if (!token) {
    console.error(JSON.stringify({ event: "watchdog_poke_config_missing" }));
    return { ok: false, status: 0 };
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(
        `${origin(env)}/api/v1/internal/generations/watchdog?source=cloudflare`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-clauxen-internal": token,
            "user-agent": "clauxen-generations-watchdog/1.0",
            accept: "application/json",
          },
          body: "{}",
          signal: AbortSignal.timeout(15_000),
        },
      );
      await response.body?.cancel();
      if (!response.ok) {
        console.error(
          JSON.stringify({
            event: "watchdog_poke_failed",
            status: response.status,
            attempt,
          }),
        );
      }
      if (
        response.ok ||
        (response.status < 500 && response.status !== 429) ||
        attempt === 2
      ) {
        return { ok: response.ok, status: response.status };
      }
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "watchdog_poke_network_error",
          error: error instanceof Error ? error.message : String(error),
        }),
      );
      if (attempt === 2) return { ok: false, status: 0 };
    }
    await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
  }
  return { ok: false, status: 0 };
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/health") {
      return new Response(
        JSON.stringify({ ok: true, worker: "generations-watchdog" }),
        { headers: { "content-type": "application/json" } },
      );
    }
    return new Response("Not found", { status: 404 });
  },

  async scheduled(
    _controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    ctx.waitUntil(
      pokeWatchdog(env).then((result) => {
        if (!result.ok) {
          console.error(
            `[generations-watchdog] poke failed (status ${result.status})`,
          );
        }
      }),
    );
  },
};
