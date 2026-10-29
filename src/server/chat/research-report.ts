import { queryOne, query } from "@/server/db/pool";
import { putObject, getObject } from "@/server/storage/object-store";
import * as messagesRepo from "@/server/repositories/messages.repository";
import type { ResearchRow } from "@/server/repositories/deep-research.repository";
import {
  reportMarkdown,
  reportCitations,
  researchReportTitle,
  type ResearchCitation,
  type ResearchReport,
} from "@/lib/research-report";

type ReportFile = {
  id: string;
  storage_path: string;
  storage_bucket: string;
  original_name: string;
  metadata: {
    title: string;
    citations: ResearchCitation[];
    elapsedSeconds: number;
  };
};
export async function researchReportFile(plan: ResearchRow) {
  return queryOne<ReportFile>(
    `select id,storage_path,storage_bucket,original_name,metadata from public.user_files where id=$1 and user_id=$2 and status!='deleted' and metadata->>'researchPlanId'=$1::text`,
    [plan.id, plan.user_id],
  );
}
/** Stable R2 key and file ID make completion and watchdog retries idempotent. */
export async function saveResearchReport(plan: ResearchRow) {
  if (plan.status !== "complete" || !plan.assistant_message_id) return;
  if (await researchReportFile(plan)) return;
  const message = await messagesRepo.getMessageForUser({
    messageId: plan.assistant_message_id,
    chatId: plan.chat_id,
    userId: plan.user_id,
  });
  if (!message?.content?.trim())
    throw new Error("The completed research report is empty.");
  const timing = await queryOne<{ elapsed: number }>(
    `select greatest(0, extract(epoch from coalesce(j.completed_at, m.updated_at) - j.created_at)) as elapsed
     from public.chat_generation_jobs j
     join public.chat_messages m on m.id = j.assistant_message_id
     where j.id = $1`,
    [plan.job_id],
  );
  const contentJson = (message.content_json ?? {}) as {
    agent_ui?: { sources?: ResearchCitation[] };
  };
  const sources = Array.isArray(contentJson?.agent_ui?.sources)
    ? contentJson.agent_ui!.sources!.filter((s) => {
        try {
          return ["http:", "https:"].includes(new URL(s.url).protocol);
        } catch {
          return false;
        }
      })
    : [];
  const markdown = reportMarkdown(message.content, sources);
  const title = researchReportTitle(markdown, plan.title);
  const citations = reportCitations(markdown, sources);
  const fileName = `${
    title
      .replace(/[^\p{L}\p{N} _-]/gu, "")
      .trim()
      .slice(0, 100) || "Research report"
  }.md`;
  const stored = await putObject({
    purpose: "artifacts",
    key: `users/${plan.user_id}/deep-research/${plan.id}/report.md`,
    body: markdown,
    contentType: "text/markdown; charset=utf-8",
    metadata: { researchPlanId: plan.id, chatId: plan.chat_id },
  });
  await query(
    `insert into public.user_files(id,user_id,original_name,mime_type,size_bytes,storage_bucket,storage_path,content_hash,status,metadata) values($1,$2,$3,'text/markdown',$4,$5,$6,$7,'uploaded',$8::jsonb) on conflict(id) do nothing`,
    [
      plan.id,
      plan.user_id,
      fileName,
      Buffer.byteLength(markdown),
      stored.bucket,
      stored.key,
      stored.contentHash,
      JSON.stringify({
        purpose: "artifacts",
        source: "deep_research",
        chatId: plan.chat_id,
        researchPlanId: plan.id,
        title,
        citations,
        elapsedSeconds: Math.round(Number(timing?.elapsed ?? 0)),
      }),
    ],
  );
}
export async function loadResearchReport(
  plan: ResearchRow,
): Promise<ResearchReport | null> {
  const file = await researchReportFile(plan);
  if (!file) return null;
  const body = await getObject(
    "artifacts",
    file.storage_path,
    file.storage_bucket,
  );
  return {
    title: file.metadata.title,
    markdown: body.toString("utf8"),
    citations: file.metadata.citations ?? [],
    elapsedSeconds: file.metadata.elapsedSeconds ?? 0,
    fileName: file.original_name,
    fileId: file.id,
  };
}
