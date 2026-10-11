/* eslint-disable security/detect-non-literal-fs-filename -- Configuration files are a fixed local list. */
/** Uses a disposable identity and real persistence; continuation dispatch is a local stub. */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { parse } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { createServer } from "node:http";
import { once } from "node:events";
import { randomUUID } from "node:crypto";

async function main() {
  for (const file of [
    ".env.vercel",
    ".env.local",
    ".env.production",
    ".dev.vars",
  ])
    if (existsSync(file)) Object.assign(process.env, parse(readFileSync(file)));
  let deliveries = 0;
  const server = createServer((_request, response) => {
    deliveries++;
    response.writeHead(202);
    response.end();
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  process.env.GENERATIONS_EXECUTION_ORIGIN = origin;
  process.env.GENERATIONS_INTERNAL_TOKEN = randomUUID();
  process.env.CHAT_COORD_WORKER_URL = "";
  process.env.CHAT_HISTORY_WORKER_URL = "";
  process.env.VERCEL = "0";
  process.env.HOSTING_PLATFORM = "local";
  process.env.NODE_ENV = "development";
  process.env.STORAGE_REQUIRE_R2 = "false"; // Local object store; deployed API smoke covers real R2 bindings.
  const { query, queryOne, getPool } = await import("../src/server/db/pool");
  const repo =
    await import("../src/server/repositories/deep-research.repository");
  const service = await import("../src/server/chat/research");
  const messages =
    await import("../src/server/repositories/messages.repository");
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  let userId: string | undefined;
  try {
    const created = await admin.auth.admin.createUser({
      email: `research-${randomUUID()}@example.test`,
      password: `Res!9${randomUUID()}`,
      email_confirm: true,
    });
    assert.ifError(created.error);
    userId = created.data.user!.id;
    const chatId = `research-test-${randomUUID()}`;
    await query(
      `insert into public.chats(id,user_id,title) values($1,$2,'Research fixture')`,
      [chatId, userId],
    );
    const make = (toolId: string) =>
      repo.createResearch({
        chatId,
        userId: userId!,
        toolId,
        title: "Fixture research",
        tasks: ["First task", "Second task", "Third task"],
        origin,
        model: "virgil",
      });
    const plan = await make("first");
    assert(plan);
    assert.equal(
      await repo.getResearch(chatId, "first", randomUUID()),
      null,
      "another identity cannot read the plan",
    );
    assert.equal(plan.status, "pending");
    assert(
      Math.abs(new Date(plan.auto_start_at!).getTime() - Date.now() - 60000) <
        5000,
    );
    assert.equal(
      (await make("first"))!.id,
      plan.id,
      "replayed planning tool is idempotent",
    );
    await service.startResearch(plan.id);
    assert.equal(deliveries, 0, "premature queue delivery cannot start");
    await service.actOnResearch(plan, "edit");
    await query(
      `update public.deep_research_plans set auto_start_at=now()-interval '1 minute' where id=$1`,
      [plan.id],
    );
    await service.recoverResearch();
    assert.equal(deliveries, 0, "editing suspends server auto-start");
    await service.actOnResearch(
      (await repo.getResearchById(plan.id))!,
      "update",
      ["Edited task", "Second task", "Third task", "Fourth task"],
      "Edited title",
    );
    let edited = (await repo.getResearchById(plan.id))!;
    assert.equal(edited.task_statuses.length, 4);
    assert(new Date(edited.auto_start_at!).getTime() > Date.now() + 55000);
    await Promise.all([
      service.startResearch(plan.id, true),
      service.startResearch(plan.id, true),
    ]);
    edited = (await repo.getResearchById(plan.id))!;
    assert.equal(edited.status, "running");
    assert.equal(deliveries, 1, "manual/timer races admit only one job");
    const job = await queryOne<{
      input: { extendedThinking: boolean; researchPlanId: string };
    }>(`select input from public.chat_generation_jobs where id=$1`, [
      edited.job_id,
    ]);
    assert.equal(job!.input.extendedThinking, true);
    assert.equal(job!.input.researchPlanId, plan.id);
    const promptRows = await query<{ role: string }>(
      `select role from public.chat_messages where chat_id=$1`,
      [chatId],
    );
    assert(promptRows.length > 0);
    assert(
      promptRows.every((row) => row.role === "assistant"),
      "Start never manufactures a user message",
    );

    await repo.addResearchSources(plan.id, [
      "https://example.test/a",
      "https://example.test/b",
    ]);
    await repo.addResearchSources(plan.id, ["https://example.test/a"]);
    edited = (await repo.getResearchById(plan.id))!;
    assert.equal(edited.source_count, 2);
    assert.equal(edited.search_count, 2);
    await service.actOnResearch(edited, "pause");
    await query(
      `update public.chat_messages set updated_at=now()-interval '10 minutes' where id=$1`,
      [edited.assistant_message_id],
    );
    assert.equal(
      await messages.finalizeStaleStreamingMessages(chatId),
      0,
      "paused research trace survives orphan sweeping",
    );
    await service.actOnResearch(
      (await repo.getResearchById(plan.id))!,
      "resume",
    );
    assert.equal(deliveries, 2, "resume dispatches the saved job");
    await service.actOnResearch(
      (await repo.getResearchById(plan.id))!,
      "cancel",
    );
    assert.equal((await repo.getResearchById(plan.id))!.status, "cancelled");
    const saved = await queryOne<{ status: string }>(
      `select status from public.chat_messages where id=$1`,
      [edited.assistant_message_id],
    );
    assert.equal(saved!.status, "cancelled");
    const cancelled = await make("cancel-before-start");
    assert(cancelled);
    await service.actOnResearch(cancelled, "cancel");
    await service.startResearch(cancelled.id, true);
    assert.equal(deliveries, 2);
    const due = await make("due-without-browser");
    assert(due);
    await query(
      `update public.deep_research_plans set auto_start_at=now()-interval '1 second' where id=$1`,
      [due.id],
    );
    await service.recoverResearch();
    assert.equal((await repo.getResearchById(due.id))!.status, "running");
    assert.equal(deliveries, 3);
    await service.actOnResearch(
      (await repo.getResearchById(due.id))!,
      "cancel",
    );
    const reportPlan = await make("report-save");
    assert(reportPlan);
    await service.startResearch(reportPlan.id, true);
    const activeReport = (await repo.getResearchById(reportPlan.id))!;
    const { buildAssistantTranscriptRecord } =
      await import("../src/server/training/transcript-format");
    const markdown =
      "# Full research report\n\nVerified [evidence](https://example.test/source).\n\nComplete final conclusion.";
    await query(
      `update public.chat_messages set content=$2,content_json=$3::jsonb,status='complete' where id=$1`,
      [
        activeReport.assistant_message_id,
        markdown,
        JSON.stringify(
          buildAssistantTranscriptRecord({
            answer: markdown,
            agentUi: {
              sources: [
                {
                  url: "https://example.test/source",
                  title: "Official source",
                  snippet: "Evidence",
                },
              ],
            },
          }),
        ),
      ],
    );
    await query(
      `update public.chat_generation_jobs set status='complete',completed_at=now() where id=$1`,
      [activeReport.job_id],
    );
    await query(
      `update public.deep_research_plans set status='complete' where id=$1`,
      [activeReport.id],
    );
    const completeReport = (await repo.getResearchById(activeReport.id))!;
    const { saveResearchReport, loadResearchReport, researchReportFile } =
      await import("../src/server/chat/research-report");
    try {
      await saveResearchReport(completeReport);
      await saveResearchReport(completeReport);
      const file = await researchReportFile(completeReport);
      assert(file);
      assert.equal(
        file.storage_path,
        `users/${userId}/deep-research/${completeReport.id}/report.md`,
      );
      const savedReport = await loadResearchReport(completeReport);
      assert(savedReport);
      assert.equal(savedReport.markdown, markdown);
      assert.equal(savedReport.citations.length, 1);
      assert.equal(savedReport.citations[0].title, "Official source");
      const count = await queryOne<{ count: string }>(
        `select count(*) count from public.user_files where id=$1`,
        [completeReport.id],
      );
      assert.equal(
        Number(count!.count),
        1,
        "report completion retries create one file",
      );
    } finally {
      const { deleteObject } =
        await import("../src/server/storage/object-store");
      await deleteObject(
        "artifacts",
        `users/${userId}/deep-research/${completeReport.id}/report.md`,
      ).catch(() => {});
    }

    const failedPlan = await make("retry-saved-evidence");
    assert(failedPlan);
    await service.startResearch(failedPlan.id, true);
    const failedRun = (await repo.getResearchById(failedPlan.id))!;
    await repo.addResearchSources(failedRun.id, [
      "https://example.test/saved-evidence",
    ]);
    await query(
      `update public.chat_generation_jobs set status='failed',error='503 provider timeout',checkpoint=checkpoint||'{"step":2}'::jsonb where id=$1`,
      [failedRun.job_id],
    );
    await query(
      `update public.deep_research_plans set status='failed',error='503 provider timeout' where id=$1`,
      [failedRun.id],
    );
    await service.actOnResearch(
      (await repo.getResearchById(failedRun.id))!,
      "retry",
    );
    const retried = (await repo.getResearchById(failedRun.id))!;
    assert.equal(retried.job_id, failedRun.job_id);
    assert.equal(retried.assistant_message_id, failedRun.assistant_message_id);
    assert.equal(retried.status, "running");
    assert.equal(retried.source_count, 1);
    const retriedJob = await queryOne<{
      status: string;
      checkpoint: { step: number };
    }>(
      `select status,checkpoint from public.chat_generation_jobs where id=$1`,
      [retried.job_id],
    );
    assert.equal(retriedJob!.status, "queued");
    assert.equal(retriedJob!.checkpoint.step, 2);
    await service.actOnResearch(retried, "cancel");
    console.log(
      "PASS: persisted timer, edit/reset, race-safe admission, thinking, source dedupe, pause/reconnect/resume, cancel, browser-independent recovery, owner-scoped report save/load and idempotency",
    );
  } finally {
    if (userId) {
      const result = await admin.auth.admin.deleteUser(userId);
      assert.ifError(result.error);
    }
    await getPool().end();
    server.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
