/** Explicit integration test: requires configured Supabase service credentials.
 * Creates and deletes a dedicated fixture user. Uses a local fake model only.
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

async function main() {
  loadEnvConfig(process.cwd(), true);
  const { env } = await import("../src/server/config/env");
  const { query, queryOne, getPool } = await import("../src/server/db/pool");
  const { getSupabasePublicConfig } =
    await import("../src/shared/utils/supabase/env");
  const config = getSupabasePublicConfig();
  assert(
    config.url && config.publishableKey && env.supabaseServiceRoleKey,
    "Supabase credentials required",
  );
  const admin = createClient(config.url, env.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const auth = createClient(config.url, config.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const password = "Bg!9" + randomUUID();
  const email = `background-${randomUUID()}@example.test`;
  let userId: string | undefined;
  let modelCalls = 0;
  const model = createServer(async (request, response) => {
    for await (const _chunk of request) {
      /* drain */
    }
    modelCalls++;
    response.writeHead(200, { "content-type": "text/event-stream" });
    const delta = (content: string, finish_reason: string | null = null) =>
      response.write(
        `data: ${JSON.stringify({ id: "fixture", object: "chat.completion.chunk", created: 1, model: "fixture", choices: [{ index: 0, delta: { content }, finish_reason }] })}\n\n`,
      );
    delta("BACKGROUND_");
    const timer = setTimeout(() => {
      delta("OK", "stop");
      response.end("data: [DONE]\n\n");
    }, 7000);
    response.on("close", () => clearTimeout(timer));
  });
  model.listen(0, "127.0.0.1");
  await once(model, "listening");
  const modelPort = (model.address() as { port: number }).port;
  const scheduledToken = randomUUID();
  const appPort = 19445;
  const origin = `http://127.0.0.1:${appPort}`;
  const child = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "start", "-p", String(appPort)],
    {
      env: {
        ...process.env,
        NODE_ENV: "production",
        VERCEL_ENV: "development",
        VERCEL: "0",
        Provider_BASE_URL: `http://127.0.0.1:${modelPort}/v1`,
        Provider_API_Key: "fixture-model-key",
        GENERATIONS_INTERNAL_TOKEN: randomUUID(),
        SCHEDULED_TASKS_INTERNAL_TOKEN: scheduledToken,
        CHAT_COORD_WORKER_URL: "",
        CHAT_HISTORY_WORKER_URL: "",
        EDGE_CONFIG: "",
        NEXT_PUBLIC_APP_URL: origin,
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let log = "";
  child.stdout.on("data", (chunk) => {
    log = (log + String(chunk)).slice(-5000);
  });
  child.stderr.on("data", (chunk) => {
    log = (log + String(chunk)).slice(-5000);
  });
  const pause = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));
  try {
    for (let i = 0; i < 60; i++) {
      try {
        if ((await fetch(`${origin}/api/hello`)).ok) break;
      } catch {}
      await pause(500);
    }
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    assert.ifError(created.error);
    userId = created.data.user.id;
    const signed = await auth.auth.signInWithPassword({ email, password });
    assert.ifError(signed.error);
    assert(signed.data.session);
    const headers = {
      "content-type": "application/json",
      Authorization: `Bearer ${signed.data.session.access_token}`,
    };
    const chatId = `bg-test-${randomUUID()}`;
    await query(
      `insert into public.chats(id,user_id,title) values($1,$2,'Background fixture')`,
      [chatId, userId],
    );
    const turnKey = randomUUID();
    const body = {
      messages: [
        { role: "user", content: "Reply BACKGROUND_OK without tools." },
      ],
      generateChatTitle: false,
      turn: {
        content: "Reply BACKGROUND_OK without tools.",
        userClientId: `usr-${turnKey}`,
        assistantClientId: `asst-${turnKey}`,
      },
    };
    const accepted = await fetch(`${origin}/api/v1/chats/${chatId}/generate`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    assert.equal(accepted.status, 202, await accepted.clone().text());
    const jobId = accepted.headers.get("X-Generation-Job-Id");
    assert(jobId);
    await accepted.body!.cancel(); // browser connection ends here; no polling remains
    await pause(3000);
    const running = await queryOne<{ status: string }>(
      `select status from public.chat_generation_jobs where id=$1`,
      [jobId],
    );
    assert.equal(running?.status, "running");
    const live = await (
      await fetch(`${origin}/api/v1/chats/${chatId}/live`, { headers })
    ).json();
    assert.equal(live.data.turn.status, "running");
    assert(JSON.stringify(live.data.turn.contentJson).includes("BACKGROUND_"));
    for (let i = 0; i < 40; i++) {
      const status = await queryOne<{ status: string }>(
        `select status from public.chat_generation_jobs where id=$1`,
        [jobId],
      );
      if (status?.status === "complete") break;
      await pause(500);
    }
    const finished = await queryOne<{ status: string }>(
      `select status from public.chat_generation_jobs where id=$1`,
      [jobId],
    );
    assert.equal(finished?.status, "complete");
    const saved = await queryOne<{ content: string; status: string }>(
      `select content,status from public.chat_messages where chat_id=$1 and role='assistant'`,
      [chatId],
    );
    assert.equal(saved?.content, "BACKGROUND_OK");
    assert.equal(saved?.status, "complete");
    const duplicate = await fetch(`${origin}/api/v1/chats/${chatId}/generate`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    assert.equal(duplicate.headers.get("X-Generation-Job-Id"), jobId);
    await duplicate.body?.cancel();
    await pause(500);
    assert.equal(modelCalls, 1);
    const activity = await (
      await fetch(`${origin}/api/v1/chats/${chatId}/generate/status`, {
        headers,
      })
    ).json();
    assert.equal(activity.data.active, false);
    const latest = await (
      await fetch(`${origin}/api/v1/chats/${chatId}/messages`, { headers })
    ).json();
    assert(JSON.stringify(latest).includes("BACKGROUND_OK"));
    // Completing the first reply must not hide an already queued descendant.
    const queuedJobIds: string[] = [];
    let queuedAssistantId = "";
    for (let i = 0; i < 2; i++) {
      const queuedBody = {
        ...body,
        turn: {
          ...body.turn,
          userClientId: `usr-${randomUUID()}`,
          assistantClientId: `asst-${randomUUID()}`,
        },
      };
      const queued = await fetch(`${origin}/api/v1/chats/${chatId}/generate`, {
        method: "POST",
        headers,
        body: JSON.stringify(queuedBody),
      });
      assert.equal(queued.status, 202);
      queuedJobIds.push(queued.headers.get("X-Generation-Job-Id")!);
      queuedAssistantId = queued.headers.get("X-Assistant-Message-Id")!;
      await queued.body?.cancel();
    }
    for (let i = 0; i < 60; i++) {
      const firstQueued = await queryOne<{ status: string }>(
        `select status from public.chat_generation_jobs where id=$1`,
        [queuedJobIds[0]],
      );
      if (firstQueued?.status === "complete") break;
      await pause(500);
    }
    const perspective = await queryOne<{ active_leaf_message_id: string }>(
      `select active_leaf_message_id from public.chats where id=$1`,
      [chatId],
    );
    assert.equal(perspective?.active_leaf_message_id, queuedAssistantId);
    for (let i = 0; i < 60; i++) {
      const lastQueued = await queryOne<{ status: string }>(
        `select status from public.chat_generation_jobs where id=$1`,
        [queuedJobIds[1]],
      );
      if (lastQueued?.status === "complete") break;
      await pause(500);
    }
    const queueResults = await query<{ status: string }>(
      `select status from public.chat_generation_jobs where id=any($1::uuid[])`,
      [queuedJobIds],
    );
    assert(queueResults.every((job) => job.status === "complete"));
    assert.equal(modelCalls, 3);
    const queuedHistory = await (
      await fetch(`${origin}/api/v1/chats/${chatId}/messages`, { headers })
    ).json();
    assert.equal(
      queuedHistory.data.messages.filter(
        (message: { role: string; content: string }) =>
          message.role === "assistant" && message.content === "BACKGROUND_OK",
      ).length,
      3,
    );
    // Accepted queued and running jobs are both explicitly cancellable.
    const body2 = {
      ...body,
      turn: {
        ...body.turn,
        userClientId: `usr-${randomUUID()}`,
        assistantClientId: `asst-${randomUUID()}`,
      },
    };
    const next = await fetch(`${origin}/api/v1/chats/${chatId}/generate`, {
      method: "POST",
      headers,
      body: JSON.stringify(body2),
    });
    assert.equal(next.status, 202);
    await next.body?.cancel();
    const stopped = await fetch(
      `${origin}/api/v1/chats/${chatId}/generate/stop`,
      { method: "POST", headers },
    );
    assert.equal(stopped.status, 200);
    const remaining = await query<{ id: string }>(
      `select id from public.chat_generation_jobs where chat_id=$1 and status in ('queued','running','continuing')`,
      [chatId],
    );
    assert.equal(remaining.length, 0);
    // Scheduled tasks share the durable runner, use stable IDs and advance atomically.
    const tasksRepo =
      await import("../src/server/repositories/scheduled-tasks.repository");
    const futureDate = new Date(Date.now() + 365 * 86400_000)
      .toISOString()
      .slice(0, 10);
    const scheduled = await fetch(`${origin}/api/v1/scheduled-tasks`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: "Scheduled fixture",
        requirement: "Reply BACKGROUND_OK without tools.",
        frequency: "once",
        runDate: futureDate,
        timeLocal: "12:00",
        timezone: "UTC",
        notificationMode: "off",
        modelMode: "fast",
      }),
    });
    assert.equal(scheduled.status, 201, await scheduled.clone().text());
    const {
      data: { task },
    } = await scheduled.json();
    const bad = await fetch(`${origin}/api/v1/scheduled-tasks`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: "x".repeat(51),
        requirement: "test",
        frequency: "daily",
        timeLocal: "25:00",
      }),
    });
    assert.equal(bad.status, 400);
    const enqueue = () =>
      fetch(`${origin}/api/v1/scheduled-tasks/${task.id}/run`, {
        method: "POST",
        headers,
      });
    const manual = await enqueue();
    assert.equal(manual.status, 202);
    const {
      data: { runId },
    } = await manual.json();
    assert.equal((await (await enqueue()).json()).data.runId, runId);
    // Lease this fixture directly so tests never claim another user's due task.
    await query(
      `update public.scheduled_tasks set lease_run_id=$2,lease_until=now()+interval '15 minutes' where id=$1`,
      [task.id, runId],
    );
    const internalHeaders = {
      "content-type": "application/json",
      authorization: `Bearer ${scheduledToken}`,
    };
    const execute = () =>
      fetch(`${origin}/api/v1/internal/scheduled-tasks/execute`, {
        method: "POST",
        headers: internalHeaders,
        body: JSON.stringify({ runId }),
      });
    const admitted = await execute();
    assert.equal(admitted.status, 200, await admitted.clone().text());
    const admittedData = await admitted.json();
    assert(admittedData.jobId);
    const duplicateRun = await execute();
    assert.equal(duplicateRun.status, 200);
    assert.equal((await duplicateRun.json()).jobId, admittedData.jobId);
    const beforeCalls = modelCalls;
    for (let i = 0; i < 80; i++) {
      const job = await queryOne<{ status: string }>(
        `select status from public.chat_generation_jobs where id=$1`,
        [admittedData.jobId],
      );
      if (job?.status === "complete") break;
      await pause(500);
    }
    const completion = (await tasksRepo.listScheduledRunCompletions(100)).find(
      (row) => row.run.id === runId,
    );
    assert.equal(completion?.job_status, "complete");
    assert.equal(completion?.answer, "BACKGROUND_OK");
    await tasksRepo.completeScheduledRun({
      runId,
      status: "success",
      summary: completion!.answer!,
    });
    assert.equal(
      await tasksRepo.completeScheduledRun({
        runId,
        status: "success",
        summary: "duplicate",
      }),
      null,
    );
    const preserved = await tasksRepo.getScheduledTask(task.id, userId);
    assert.equal(preserved?.status, "active");
    assert.equal(
      new Date(preserved!.next_run_at!).toISOString(),
      new Date(task.next_run_at).toISOString(),
    );
    assert.equal(preserved?.run_count, 1);
    assert.equal(preserved?.last_chat_id, runId);
    assert(
      modelCalls <= beforeCalls + 1,
      "Duplicate delivery must not start another model call",
    );
    // A regular occurrence completes a one-time schedule, respecting a pause made during execution.
    const regular = await queryOne<{ id: string }>(
      `insert into public.scheduled_task_runs(task_id,user_id,status,scheduled_for,execution_key)
      values($1,$2,'running',now(),$3) returning id`,
      [task.id, userId, `fixture:${randomUUID()}`],
    );
    await query(
      `update public.scheduled_tasks set lease_run_id=$2,lease_until=now()+interval '15 minutes',status='paused',next_run_at=null where id=$1`,
      [task.id, regular!.id],
    );
    await tasksRepo.completeScheduledRun({
      runId: regular!.id,
      status: "skipped",
      summary: "Paused fixture",
    });
    assert.equal(
      (await tasksRepo.getScheduledTask(task.id, userId))?.status,
      "paused",
    );
    const resumed = await fetch(`${origin}/api/v1/scheduled-tasks/${task.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ status: "active" }),
    });
    assert.equal(resumed.status, 200);
    const edited = await fetch(`${origin}/api/v1/scheduled-tasks/${task.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        name: "Edited scheduled fixture",
        frequency: "weekly",
        runDate: null,
        dayOfWeek: 1,
      }),
    });
    assert.equal(edited.status, 200);
    const listed = await (
      await fetch(`${origin}/api/v1/scheduled-tasks/${task.id}`, { headers })
    ).json();
    assert.equal(listed.data.task.name, "Edited scheduled fixture");
    assert.equal(listed.data.runs.length, 2);
    const removedTask = await fetch(
      `${origin}/api/v1/scheduled-tasks/${task.id}`,
      { method: "DELETE", headers },
    );
    assert.equal(removedTask.status, 200);
    assert.equal(
      (await fetch(`${origin}/api/v1/scheduled-tasks/${task.id}`, { headers }))
        .status,
      404,
    );
    console.log(
      "PASS: scheduled CRUD, validation, manual run deduplication, durable execution, stable result chat, atomic completion, preserved cadence, pause/edit/delete",
    );
    console.log(
      "PASS: authenticated admission, browser disconnect, server execution, live reconnect, durable final history, idempotent retry, ordered queue, stable chat perspective, explicit cancellation",
    );
  } catch (error) {
    console.error(log);
    throw error;
  } finally {
    child.kill("SIGTERM");
    model.closeAllConnections();
    await new Promise<void>((resolve) => model.close(() => resolve()));
    if (userId) {
      const removed = await admin.auth.admin.deleteUser(userId);
      assert.ifError(removed.error);
    }
    await getPool().end();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
