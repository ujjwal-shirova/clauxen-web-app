import { query, queryOne, withTransaction } from "@/server/db/pool";
import * as research from "@/server/repositories/deep-research.repository";
import * as chat from "@/server/services/chat.service";
import { triggerContinuation } from "@/server/chat/durable-generation";
import { cloudflareContext } from "@/server/cloudflare/context";
import { AppError } from "@/server/db/errors";

export async function scheduleResearch(id: string, seconds = 60) {
  const queue = cloudflareContext()?.env.GENERATION_QUEUE;
  if (queue)
    await queue.send({ researchPlanId: id }, { delaySeconds: seconds });
  // The per-minute watchdog scans persisted deadlines if a dispatch is lost.
}

/** Atomic state transition + stable admission keys make retries and timer/manual races safe. */
export async function startResearch(id: string, manual = false) {
  const claimed = await queryOne<{ id: string }>(
    `update public.deep_research_plans set status='starting',updated_at=now() where id=$1 and (
    (status='pending' and ($2::boolean or auto_start_at<=now())) or ($2::boolean and status='editing') or (status='starting' and updated_at<now()-interval '30 seconds')) returning id`,
    [id, manual],
  );
  if (!claimed) return research.getResearchById(id);
  const plan = await research.getResearchById(id);
  if (!plan) return null;
  const prompt = `[Deep research start: ${plan.tool_call_id}]\nResearch: ${plan.title}\n\nApproved research plan:\n${plan.tasks.map((task, index) => `${index + 1}. ${task}`).join("\n")}\n\nPerform multiple searches from different angles for each task. Read and cross-check primary sources. Call research_task_update before beginning each task and when its evidence is collected. Each search may request up to 30 results. Finish with a substantial cited report, including uncertainties. Do not stop at an outline or announce findings you have not verified.`;
  const job = await chat.acceptBackgroundChatTurn({
    chatId: plan.chat_id,
    userId: plan.user_id,
    jobInput: {
      executionOrigin: plan.execution_origin,
      researchPlanId: plan.id,
      chatModel: plan.model ?? undefined,
      extendedThinking: true,
      homerReasoningEffort: "high",
      generateChatTitle: false,
      messages: [{ role: "user", content: prompt }],
      turnStartedAtMs: Date.now(),
    },
  });
  await query(
    `update public.deep_research_plans set job_id=$2,status=case when status='starting' then 'running' else status end,task_statuses=case when status='starting' then jsonb_set(task_statuses,'{0}','"running"'::jsonb) else task_statuses end,auto_start_at=null,updated_at=now() where id=$1`,
    [id, job.id],
  );
  // Cancel/pause may race with admission. Reconcile before dispatching.
  const latest = await research.getResearchById(id);
  if (latest?.status === "cancelled") {
    await query(
      `update public.chat_generation_jobs set status='cancelled',completed_at=now(),locked_by=null,locked_at=null where id=$1 and status in ('queued','continuing')`,
      [job.id],
    );
  } else if (latest?.status === "paused") {
    await query(
      `update public.chat_generation_jobs set status='paused_for_user' where id=$1 and status in ('queued','continuing')`,
      [job.id],
    );
  } else await triggerContinuation(plan.execution_origin, job.id);
  await settleResearchActivity(id);
  return research.getResearchById(id);
}

