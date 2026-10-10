/** Explicit production smoke: disposable user, one small model reply, no email. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { loadEnvConfig } from "@next/env";

async function main() {
  loadEnvConfig(process.cwd(), true);
  const origin = process.env.SCHEDULED_SMOKE_ORIGIN;
  assert(
    origin && new URL(origin).protocol === "https:",
    "Set SCHEDULED_SMOKE_ORIGIN explicitly",
  );
  const { env } = await import("../src/server/config/env");
  const { getSupabasePublicConfig } =
    await import("../src/shared/utils/supabase/env");
  const { queryOne, getPool } = await import("../src/server/db/pool");
  const config = getSupabasePublicConfig();
  assert(config.url && config.publishableKey && env.supabaseServiceRoleKey);
  const options = { auth: { persistSession: false, autoRefreshToken: false } };
  const admin = createClient(config.url, env.supabaseServiceRoleKey, options);
  const auth = createClient(config.url, config.publishableKey, options);
  const email = `schedule-smoke-${randomUUID()}@example.test`;
  const password = `Sm!9${randomUUID()}`;
  let userId: string | undefined;
  try {
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
      authorization: `Bearer ${signed.data.session.access_token}`,
      "content-type": "application/json",
    };
    // Use the real Cron → Queue flow; never invoke global dispatch manually.
    const slot = new Date(Math.ceil((Date.now() + 90_000) / 60_000) * 60_000);
    const response = await fetch(`${origin}/api/v1/scheduled-tasks`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: "Scheduled production smoke",
        requirement:
          "Reply with exactly SCHEDULED_OK. Do not use tools or schedule any new tasks.",
        frequency: "once",
        runDate: slot.toISOString().slice(0, 10),
        timeLocal: slot.toISOString().slice(11, 16),
        timezone: "UTC",
        notificationMode: "app_only",
        modelMode: "fast",
      }),
      signal: AbortSignal.timeout(30_000),
    });
    assert.equal(response.status, 201, await response.clone().text());
    const {
      data: { task },
    } = await response.json();
    console.log(
      `Created fixture task ${task.id}; waiting for Cloudflare cron at ${slot.toISOString()}`,
    );
    let completed = false;
    const deadline = Date.now() + 8 * 60_000;
    while (Date.now() < deadline) {
      const detail = await fetch(
        `${origin}/api/v1/scheduled-tasks/${task.id}`,
        { headers, signal: AbortSignal.timeout(30_000) },
      );
      assert.equal(detail.status, 200, await detail.clone().text());
      const { data } = await detail.json();
      const run = data.runs[0];
      if (run && ["success", "failed", "skipped"].includes(run.status)) {
        assert.equal(run.status, "success", JSON.stringify(run));
        assert.equal(data.runs.length, 1);
        assert.equal(data.task.status, "completed");
        assert.equal(data.task.run_count, 1);
        assert.equal(data.task.next_run_at, null);
        const result = await queryOne<{ content: string; status: string }>(
          `select content,status from public.chat_messages where chat_id=$1 and role='assistant'`,
          [run.chat_id],
        );
        assert.equal(result?.status, "complete");
        assert(result?.content.includes("SCHEDULED_OK"));
        const notification = await queryOne<{ id: string }>(
          `select id from public.automation_notifications where run_id=$1`,
          [run.id],
        );
        if (!notification) {
          await new Promise((resolve) => setTimeout(resolve, 10_000));
          continue;
        }
        console.log(
          `PASS: production Cron → Queue → durable generation → result chat → atomic completion → app notification; run ${run.id}`,
        );
        completed = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 10_000));
    }
    assert(completed, "Scheduled fixture did not finish within eight minutes");
  } finally {
    if (userId) {
      const removed = await admin.auth.admin.deleteUser(userId);
      assert.ifError(removed.error);
      console.log("Removed production fixture user and data");
    }
    await getPool().end();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
