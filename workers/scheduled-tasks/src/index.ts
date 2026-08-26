/**
 * Clauxen scheduled-tasks Worker
 *
 * Cron → claim durable jobs → Queue → one Vercel execution request per run.
 * Auth: Bearer SCHEDULED_TASKS_INTERNAL_TOKEN + x-clauxen-internal
 *
 * Queue delivery is at-least-once. Supabase execution_key/run leases make it
 * idempotent, while explicit ack/retry gives failures bounded recovery.
 */

type AutomationJob = {
  runId: string;
  taskId: string;
  executionKey: string;
  scheduledFor: string;
};

export interface Env {
  SCHEDULED_TASKS_INTERNAL_TOKEN?: string;
  /** e.g. https://clauxen.com — no trailing slash */
  APP_ORIGIN?: string;
  AUTOMATION_QUEUE: Queue<AutomationJob>;
}

const DEFAULT_ORIGIN = "https://www.clauxen.com";

function origin(env: Env): string {
  return (env.APP_ORIGIN?.trim() || DEFAULT_ORIGIN).replace(/\/+$/, "");
}

function internalHeaders(token: string): HeadersInit {
  return {
    authorization: `Bearer ${token}`,
    "x-clauxen-internal": token,
    "content-type": "application/json",
    "user-agent": "clauxen-scheduled-tasks-worker/2.0",
    accept: "application/json",
  };
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

function isInternalRequest(request: Request, env: Env): boolean {
  const token = env.SCHEDULED_TASKS_INTERNAL_TOKEN?.trim();
  if (!token) return false;
  const authorization = request.headers.get("authorization") ?? "";
  const candidate = authorization.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : (request.headers.get("x-clauxen-internal")?.trim() ?? "");
  return Boolean(candidate) && constantTimeEqual(candidate, token);
}

async function dispatch(env: Env, limit = 20): Promise<Response> {
  const token = env.SCHEDULED_TASKS_INTERNAL_TOKEN?.trim();
  if (!token) {
    return new Response(
      JSON.stringify({ error: "SCHEDULED_TASKS_INTERNAL_TOKEN missing" }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }

  const url = `${origin(env)}/api/v1/internal/scheduled-tasks/dispatch?limit=${limit}`;
  const res = await fetch(url, {
    method: "POST",
    headers: internalHeaders(token),
  });

  const text = await res.text();
  if (!res.ok) {
    console.error(
      JSON.stringify({
        event: "automation_dispatch_failed",
        status: res.status,
        body: text.slice(0, 400),
      }),
    );
    return new Response(text, {
      status: res.status,
      headers: { "content-type": "application/json" },
    });
  }
  let jobs: AutomationJob[] = [];
  try {
    const parsed = JSON.parse(text) as { jobs?: AutomationJob[] };
    jobs = Array.isArray(parsed.jobs) ? parsed.jobs : [];
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid dispatch response" }),
      { status: 502, headers: { "content-type": "application/json" } },
    );
  }
  if (jobs.length) {
    await env.AUTOMATION_QUEUE.sendBatch(jobs.map((body) => ({ body })));
  }
  console.log(
    JSON.stringify({
      event: "automation_dispatch_enqueued",
      count: jobs.length,
    }),
  );
  return new Response(text, {
    status: res.status,
    headers: { "content-type": "application/json" },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/health") {
      return new Response(
        JSON.stringify({ ok: true, worker: "scheduled-tasks" }),
        {
          headers: { "content-type": "application/json" },
        },
      );
    }
    if (url.pathname === "/v1/dispatch" && request.method === "POST") {
      if (!isInternalRequest(request, env)) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "content-type": "application/json" },
        });
      }
      const limit = Number(url.searchParams.get("limit") ?? "20");
      return dispatch(
        env,
        Number.isFinite(limit) ? Math.min(Math.max(1, limit), 100) : 20,
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
      dispatch(env, 20).then(async (res) => {
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          console.error(
            `[scheduled-tasks] dispatch ${res.status}: ${body.slice(0, 400)}`,
          );
        }
      }),
    );
  },

  async queue(batch: MessageBatch<AutomationJob>, env: Env): Promise<void> {
    const token = env.SCHEDULED_TASKS_INTERNAL_TOKEN?.trim();
    for (const message of batch.messages) {
      if (!token) {
        console.error(
          JSON.stringify({
            event: "automation_execute_config_missing",
            runId: message.body.runId,
          }),
        );
        message.retry({ delaySeconds: 300 });
        continue;
      }
      try {
        const response = await fetch(
          `${origin(env)}/api/v1/internal/scheduled-tasks/execute`,
          {
            method: "POST",
            headers: internalHeaders(token),
            body: JSON.stringify({ runId: message.body.runId }),
          },
        );
        const responseText = await response.text();
        if (response.ok) {
          console.log(
            JSON.stringify({
              event: "automation_execute_ack",
              runId: message.body.runId,
              attempt: message.attempts,
            }),
          );
          message.ack();
        } else if (
          response.status === 409 ||
          response.status === 429 ||
          response.status >= 500
        ) {
          const delaySeconds = Math.min(
            900,
            30 * 2 ** Math.max(0, message.attempts - 1),
          );
          console.warn(
            JSON.stringify({
              event: "automation_execute_retry",
              runId: message.body.runId,
              status: response.status,
              delaySeconds,
              body: responseText.slice(0, 300),
            }),
          );
          message.retry({ delaySeconds });
        } else {
          console.error(
            JSON.stringify({
              event: "automation_execute_terminal",
              runId: message.body.runId,
              status: response.status,
              body: responseText.slice(0, 300),
            }),
          );
          message.ack();
        }
      } catch (error) {
        console.error(
          JSON.stringify({
            event: "automation_execute_network_error",
            runId: message.body.runId,
            error: error instanceof Error ? error.message : String(error),
          }),
        );
        message.retry({
          delaySeconds: Math.min(
            900,
            30 * 2 ** Math.max(0, message.attempts - 1),
          ),
        });
      }
    }
  },
};
