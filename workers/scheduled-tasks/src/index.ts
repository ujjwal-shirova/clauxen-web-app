/**
 * Clauxen scheduled-tasks Worker
 *
 * Cron (* * * * *) → POST Vercel /api/v1/internal/scheduled-tasks/dispatch?async=1
 * Auth: Bearer SCHEDULED_TASKS_INTERNAL_TOKEN + x-clauxen-internal
 *
 * The Next.js app claims due rows, creates chats, and runs the agent loop.
 * This Worker only wakes the app on a reliable edge cadence.
 */

export interface Env {
  SCHEDULED_TASKS_INTERNAL_TOKEN?: string;
  /** e.g. https://clauxen.com — no trailing slash */
  APP_ORIGIN?: string;
}

const DEFAULT_ORIGIN = "https://www.clauxen.com";

function origin(env: Env): string {
  return (env.APP_ORIGIN?.trim() || DEFAULT_ORIGIN).replace(/\/+$/, "");
}

async function dispatch(env: Env, limit = 8): Promise<Response> {
  const token = env.SCHEDULED_TASKS_INTERNAL_TOKEN?.trim();
  if (!token) {
    return new Response(
      JSON.stringify({ error: "SCHEDULED_TASKS_INTERNAL_TOKEN missing" }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }

  const url = `${origin(env)}/api/v1/internal/scheduled-tasks/dispatch?async=1&limit=${limit}`;
  // CF zone blocks empty UA (custom rule). Workers fetch often omits UA → 403 challenge HTML.
  const res = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "x-clauxen-internal": token,
      "content-type": "application/json",
      "user-agent": "clauxen-scheduled-tasks-worker/1.0",
      accept: "application/json",
    },
  });

  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { "content-type": "application/json" },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ ok: true, worker: "scheduled-tasks" }), {
        headers: { "content-type": "application/json" },
      });
    }
    if (url.pathname === "/v1/dispatch" && request.method === "POST") {
      const limit = Number(url.searchParams.get("limit") ?? "8");
      return dispatch(env, Number.isFinite(limit) ? limit : 8);
    }
    return new Response("Not found", { status: 404 });
  },

  async scheduled(
    _controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    ctx.waitUntil(
      dispatch(env, 8).then(async (res) => {
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          console.error(
            `[scheduled-tasks] dispatch ${res.status}: ${body.slice(0, 400)}`,
          );
        }
      }),
    );
  },
};