export async function actOnResearch(
  plan: research.ResearchRow,
  action: string,
  tasks?: unknown,
  title?: unknown,
) {
  if (action === "start") return startResearch(plan.id, true);
  if (action === "edit" || action === "update") {
    if (
      action === "update" &&
      (!Array.isArray(tasks) ||
        tasks.length < 3 ||
        tasks.length > 8 ||
        !tasks.every(
          (t) => typeof t === "string" && t.trim() && t.length <= 1000,
        ))
    )
      throw new AppError("Provide 3–8 research tasks.", 400);
    if (
      title !== undefined &&
      (typeof title !== "string" || !title.trim() || title.length > 200)
    )
      throw new AppError("Invalid research title.", 400);
    const row = await queryOne(
      `update public.deep_research_plans set status=$2,auto_start_at=case when $2='pending' then now()+interval '60 seconds' else null end,tasks=coalesce($3::jsonb,tasks),task_statuses=case when $3::jsonb is null then task_statuses else (select jsonb_agg('pending'::text) from jsonb_array_elements($3::jsonb)) end,title=coalesce($4,title),updated_at=now() where id=$1 and status in ('pending','editing') returning id`,
      [
        plan.id,
        action === "edit" ? "editing" : "pending",
        action === "update" ? JSON.stringify(tasks) : null,
        typeof title === "string" ? title.trim() : null,
      ],
    );
    if (!row)
      throw new AppError(
        "The research has already started. Its approved plan can no longer be edited.",
        409,
      );
    if (action === "update") await scheduleResearch(plan.id);
  } else if (action === "cancel") {
    await query(
      `update public.deep_research_plans set status='cancelled',auto_start_at=null,updated_at=now() where id=$1 and status not in ('complete','failed','cancelled')`,
      [plan.id],
    );
    if (plan.job_id)
      await query(
        `update public.chat_generation_jobs set status='cancelled',completed_at=now(),updated_at=now() where id=$1 and status in ('queued','running','continuing','paused_for_user')`,
        [plan.job_id],
      );
  } else if (action === "pause") {
    await query(
      `update public.deep_research_plans set status='paused',updated_at=now() where id=$1 and status in ('starting','running')`,
      [plan.id],
    );
    if (plan.job_id)
      await query(
        `update public.chat_generation_jobs set status='paused_for_user',updated_at=now() where id=$1 and status in ('queued','continuing')`,
        [plan.job_id],
      );
  } else if (action === "retry" && plan.status === "failed" && plan.job_id) {
    // Reuse collected evidence and completed tools. No new prompt or duplicate job.
    const retried = await withTransaction(async (client) => {
      const locked = await client.query(
        `select p.id from public.deep_research_plans p join public.chat_generation_jobs j on j.id=p.job_id where p.id=$1 and p.status='failed' and j.status='failed' for update of p,j`,
        [plan.id],
      );
      if (!locked.rows.length) return false;
      await client.query(
        `update public.chat_generation_jobs set status='queued',error=null,completed_at=null,locked_by=null,locked_at=null,attempt=0,heartbeat_at=now(),updated_at=now() where id=$1`,
        [plan.job_id],
      );
      await client.query(
        `update public.chat_messages set status='queued',updated_at=now() where id=$1 and chat_id=$2`,
        [plan.assistant_message_id, plan.chat_id],
      );
      await client.query(
        `update public.deep_research_plans set status='running',error=null,updated_at=now() where id=$1`,
        [plan.id],
      );
      await client.query(
        `update public.chats set metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('generating',true,'generating_at',now()),updated_at=now() where id=$1 and user_id=$2`,
        [plan.chat_id, plan.user_id],
      );
      return true;
    });
    if (retried) await triggerContinuation(plan.execution_origin, plan.job_id);
  } else if (action === "resume") {
    const changed = await queryOne(
      `update public.deep_research_plans set status='running',updated_at=now() where id=$1 and status='paused' returning id`,
      [plan.id],
    );
    if (changed && plan.job_id) {
      await query(
        `update public.chat_generation_jobs set status='queued',completed_at=null,locked_by=null,locked_at=null,heartbeat_at=now(),updated_at=now() where id=$1 and status='paused_for_user'`,
        [plan.job_id],
      );
      await triggerContinuation(plan.execution_origin, plan.job_id);
    }
  } else throw new AppError("Unknown research action.", 400);
  await settleResearchActivity(plan.id);
  return research.getResearchById(plan.id);
}

export async function recoverResearch() {
  const due = await research.dueResearch();
  await Promise.all(
    due.map(({ id }) =>
      startResearch(id).catch((error) =>
        console.error("[research] deadline recovery failed", { id, error }),
      ),
    ),
  );
  // Reconcile runner crashes after a job's terminal commit, without marking tools completed by inference.
  await query(`update public.deep_research_plans p set status=case j.status when 'complete' then 'complete' when 'cancelled' then 'cancelled' else 'failed' end,error=j.error,updated_at=now()
    from public.chat_generation_jobs j where p.job_id=j.id and p.status in ('running','starting') and j.status in ('complete','failed','cancelled')`);
  const missing = await query<{ id: string }>(
    `select p.id from public.deep_research_plans p where p.status='complete' and not exists(select 1 from public.user_files f where f.id=p.id) order by p.updated_at desc limit 10`,
  );
  const { saveResearchReport } = await import("./research-report");
  for (const { id } of missing) {
    const plan = await research.getResearchById(id);
    if (plan)
      await saveResearchReport(plan).catch((error) =>
        console.error("[research] report recovery failed", { id, error }),
      );
  }
  return due.length;
}

/** Settle only this research turn; other chat work can continue independently. */
export async function settleResearchActivity(id: string) {
  const plan = await research.getResearchById(id);
  if (!plan?.job_id || !["cancelled", "paused"].includes(plan.status)) return;
  if (plan.status === "cancelled") {
    await query(
      `update public.chat_messages set status='cancelled',updated_at=now() where id=$1 and chat_id=$2 and status in ('queued','streaming')`,
      [plan.assistant_message_id, plan.chat_id],
    );
  }
  await query(
    `update public.chats c set metadata=jsonb_set(coalesce(metadata,'{}'::jsonb),'{generating}','false'::jsonb),updated_at=now()
    where c.id=$1 and c.user_id=$2 and not exists (select 1 from public.chat_generation_jobs j where j.chat_id=c.id and j.status in ('queued','running','continuing'))`,
    [plan.chat_id, plan.user_id],
  );
}
